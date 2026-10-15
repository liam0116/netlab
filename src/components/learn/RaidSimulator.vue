<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HardDrive, Pause, Play, RotateCcw, SkipForward, Wrench } from 'lucide-vue-next'
import RaidRecoveryAnimation from './RaidRecoveryAnimation.vue'
import {
  arrayState,
  blockValue,
  MAX_DISKS,
  MIN_DISKS,
  RAID_LEVELS,
  raidInfo,
  raidLayout,
  rebuildHours,
  toBits,
  validDiskCount,
  type RaidBlock,
  type RaidLevel,
} from '@/utils/raid'

/**
 * Interactive RAID model: watch blocks being written, fail disks, see how a lost block is recovered and
 * watch the rebuild. Everything shown comes from utils/raid.ts.
 */
const level = defineModel<RaidLevel>('level', { default: 5 })
const { t } = useI18n()

const STRIPES = 4
const disks = ref(4)
const diskTB = ref(8)
const media = ref<'hdd' | 'ssd'>('hdd')
const showBits = ref(false)

const layout = computed(() => raidLayout(level.value, disks.value, STRIPES))
const totalData = computed(() => Math.max(0, ...layout.value.flat().map((b) => (b.dataIndex ?? -1) + 1)))
const info = computed(() => raidInfo(level.value, disks.value, diskTB.value))

function setLevel(l: RaidLevel): void {
  level.value = l
}
// Keep the disk count valid for the level (RAID 10 needs an even number, RAID 6 at least 4), however it changed.
watch(
  level,
  (l) => {
    let n = Math.max(disks.value, MIN_DISKS[l])
    if (l === 10 && n % 2) n++
    disks.value = Math.min(n, MAX_DISKS)
  },
  { immediate: true },
)
function changeDisks(delta: number): void {
  let n = disks.value + delta * (level.value === 10 ? 2 : 1)
  n = Math.min(MAX_DISKS, Math.max(MIN_DISKS[level.value], n))
  if (validDiskCount(level.value, n)) disks.value = n
}

// --- Write animation ------------------------------------------------------------
const written = ref(0)
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
function stop(): void {
  playing.value = false
  clearInterval(timer)
}
function step(): void {
  if (written.value < totalData.value) written.value++
  if (written.value >= totalData.value) stop()
}
function togglePlay(): void {
  if (playing.value) return stop()
  if (written.value >= totalData.value) written.value = 0
  playing.value = true
  timer = setInterval(step, 750)
}
function resetAll(): void {
  stop()
  written.value = 0
  failed.value = new Set()
  closeAnimation()
}
function showAll(): void {
  stop()
  written.value = totalData.value
}
watch([level, disks], resetAll)
onBeforeUnmount(() => {
  clearInterval(timer)
})

/** A block is visible once its data has been written; parity once its whole stripe is written. */
function isWritten(b: RaidBlock): boolean {
  if (b.dataIndex !== null) return b.dataIndex < written.value
  return layout.value.every((disk) => {
    const x = disk[b.stripe]!
    return x.dataIndex === null || x.dataIndex < written.value
  })
}

/** Caption for the block just written. */
const caption = computed(() => {
  if (written.value === 0) return t('raidPage.sim.captionStart')
  const index = written.value - 1
  const where = layout.value
    .map((disk, d) => ({ d, b: disk.find((x) => x.dataIndex === index) }))
    .filter((x) => x.b)
  const main = where.find((x) => x.b!.kind === 'data') ?? where[0]!
  const copies = where.filter((x) => x !== main).map((x) => `Disk ${x.d + 1}`)
  let text = t('raidPage.sim.captionWrite', { block: `D${index + 1}`, disk: `Disk ${main.d + 1}` })
  if (copies.length) text += ' ' + t('raidPage.sim.captionMirror', { disks: copies.join(', ') })
  // Did this write complete a stripe with parity?
  const stripe = main.b!.stripe
  const stripeData = layout.value.map((disk) => disk[stripe]!).filter((b) => b.kind === 'data')
  const complete = stripeData.every((b) => b.dataIndex! <= index) && stripeData.some((b) => b.dataIndex === index)
  if (complete && (level.value === 5 || level.value === 6)) {
    const p = `P${stripe + 1}`
    text += ' ' + t('raidPage.sim.captionParity', { p, data: stripeData.map((b) => b.label).join(' ⊕ ') })
    if (level.value === 6) text += ' ' + t('raidPage.sim.captionQ', { q: `Q${stripe + 1}` })
  }
  return text
})

