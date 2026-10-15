<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-vue-next'
import { blockValue, gfDiv, raidLayout, recoveryPlan, solvePQ, toBits, type PlanBlock, type RaidLevel, type RecoveryStep } from '@/utils/raid'

/**
 * Step-by-step animation of how a controller rebuilds lost blocks: which blocks it reads, the XOR done
 * bit by bit, the mirror copy, or the RAID 6 P / Q equations — with the real values from utils/raid.ts.
 * `stripes` with one entry explains one block; with every stripe it is the full-disk rebuild.
 */
const props = defineProps<{ level: RaidLevel; disks: number; failed: ReadonlySet<number>; stripes: number[] }>()
const emit = defineEmits<{ progress: [stripesDone: number]; done: [] }>()
const { t } = useI18n()

interface Frame {
  stripeIndex: number
  stepIndex: number
  /** Sub-frame inside a step, e.g. the bit column of an XOR. */
  sub: number
}

const plans = computed(() => props.stripes.map((s) => recoveryPlan(props.level, props.disks, props.failed, s)))
const layout = computed(() => raidLayout(props.level, props.disks, Math.max(...props.stripes) + 1))

/** Frames per step: XOR reveals one bit column at a time, equations one line at a time. */
function subFrames(step: RecoveryStep): number {
  switch (step.kind) {
    case 'xor':
      return 6 // rows, 4 bit columns, result
    case 'copy':
      return 2
    case 'q-calc':
      return 3
    case 'q-solve-one':
      return 2
    case 'pq-solve':
      return 4
    default:
      return 1
  }
}

const frames = computed<Frame[]>(() =>
  plans.value.flatMap((plan, stripeIndex) => plan.flatMap((step, stepIndex) => Array.from({ length: subFrames(step) }, (_, sub) => ({ stripeIndex, stepIndex, sub })))),
)
const index = ref(0)
const frame = computed(() => frames.value[Math.min(index.value, frames.value.length - 1)]!)
const plan = computed(() => plans.value[frame.value.stripeIndex]!)
const step = computed(() => plan.value[frame.value.stepIndex]!)
const stripe = computed(() => props.stripes[frame.value.stripeIndex]!)

// --- Playback --------------------------------------------------------------------
const SPEEDS = { slow: 2600, normal: 1600, fast: 700 } as const
const speed = ref<keyof typeof SPEEDS>('normal')
const playing = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
function schedule(): void {
  clearTimeout(timer)
  if (!playing.value) return
  timer = setTimeout(() => {
    if (index.value < frames.value.length - 1) {
      index.value++
      schedule()
    } else playing.value = false
  }, SPEEDS[speed.value])
}
function play(): void {
  if (index.value >= frames.value.length - 1) index.value = 0
  playing.value = true
  schedule()
}
function pause(): void {
  playing.value = false
  clearTimeout(timer)
}
function go(delta: number): void {
  pause()
  index.value = Math.min(frames.value.length - 1, Math.max(0, index.value + delta))
}
function restart(): void {
  index.value = 0
  play()
}
onMounted(play)
onBeforeUnmount(() => clearTimeout(timer))
watch(speed, schedule)
watch(
  () => [props.level, props.disks, [...props.failed].join(), props.stripes.join()],
  () => restart(),
)

// Report stripes finished (a stripe is finished once its write frame has been shown).
const isLastFrame = computed(() => index.value >= frames.value.length - 1)
watch(index, () => {
  const done = frame.value.stripeIndex + (step.value.kind === 'write' || step.value.kind === 'lost' ? 1 : 0)
  emit('progress', done)
  if (isLastFrame.value && step.value.kind === 'write') emit('done')
})

// --- What the stripe row shows ------------------------------------------------------
const readDisks = computed(() => {
  const set = new Set<number>()
  plan.value.slice(0, frame.value.stepIndex + 1).forEach((s) => s.kind === 'read' && s.blocks.forEach((b) => set.add(b.disk)))
  return set
})
const writtenNow = computed(() => step.value.kind === 'write')

function cell(disk: number): { label: string; bits: string; tone: 'lost' | 'read' | 'rebuilt' | 'normal' | 'gone' } {
  const block = layout.value[disk]![stripe.value]!
  const value = blockValue(layout.value, block)
  if (props.failed.has(disk)) {
    if (writtenNow.value) return { label: block.label, bits: toBits(value), tone: 'rebuilt' }
    return { label: block.label, bits: '????', tone: step.value.kind === 'lost' ? 'gone' : 'lost' }
  }
  return { label: block.label, bits: toBits(value), tone: readDisks.value.has(disk) && !writtenNow.value ? 'read' : 'normal' }
}

const bitsOf = (b: PlanBlock) => toBits(b.value).split('')
const ones = (rows: PlanBlock[], col: number) => rows.filter((r) => toBits(r.value)[col] === '1').length
/** Columns of the result revealed so far (sub 1..4 → 1..4 columns). */
const revealed = computed(() => (step.value.kind === 'xor' ? Math.max(0, Math.min(4, frame.value.sub)) : 0))
const w = (n: number) => `g^${Math.round(Math.log2(n))}`

/** Step number within the stripe, so longer RAID 6 flows count 1, 2, 3, 4… without repeats. */
const caption = computed(() => `${t('raidPage.anim.step', { n: frame.value.stepIndex + 1 })}${stepText.value}`)

const stepText = computed(() => {
  const s = step.value
  const sub = frame.value.sub
  const names = (list: PlanBlock[]) => list.map((b) => `${b.label}（Disk ${b.disk + 1}）`).join('、')
  switch (s.kind) {
    case 'missing':
      return t('raidPage.anim.missing', { blocks: names(s.blocks) })
    case 'lost':
      return t(`raidPage.anim.lost${props.level === 0 ? '0' : ''}`, { blocks: names(s.blocks) })
    case 'read':
      return t('raidPage.anim.read', { blocks: names(s.blocks) })
    case 'copy':
      return sub === 0 ? t('raidPage.anim.copy0', { from: names([s.from]) }) : t('raidPage.anim.copy1', { block: s.to.label, bits: toBits(s.to.value) })
    case 'xor': {
      if (sub === 0) return t('raidPage.anim.xor0', { target: s.to.label, rows: s.rows.map((r) => r.label).join(' ⊕ ') })
      if (sub <= 4) {
        const col = sub - 1
        const n = ones(s.rows, col)
        return t('raidPage.anim.xorCol', { col: col + 1, n, parity: t(n % 2 ? 'raidPage.anim.odd' : 'raidPage.anim.even'), bit: n % 2 })
      }
      return t('raidPage.anim.xorDone', { target: s.to.label, bits: toBits(s.to.value) })
    }
    case 'q-calc':
      return t(`raidPage.anim.q${sub}`, { target: s.to.label, bits: toBits(s.to.value) })
    case 'q-solve-one':
      return sub === 0 ? t('raidPage.anim.qOne0', { target: s.to.label }) : t('raidPage.anim.qOne1', { target: s.to.label, bits: toBits(s.to.value) })
    case 'pq-solve':
      return t(`raidPage.anim.pq${sub}`, { x: s.x.label, y: s.y.label, a: toBits(s.a), b: toBits(s.b), xv: toBits(s.x.value), yv: toBits(s.y.value) })
    case 'write':
      return t('raidPage.anim.write', { blocks: s.blocks.map((b) => `${b.label} = ${toBits(b.value)}`).join('、') })
  }
  return ''
})

/** Values checked against the formula, for the tick shown on the result. */
const pqCheck = computed(() => (step.value.kind === 'pq-solve' ? solvePQ(step.value.a, step.value.b, step.value.wx, step.value.wy) : null))
</script>