// --- Failures and recovery -----------------------------------------------------------
const failed = ref<Set<number>>(new Set())
const state = computed(() => arrayState(level.value, disks.value, failed.value))

/**
 * The recovery animation: one stripe when a lost block is clicked, every stripe for "replace disk and rebuild".
 * `rebuilt` counts stripes already rebuilt so the disk grid fills in green as the animation goes.
 */
const animation = ref<{ stripes: number[]; rebuild: boolean } | null>(null)
const rebuilt = ref(0)
const rebuildDone = ref(false)
function closeAnimation(): void {
  animation.value = null
  rebuilt.value = 0
}

function toggleDisk(d: number): void {
  if (animation.value?.rebuild) return
  const next = new Set(failed.value)
  if (next.has(d)) next.delete(d)
  else next.add(d)
  failed.value = next
  closeAnimation()
  rebuildDone.value = false
  if (written.value === 0) showAll()
  // Start explaining straight away: how the first stripe is (or cannot be) recovered.
  if (next.size) animation.value = { stripes: [0], rebuild: false }
}

function explainBlock(stripe: number): void {
  if (animation.value?.rebuild) return
  animation.value = { stripes: [stripe], rebuild: false }
}

function rebuild(): void {
  if (state.value !== 'degraded') return
  if (written.value === 0) showAll()
  rebuilt.value = 0
  animation.value = { stripes: Array.from({ length: STRIPES }, (_, i) => i), rebuild: true }
}
function onProgress(done: number): void {
  if (animation.value?.rebuild) rebuilt.value = done
}
function onDone(): void {
  if (!animation.value?.rebuild) return
  // Leave the finished picture on screen for a moment, then put the new disk into service.
  setTimeout(() => {
    failed.value = new Set()
    closeAnimation()
    rebuildDone.value = true
  }, 1500)
}

const valueOf = (b: RaidBlock): number => blockValue(layout.value, b)

function blockClass(d: number, b: RaidBlock): string {
  if (!isWritten(b)) return 'border-dashed border-line text-transparent'
  if (failed.value.has(d)) {
    if (animation.value?.rebuild && b.stripe < rebuilt.value) return 'border-ok bg-ok-soft text-ok'
    return state.value === 'failed' ? 'border-err bg-err-soft text-err line-through' : 'border-line bg-surface-2 text-muted line-through'
  }
  const kind = { data: 'border-net/40 bg-net-soft text-net', mirror: 'border-host/40 bg-host-soft text-host', parity: 'border-accent/40 bg-accent-soft text-accent', 'parity-q': 'border-warn/40 bg-warn-soft text-warn' }[b.kind]
  const explaining = animation.value && !animation.value.rebuild && animation.value.stripes[0] === b.stripe
  return `${kind}${explaining ? ' ring-2 ring-accent' : ''}`
}

const hours = computed(() => rebuildHours(diskTB.value, media.value === 'hdd' ? 180 : 600))
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
</script>