<template>
  <div class="space-y-3 rounded-lg border border-accent/40 bg-surface p-4">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="mr-auto text-sm font-semibold">
        {{ stripes.length > 1 ? t('raidPage.anim.rebuildTitle', { n: frame.stripeIndex + 1, total: stripes.length }) : t('raidPage.anim.title', { n: stripe + 1 }) }}
      </h3>
      <button class="btn px-2 py-1" :disabled="index === 0" :aria-label="t('common.prev')" @click="go(-1)"><ChevronLeft class="size-4" /></button>
      <button class="btn btn-primary px-2 py-1" :aria-label="playing ? t('common.pause') : t('common.play')" @click="playing ? pause() : play()">
        <Pause v-if="playing" class="size-4" />
        <Play v-else class="size-4" />
      </button>
      <button class="btn px-2 py-1" :disabled="isLastFrame" :aria-label="t('common.next')" @click="go(1)"><ChevronRight class="size-4" /></button>
      <button class="btn px-2 py-1" :aria-label="t('common.restart')" @click="restart"><RotateCcw class="size-4" /></button>
      <select v-model="speed" class="field w-auto py-1 text-xs" :aria-label="t('raidPage.anim.speed')">
        <option v-for="s in ['slow', 'normal', 'fast'] as const" :key="s" :value="s">{{ t(`raidPage.anim.speeds.${s}`) }}</option>
      </select>
      <span class="font-mono text-xs text-muted">{{ index + 1 }} / {{ frames.length }}</span>
    </div>

    <!-- The stripe across all disks -->
    <div class="overflow-x-auto">
      <div class="flex gap-2">
        <div v-for="d in disks" :key="d" class="w-20 shrink-0 text-center">
          <div class="mb-1 text-[11px] text-muted">
            Disk {{ d }}
            <span v-if="failed.has(d - 1)" :class="writtenNow ? 'rounded bg-ok px-1 text-white' : 'text-err'">{{ writtenNow ? t('raidPage.anim.newDisk') : '✕' }}</span>
          </div>
          <div
            :key="`${frame.stripeIndex}-${cell(d - 1).tone}`"
            class="anim-fade flex h-14 flex-col items-center justify-center rounded border-2 font-mono text-xs transition-all duration-500"
            :class="{
              'border-dashed border-err bg-err-soft text-err': cell(d - 1).tone === 'lost' || cell(d - 1).tone === 'gone',
              'scale-105 border-ok bg-ok-soft text-ok shadow-[0_0_0_3px_var(--ok-soft)]': cell(d - 1).tone === 'read',
              'scale-105 border-ok bg-ok text-white': cell(d - 1).tone === 'rebuilt',
              'border-line bg-surface-2': cell(d - 1).tone === 'normal',
            }"
          >
            <span class="font-semibold">{{ cell(d - 1).label }}</span>
            <span class="tracking-widest">{{ cell(d - 1).bits }}</span>
          </div>
          <div class="mt-1 h-4 text-[10px]">
            <span v-if="cell(d - 1).tone === 'read'" class="text-ok">▼ {{ t('raidPage.anim.reading') }}</span>
            <span v-else-if="cell(d - 1).tone === 'rebuilt'" class="text-ok">✓ {{ t('raidPage.anim.rebuilt') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Calculation -->
    <div :key="`${frame.stripeIndex}-${frame.stepIndex}`" class="anim-slide min-h-28 rounded-md bg-surface-2 p-3 font-mono text-sm">
      <!-- XOR, bit by bit -->
      <table v-if="step.kind === 'xor'" class="mx-auto">
        <tbody>
          <tr v-for="(r, i) in step.rows" :key="r.label">
            <td class="pr-3 text-right text-xs text-muted">{{ i === 0 ? '' : '⊕' }} {{ r.label }}</td>
            <td
              v-for="(bit, c) in bitsOf(r)"
              :key="c"
              class="w-7 text-center transition-colors"
              :class="[c === frame.sub - 1 ? 'bg-accent-soft font-bold text-accent' : '', bit === '1' ? '' : 'text-muted']"
            >
              {{ bit }}
            </td>
          </tr>
          <tr class="border-t-2 border-fg/40">
            <td class="pt-1 pr-3 text-right text-xs font-semibold text-ok">= {{ step.to.label }}</td>
            <td v-for="(bit, c) in bitsOf(step.to)" :key="c" class="w-7 pt-1 text-center font-bold" :class="c === frame.sub - 1 ? 'bg-accent-soft text-accent' : 'text-ok'">
              <span v-if="c < revealed || frame.sub >= 5" class="anim-fade inline-block">{{ bit }}</span>
              <span v-else class="text-muted">·</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mirror copy -->
      <div v-else-if="step.kind === 'copy'" class="flex flex-wrap items-center justify-center gap-3">
        <span class="rounded border border-ok px-2 py-1 text-ok">Disk {{ step.from.disk + 1 }} · {{ step.from.label }} {{ toBits(step.from.value) }}</span>
        <span class="text-xl" :class="frame.sub ? 'text-ok' : 'text-muted'">──{{ t('raidPage.anim.copyArrow') }}──▶</span>
        <span class="rounded border px-2 py-1" :class="frame.sub ? 'anim-fade border-ok bg-ok text-white' : 'border-dashed border-err text-err'">
          Disk {{ step.to.disk + 1 }} · {{ step.to.label }} {{ frame.sub ? toBits(step.to.value) : '????' }}
        </span>
      </div>

      <!-- RAID 6 Q recomputed -->
      <table v-else-if="step.kind === 'q-calc'" class="mx-auto text-xs">
        <tbody>
          <tr v-for="(term, i) in step.terms" :key="term.block.label">
            <td class="pr-2 text-right text-muted">{{ i === 0 ? '' : '⊕' }}</td>
            <td class="pr-2">{{ w(term.weight) }} × {{ term.block.label }}</td>
            <td class="pr-2 text-muted">= {{ toBits(term.weight) }} × {{ toBits(term.block.value) }}</td>
            <td :class="frame.sub >= 1 ? 'anim-fade font-semibold' : 'invisible'">= {{ toBits(term.product) }}</td>
          </tr>
          <tr class="border-t-2 border-fg/40">
            <td />
            <td class="pt-1 font-semibold text-ok" colspan="2">= {{ step.to.label }}</td>
            <td class="pt-1 font-bold text-ok" :class="frame.sub >= 2 ? 'anim-fade' : 'invisible'">{{ toBits(step.to.value) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- RAID 6: data + P lost, Q alone -->
      <div v-else-if="step.kind === 'q-solve-one'" class="space-y-1 text-center">
        <div>{{ w(step.weight) }} × {{ step.to.label }} = Q ⊕ (…) = <b>{{ toBits(step.known) }}</b></div>
        <div v-if="frame.sub >= 1" class="anim-fade font-bold text-ok">
          {{ step.to.label }} = {{ toBits(step.known) }} ÷ {{ toBits(step.weight) }} = {{ toBits(gfDiv(step.known, step.weight)) }}
        </div>
      </div>

      <!-- RAID 6: two data blocks, two equations -->
      <div v-else-if="step.kind === 'pq-solve'" class="space-y-1.5 text-center">
        <div>{{ t('raidPage.anim.unknowns', { x: step.x.label, y: step.y.label }) }}</div>
        <div v-if="frame.sub >= 1" class="anim-fade">
          <span class="text-accent">P</span>：{{ step.x.label }} ⊕ {{ step.y.label }} = <b>{{ toBits(step.a) }}</b>
        </div>
        <div v-if="frame.sub >= 2" class="anim-fade">
          <span class="text-warn">Q</span>：{{ w(step.wx) }}×{{ step.x.label }} ⊕ {{ w(step.wy) }}×{{ step.y.label }} = <b>{{ toBits(step.b) }}</b>
        </div>
        <div v-if="frame.sub >= 3 && pqCheck" class="anim-fade font-bold text-ok">
          {{ step.x.label }} = {{ toBits(pqCheck.x) }}，{{ step.y.label }} = {{ toBits(step.a) }} ⊕ {{ toBits(pqCheck.x) }} = {{ toBits(pqCheck.y) }}
        </div>
      </div>

      <!-- Lists -->
      <div v-else-if="step.kind === 'read'" class="flex flex-wrap justify-center gap-2">
        <span v-for="(b, i) in step.blocks" :key="b.label" class="anim-slide rounded border border-ok px-2 py-1 text-ok" :style="{ animationDelay: `${i * 150}ms` }">
          Disk {{ b.disk + 1 }} · {{ b.label }} = {{ toBits(b.value) }}
        </span>
      </div>
      <div v-else-if="step.kind === 'write'" class="flex flex-wrap justify-center gap-2">
        <span v-for="b in step.blocks" :key="b.label" class="anim-fade rounded bg-ok px-2 py-1 text-white">✓ {{ b.label }} = {{ toBits(b.value) }} → Disk {{ b.disk + 1 }}</span>
      </div>
      <div v-else-if="step.kind === 'lost'" class="text-center text-err">
        <div class="text-2xl">✕</div>
        <div class="font-sans text-xs">{{ t('raidPage.anim.lostHint') }}</div>
      </div>
      <div v-else class="flex h-full items-center justify-center gap-2 text-err">
        <span v-for="b in step.blocks" :key="b.label" class="rounded border border-dashed border-err px-2 py-1">{{ b.label }} = ????</span>
      </div>
    </div>

    <p class="min-h-12 text-sm leading-relaxed" aria-live="polite">{{ caption }}</p>
  </div>
</template>