<template>
  <div class="space-y-4">
    <!-- Level -->
    <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('raidPage.sim.level')">
      <button
        v-for="l in RAID_LEVELS"
        :key="l"
        role="radio"
        :aria-checked="level === l"
        class="rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors"
        :class="level === l ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-accent/50'"
        @click="setLevel(l)"
      >
        RAID {{ l }}
      </button>
    </div>

    <!-- Settings -->
    <div class="flex flex-wrap items-end gap-4 text-sm">
      <div>
        <span class="label normal-case">{{ t('raidPage.sim.disks') }}</span>
        <div class="flex items-center gap-1">
          <button class="btn px-2 py-1" :aria-label="t('raidPage.sim.fewer')" @click="changeDisks(-1)">−</button>
          <span class="w-8 text-center font-mono">{{ disks }}</span>
          <button class="btn px-2 py-1" :aria-label="t('raidPage.sim.more')" @click="changeDisks(1)">+</button>
        </div>
      </div>
      <div>
        <label for="raid-size" class="label normal-case">{{ t('raidPage.sim.diskSize') }}</label>
        <select id="raid-size" v-model.number="diskTB" class="field py-1.5">
          <option v-for="s in [1, 2, 4, 8, 12, 16, 20]" :key="s" :value="s">{{ s }} TB</option>
        </select>
      </div>
      <div>
        <label for="raid-media" class="label normal-case">{{ t('raidPage.sim.media') }}</label>
        <select id="raid-media" v-model="media" class="field py-1.5">
          <option value="hdd">HDD</option>
          <option value="ssd">SSD</option>
        </select>
      </div>
      <label v-if="level === 5 || level === 6" class="flex items-center gap-2 pb-2 text-xs text-muted">
        <input v-model="showBits" type="checkbox" class="accent-[var(--accent)]" /> {{ t('raidPage.sim.showBits') }}
      </label>
    </div>

    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-2">
      <button class="btn btn-primary" @click="togglePlay">
        <Pause v-if="playing" class="size-4" />
        <Play v-else class="size-4" />
        {{ playing ? t('common.pause') : t('raidPage.sim.play') }}
      </button>
      <button class="btn" :disabled="written >= totalData" @click="step"><SkipForward class="size-4" /> {{ t('raidPage.sim.step') }}</button>
      <button class="btn" @click="showAll">{{ t('raidPage.sim.showAll') }}</button>
      <button class="btn" @click="resetAll"><RotateCcw class="size-4" /> {{ t('common.restart') }}</button>
      <button v-if="state === 'degraded'" class="btn border-ok text-ok" :disabled="animation?.rebuild" @click="rebuild">
        <Wrench class="size-4" /> {{ t('raidPage.sim.rebuild') }}
      </button>
    </div>
    <p class="min-h-10 rounded-md bg-surface-2 px-3 py-2 text-sm" aria-live="polite">{{ caption }}</p>

    <!-- Disks -->
    <div class="overflow-x-auto pb-1">
      <div class="flex gap-2">
        <div
          v-for="(disk, d) in layout"
          :key="`${level}-${disks}-${d}`"
          class="w-24 shrink-0 rounded-lg border p-2 transition-colors"
          :class="failed.has(d) ? (state === 'failed' ? 'border-err bg-err-soft/40' : 'border-warn bg-warn-soft/40') : 'border-line'"
        >
          <button
            class="mb-2 flex w-full items-center justify-center gap-1 rounded py-1 text-xs font-semibold hover:bg-surface-2"
            :aria-pressed="failed.has(d)"
            :title="failed.has(d) ? t('raidPage.sim.repairDisk') : t('raidPage.sim.failDisk')"
            :aria-label="`Disk ${d + 1}：${failed.has(d) ? t('raidPage.sim.repairDisk') : t('raidPage.sim.failDisk')}`"
            @click="toggleDisk(d)"
          >
            <HardDrive class="size-3.5" :class="failed.has(d) ? 'text-err' : ''" />
            Disk {{ d + 1 }}
            <span v-if="failed.has(d)" class="text-err">✕</span>
          </button>
          <!-- RAID 10 pair label -->
          <div v-if="level === 10" class="-mt-1 mb-1 text-center text-[10px] text-muted">{{ t('raidPage.sim.pair', { n: Math.floor(d / 2) + 1 }) }}</div>
          <div class="space-y-1.5">
            <button
              v-for="b in disk"
              :key="b.stripe"
              class="anim-fade flex h-11 w-full flex-col items-center justify-center rounded border font-mono text-xs font-semibold transition-all"
              :class="blockClass(d, b)"
              :disabled="!failed.has(d) || !isWritten(b)"
              @click="explainBlock(b.stripe)"
            >
              {{ b.label }}
              <span v-if="showBits && isWritten(b)" class="text-[10px] font-normal opacity-80">{{ toBits(valueOf(b)) }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex flex-wrap gap-3 text-xs text-muted">
      <span class="flex items-center gap-1"><span class="size-3 rounded bg-net-soft ring-1 ring-net/40" /> {{ t('raidPage.sim.legend.data') }}</span>
      <span v-if="level === 1 || level === 10" class="flex items-center gap-1"><span class="size-3 rounded bg-host-soft ring-1 ring-host/40" /> {{ t('raidPage.sim.legend.mirror') }}</span>
      <span v-if="level === 5 || level === 6" class="flex items-center gap-1"><span class="size-3 rounded bg-accent-soft ring-1 ring-accent/40" /> {{ t('raidPage.sim.legend.parity') }}</span>
      <span v-if="level === 6" class="flex items-center gap-1"><span class="size-3 rounded bg-warn-soft ring-1 ring-warn/40" /> {{ t('raidPage.sim.legend.q') }}</span>
      <span>· {{ t('raidPage.sim.legend.stripe') }}</span>
    </div>

    <!-- State -->
    <div
      class="rounded-lg border px-4 py-3 text-sm"
      :class="{ 'border-ok/40 bg-ok-soft text-ok': state === 'optimal', 'border-warn/40 bg-warn-soft text-warn': state === 'degraded', 'border-err/40 bg-err-soft text-err': state === 'failed' }"
      role="status"
    >
      <div class="font-semibold">{{ t(`raidPage.sim.state.${state}`) }}</div>
      <div class="mt-0.5 text-xs opacity-90">
        {{
          animation?.rebuild
            ? t('raidPage.sim.rebuilding', { done: Math.min(rebuilt, STRIPES), total: STRIPES })
            : rebuildDone && state === 'optimal'
              ? t('raidPage.sim.rebuildFinished')
              : t(`raidPage.sim.stateHint.${state}`, { n: info.tolerance })
        }}
      </div>
    </div>
    <RaidRecoveryAnimation
      v-if="animation && state !== 'optimal'"
      :level="level"
      :disks="disks"
      :failed="failed"
      :stripes="animation.stripes"
      @progress="onProgress"
      @done="onDone"
    />

    <!-- Numbers -->
    <dl class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div class="rounded-md border border-line p-3">
        <dt class="text-xs text-muted">{{ t('raidPage.sim.usable') }}</dt>
        <dd class="font-mono text-lg">{{ fmt(info.usableTB) }} TB <span class="text-xs text-muted">/ {{ disks * diskTB }} TB</span></dd>
        <div class="mt-1 h-2 overflow-hidden rounded bg-surface-2"><div class="h-full bg-ok" :style="{ width: `${info.efficiency * 100}%` }" /></div>
        <dd class="mt-1 text-xs text-muted">{{ t('raidPage.sim.efficiency', { percent: Math.round(info.efficiency * 100) }) }}</dd>
      </div>
      <div class="rounded-md border border-line p-3">
        <dt class="text-xs text-muted">{{ t('raidPage.sim.tolerance') }}</dt>
        <dd class="font-mono text-lg" :class="info.tolerance ? '' : 'text-err'">{{ info.tolerance }}</dd>
        <dd v-if="level === 10" class="text-xs text-muted">{{ t('raidPage.sim.toleranceBest', { n: info.bestCaseTolerance }) }}</dd>
      </div>
      <div class="rounded-md border border-line p-3">
        <dt class="text-xs text-muted">{{ t('raidPage.sim.speed') }}</dt>
        <dd class="font-mono">{{ t('raidPage.sim.read') }} ×{{ fmt(info.readSpeed) }} · {{ t('raidPage.sim.write') }} ×{{ fmt(info.writeSpeed) }}</dd>
        <dd class="text-xs text-muted">{{ t('raidPage.sim.penalty', { n: info.writePenalty }) }}</dd>
      </div>
      <div class="rounded-md border border-line p-3 sm:col-span-2 lg:col-span-3">
        <dt class="text-xs text-muted">{{ t('raidPage.sim.rebuildTime') }}</dt>
        <dd>
          <span class="font-mono">≈ {{ fmt(hours) }} h</span>
          <span class="text-xs text-muted"> · {{ t('raidPage.sim.rebuildHint', { media: media.toUpperCase(), speed: media === 'hdd' ? 180 : 600 }) }}</span>
        </dd>
      </div>
    </dl>
  </div>
</template>
