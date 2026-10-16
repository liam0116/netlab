<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, Boxes, Download, Grid3x3, Image as ImageIcon, LayoutGrid, Plus, Server, Trash2, X } from 'lucide-vue-next'
import NumberInput from '@/components/common/NumberInput.vue'
import DeviceEditor from '@/components/project/DeviceEditor.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import RackElevation from '@/components/project/RackElevation.vue'
import RackFloorPlan from '@/components/project/RackFloorPlan.vue'
import { floorLayout, gridRackName, nextFreeRow, rowLetter } from '@/utils/floor'
import { ARCHITECTURES, bom, defaultOptions, nodeLimits, planArchitecture, storageLimits, validOptions, type ArchitectureKind } from '@/utils/architecture'
import { useConfirm } from '@/composables/useConfirm'
import { useProjectStore } from '@/stores/project'
import { itemTop, RACK_LIMITS, RACK_TEMPLATES, rackTotals } from '@/utils/rack'
import { downloadPng, downloadSvg } from '@/utils/svgExport'
import { slugify } from '@/utils/download'
import { deviceGuide } from '@/i18n/content'
import type { AppLocale } from '@/i18n'

const project = useProjectStore()
const { t, locale } = useI18n()
const guide = computed(() => deviceGuide[locale.value as AppLocale].devices)
const { armed, confirm } = useConfirm()

const selectedRackId = ref<string | null>(project.racks[0]?.id ?? null)
const selectedItemId = ref<string | null>(null)
const fullMessage = ref<string | null>(null)
const elevations = ref<Record<string, InstanceType<typeof RackElevation> | null>>({})

watch(
  () => project.racks.map((r) => r.id),
  (ids) => {
    if (!selectedRackId.value || !ids.includes(selectedRackId.value)) selectedRackId.value = ids[0] ?? null
  },
)

const rack = computed(() => project.racks.find((r) => r.id === selectedRackId.value) ?? null)
const item = computed(() => project.rackItems.find((i) => i.id === selectedItemId.value) ?? null)
const issues = computed(() => (rack.value ? (project.rackIssues.get(rack.value.id) ?? []) : []))
const problemIds = computed(() => new Set(issues.value.filter((i) => i.level === 'error').flatMap((i) => i.itemIds)))

function addRack(): void {
  selectedRackId.value = project.addRack().id
}

const rackNumberFields = ['heightU', 'pduCapacityW', 'voltage', 'maxWeightKg'] as const
const GRID_LIMITS = { rows: { min: 1, max: 26, integer: true }, cols: { min: 1, max: 40, integer: true } } as const

// --- Batch: a whole room of racks (rows × columns) in one click -------------------
const GRID_PRESETS = [
  [3, 4],
  [2, 5],
  [2, 10],
  [1, 4],
] as const
const showGrid = ref(false)
const grid = reactive({ rows: 3, cols: 4, heightU: 42, pduCapacityW: 7000, voltage: 230, maxWeightKg: 1200 })
const inLimits = (v: number, l: { min: number; max: number; integer?: boolean }) => Number.isFinite(v) && v >= l.min && v <= l.max && (!l.integer || Number.isInteger(v))
const gridValid = computed(() => inLimits(grid.rows, GRID_LIMITS.rows) && inLimits(grid.cols, GRID_LIMITS.cols) && rackNumberFields.every((f) => inLimits(grid[f], RACK_LIMITS[f])))
const gridPreview = computed(() => {
  const start = nextFreeRow(project.racks)
  return { count: grid.rows * grid.cols, first: gridRackName(start, 1), last: gridRackName(start + grid.rows - 1, grid.cols) }
})
const gridMessage = ref<string | null>(null)
function createGrid(): void {
  if (!gridValid.value) return
  const created = project.addRackGrid({ ...grid }, (letter, col) => t('rackPage.grid.location', { row: letter, col }))
  selectedRackId.value = created[0]?.id ?? selectedRackId.value
  gridMessage.value = t('rackPage.grid.created', { count: created.length, first: created[0]?.name ?? '', last: created.at(-1)?.name ?? '' })
  showGrid.value = false
}

// --- Architecture templates: three-tier / HCI / dHCI with every device they need ------
/** Open by default on an empty project: generating an architecture is the usual first step. */
const showArch = ref(project.racks.length === 0)
const archKind = ref<ArchitectureKind>('three-tier')
const arch = reactive(defaultOptions('three-tier'))
/** Switching architecture resets the counts and rack power to that architecture's defaults (e.g. 22 kW for GPU racks). */
function chooseArch(kind: ArchitectureKind): void {
  archKind.value = kind
  Object.assign(arch, defaultOptions(kind))
}
const archLimits = computed(() => nodeLimits(archKind.value))
const archStorageLimits = computed(() => storageLimits(archKind.value))
const archValid = computed(() => validOptions(archKind.value, arch))
/** Dry run with throwaway ids, so the bill of materials and rack count are shown before anything is created. */
const archPreview = computed(() => {
  if (!archValid.value) return null
  let n = 0
  const plan = planArchitecture(archKind.value, { ...arch }, {
    existingRacks: project.racks,
    existingItems: project.rackItems,
    row: nextFreeRow(project.racks),
    newId: (p) => `preview-${p}-${++n}`,
    location: () => '',
    rackName: gridRackName,
  })
  const lines = bom(plan.items, plan.roles)
  return {
    plan,
    lines,
    total: lines.reduce((acc, l) => ({ count: acc.count + l.count, u: acc.u + l.uHeight, power: acc.power + l.powerW }), { count: 0, u: 0, power: 0 }),
    first: plan.racks[0]?.name ?? '',
    last: plan.racks.at(-1)?.name ?? '',
  }
})
const archMessage = ref<string | null>(null)
function createArch(): void {
  if (!archPreview.value?.plan.ok) return
  const plan = project.addArchitecture(archKind.value, { ...arch }, (letter, col) => t('rackPage.grid.location', { row: letter, col }))
  if (!plan.ok) return
  selectedRackId.value = plan.racks[0]?.id ?? selectedRackId.value
  selectedItemId.value = null
  archMessage.value = t('rackPage.arch.created', { name: t(`rackPage.arch.kinds.${archKind.value}.name`), count: plan.racks.length, first: plan.racks[0]?.name ?? '', last: plan.racks.at(-1)?.name ?? '' })
  showArch.value = false
}

// --- Floor plan --------------------------------------------------------------------
const floor = computed(() => floorLayout(project.racks, project.rackItems))
const floorPlan = ref<InstanceType<typeof RackFloorPlan> | null>(null)
async function selectFromFloor(id: string): Promise<void> {
  selectItem(id, null)
  await nextTick()
  document.getElementById(`rack-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}
function exportFloor(kind: 'svg' | 'png'): void {
  const svg = floorPlan.value?.svg
  if (!svg) return
  const name = `${slugify(project.title, 'project')}-floor-plan`
  if (kind === 'svg') downloadSvg(svg, `${name}.svg`)
  else void downloadPng(svg, `${name}.png`)
}
const ROW_CHOICES = Array.from({ length: 26 }, (_, i) => i)
function setRow(value: string): void {
  if (!rack.value) return
  const row = value === '' ? null : Number(value)
  project.updateRack(rack.value.id, { row, col: row === null ? null : (rack.value.col ?? 1) })
}
function removeRack(): void {
  if (rack.value && confirm('rack')) project.removeRack(rack.value.id)
}
function addDevice(key: string): void {
  if (!rack.value) return
  const added = project.addItem(rack.value.id, key)
  fullMessage.value = added ? null : t('rackPage.rackFull', { rack: rack.value.name })
  if (added) selectedItemId.value = added.id
}
function selectItem(rackId: string, id: string | null): void {
  selectedRackId.value = rackId
  selectedItemId.value = id
}

const kw = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`)

function exportRack(kind: 'svg' | 'png'): void {
  const svg = rack.value ? elevations.value[rack.value.id]?.svg : null
  if (!svg || !rack.value) return
  const name = `${slugify(project.title, 'project')}-${slugify(rack.value.name, 'rack')}`
  if (kind === 'svg') downloadSvg(svg, `${name}.svg`)
  else void downloadPng(svg, `${name}.png`)
}

/** The rack cannot be made lower than its highest installed device. */
const highestU = computed(() => (rack.value ? Math.max(0, ...project.rackItems.filter((i) => i.rackId === rack.value!.id).map(itemTop)) : 0))
function rackLimits(f: (typeof rackNumberFields)[number]) {
  return f === 'heightU' ? { ...RACK_LIMITS.heightU, min: Math.max(RACK_LIMITS.heightU.min, highestU.value) } : RACK_LIMITS[f]
}
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('rackPage.title')" :description="t('rackPage.desc')" :icon="Server">
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-primary px-2 py-1 text-xs" @click="((showArch = !showArch), (showGrid = false))">
            <Boxes class="size-3.5" /> {{ t('rackPage.arch.button') }}
          </button>
          <button class="btn px-2 py-1 text-xs" @click="addRack"><Plus class="size-3.5" /> {{ t('rackPage.addRack') }}</button>
          <button class="btn px-2 py-1 text-xs" :class="{ 'border-accent text-accent': showGrid }" @click="((showGrid = !showGrid), (showArch = false))">
            <Grid3x3 class="size-3.5" /> {{ t('rackPage.grid.button') }}
          </button>
          <template v-if="rack">
            <button class="btn px-2 py-1 text-xs" @click="exportRack('svg')"><Download class="size-3.5" /> {{ t('projectCommon.exportSvg') }}</button>
            <button class="btn px-2 py-1 text-xs" @click="exportRack('png')"><ImageIcon class="size-3.5" /> {{ t('projectCommon.exportPng') }}</button>
          </template>
        </div>
      </template>
    </PageHeader>

    <!-- Architecture templates -->
    <section v-if="showArch" class="card space-y-4 p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ t('rackPage.arch.title') }}</h2>
        <button class="rounded p-1 text-muted hover:text-fg" :aria-label="t('common.closeMenu')" @click="showArch = false"><X class="size-4" /></button>
      </div>
      <p class="text-sm text-muted">{{ t('rackPage.arch.intro') }}</p>

      <div class="grid gap-3 lg:grid-cols-3" role="radiogroup" :aria-label="t('rackPage.arch.title')">
        <button
          v-for="(k, i) in ARCHITECTURES"
          :key="k"
          type="button"
          role="radio"
          :aria-checked="archKind === k"
          class="rounded-lg border p-3 text-left text-xs transition-colors"
          :class="archKind === k ? 'border-accent bg-accent-soft/40' : 'border-line hover:border-accent/60'"
          @click="chooseArch(k)"
        >
          <div class="text-sm font-semibold" :class="archKind === k ? 'text-accent' : ''">
            <span class="mr-1 font-mono text-muted">{{ i + 1 }}.</span>{{ t(`rackPage.arch.kinds.${k}.name`) }}
          </div>
          <div class="mb-2 font-mono text-[11px] text-muted">{{ t(`rackPage.arch.kinds.${k}.en`) }}</div>
          <p class="text-fg/85">{{ t(`rackPage.arch.kinds.${k}.what`) }}</p>
          <template v-if="archKind === k">
            <p class="mt-2"><span class="font-semibold text-ok">＋</span> {{ t(`rackPage.arch.kinds.${k}.pros`) }}</p>
            <p class="mt-1"><span class="font-semibold text-warn">－</span> {{ t(`rackPage.arch.kinds.${k}.cons`) }}</p>
            <p class="mt-1 text-muted">{{ t(`rackPage.arch.kinds.${k}.when`) }}</p>
            <p class="mt-1 text-muted">{{ t(`rackPage.arch.kinds.${k}.examples`) }}</p>
          </template>
        </button>
      </div>

      <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <NumberInput
          id="ar-nodes"
          v-model="arch.nodes"
          :label="t(`rackPage.arch.nodes.${archKind}`)"
          :min="archLimits.min"
          :max="archLimits.max"
          integer
          :disabled="archLimits.min === archLimits.max"
        />
        <NumberInput v-if="archStorageLimits" id="ar-storage" v-model="arch.storage" :label="t(`rackPage.arch.storage.${archKind}`)" v-bind="archStorageLimits" integer />
        <NumberInput v-for="f in rackNumberFields" :id="`ar-${f}`" :key="f" v-model="arch[f]" :label="t(`rackPage.rackFields.${f}`)" v-bind="RACK_LIMITS[f]" />
      </div>

      <template v-if="archPreview">
        <p v-if="!archPreview.plan.ok" class="text-sm text-err">{{ t('rackPage.arch.errors.node-too-big') }}</p>
        <template v-else>
          <div class="overflow-x-auto rounded-md border border-line">
            <table class="w-full min-w-[520px] text-xs">
              <caption class="border-b border-line bg-surface-2 px-3 py-2 text-left text-sm font-semibold">{{ t('rackPage.arch.bom') }}</caption>
              <thead class="text-left text-muted">
                <tr>
                  <th class="px-3 py-1.5 font-medium">{{ t('rackPage.arch.cols.role') }}</th>
                  <th class="px-3 py-1.5 font-medium">{{ t('rackPage.arch.cols.model') }}</th>
                  <th class="px-3 py-1.5 text-right font-medium">{{ t('rackPage.arch.cols.count') }}</th>
                  <th class="px-3 py-1.5 text-right font-medium">{{ t('rackPage.arch.cols.u') }}</th>
                  <th class="px-3 py-1.5 text-right font-medium">{{ t('rackPage.arch.cols.power') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in archPreview.lines" :key="l.role" class="border-t border-line">
                  <td class="px-3 py-1.5">{{ t(`rackPage.arch.roles.${l.role}`) }}</td>
                  <td class="px-3 py-1.5 text-muted">{{ l.model }}</td>
                  <td class="px-3 py-1.5 text-right font-mono">{{ l.count }}</td>
                  <td class="px-3 py-1.5 text-right font-mono">{{ l.uHeight }}U</td>
                  <td class="px-3 py-1.5 text-right font-mono">{{ kw(l.powerW) }}</td>
                </tr>
                <tr class="border-t border-line font-semibold">
                  <td class="px-3 py-1.5" colspan="2">{{ t('rackPage.arch.total') }}</td>
                  <td class="px-3 py-1.5 text-right font-mono">{{ archPreview.total.count }}</td>
                  <td class="px-3 py-1.5 text-right font-mono">{{ archPreview.total.u }}U</td>
                  <td class="px-3 py-1.5 text-right font-mono">{{ kw(archPreview.total.power) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button class="btn btn-primary px-3 py-1.5 text-sm" @click="createArch">
              <LayoutGrid class="size-4" /> {{ t('rackPage.arch.create', { count: archPreview.plan.racks.length }) }}
            </button>
            <span class="text-xs text-muted">
              {{ t('rackPage.arch.preview', { count: archPreview.plan.racks.length, first: archPreview.first, last: archPreview.last, devices: archPreview.total.count, power: kw(archPreview.total.power) }) }}
            </span>
          </div>
        </template>
      </template>
      <p class="text-xs text-muted">{{ t('rackPage.arch.hint') }}</p>
    </section>
    <p v-if="archMessage" class="text-sm text-ok">✓ {{ archMessage }}</p>

    <!-- Batch create -->
    <section v-if="showGrid" class="card space-y-3 p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ t('rackPage.grid.title') }}</h2>
        <button class="rounded p-1 text-muted hover:text-fg" :aria-label="t('common.closeMenu')" @click="showGrid = false"><X class="size-4" /></button>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
        {{ t('rackPage.grid.presets') }}
        <button
          v-for="[r, c] in GRID_PRESETS"
          :key="`${r}x${c}`"
          class="kbd hover:text-accent"
          :class="{ 'border-accent text-accent': grid.rows === r && grid.cols === c }"
          @click="((grid.rows = r), (grid.cols = c))"
        >
          {{ t('rackPage.grid.preset', { rows: r, cols: c, count: r * c }) }}
        </button>
      </div>
      <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <NumberInput id="gr-rows" v-model="grid.rows" :label="t('rackPage.grid.rows')" v-bind="GRID_LIMITS.rows" />
        <NumberInput id="gr-cols" v-model="grid.cols" :label="t('rackPage.grid.cols')" v-bind="GRID_LIMITS.cols" />
        <NumberInput v-for="f in rackNumberFields" :id="`gr-${f}`" :key="f" v-model="grid[f]" :label="t(`rackPage.rackFields.${f}`)" v-bind="RACK_LIMITS[f]" />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button class="btn btn-primary px-3 py-1.5 text-sm" :disabled="!gridValid" @click="createGrid">
          <LayoutGrid class="size-4" /> {{ t('rackPage.grid.create', { count: gridPreview.count }) }}
        </button>
        <span class="text-xs text-muted">{{ t('rackPage.grid.preview', gridPreview) }}</span>
      </div>
      <p class="text-xs text-muted">{{ t('rackPage.grid.hint') }}</p>
    </section>
    <p v-if="gridMessage" class="text-sm text-ok">✓ {{ gridMessage }}</p>

    <p v-if="!project.racks.length" class="card p-6 text-center text-sm text-muted">{{ t('rackPage.noRack') }}</p>

    <template v-else>
      <!-- Floor plan -->
      <section v-if="floor.rows.length" class="card p-4">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <h2 class="mr-auto font-semibold">{{ t('rackPage.floor.title') }}</h2>
          <button class="btn px-2 py-1 text-xs" @click="exportFloor('svg')"><Download class="size-3.5" /> {{ t('projectCommon.exportSvg') }}</button>
          <button class="btn px-2 py-1 text-xs" @click="exportFloor('png')"><ImageIcon class="size-3.5" /> {{ t('projectCommon.exportPng') }}</button>
        </div>
        <p class="mb-3 text-xs text-muted">{{ t('rackPage.floor.hint') }}</p>
        <div class="overflow-x-auto">
          <RackFloorPlan ref="floorPlan" :racks="project.racks" :items="project.rackItems" :selected-id="selectedRackId" @select="selectFromFloor" />
        </div>
        <p v-if="floor.conflicts.length" class="mt-2 text-xs text-err">
          {{ t('rackPage.floor.conflict', { racks: floor.conflicts.map((r) => r.name).join(', ') }) }}
        </p>
        <p v-if="floor.unplaced.length" class="mt-2 text-xs text-muted">
          {{ t('rackPage.floor.unplaced', { racks: floor.unplaced.map((r) => r.name).join(', ') }) }}
        </p>
      </section>

      <!-- Device palette -->
      <section v-if="rack" class="card p-3">
        <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span class="mr-auto">{{ t('rackPage.addDevice', { rack: rack.name }) }}</span>
          <RouterLink to="/reference/devices" class="inline-flex items-center gap-1 text-accent hover:underline">
            <BookOpen class="size-3.5" /> {{ t('rackPage.guideLink') }}
          </RouterLink>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="(tpl, key) in RACK_TEMPLATES"
            :key="key"
            class="btn px-2 py-1 text-xs"
            :title="`${guide[key]?.name} — ${guide[key]?.what}`"
            @click="addDevice(String(key))"
          >
            <Plus class="size-3" /> {{ tpl.model }}
          </button>
        </div>
        <p v-if="fullMessage" class="mt-2 text-xs text-err">{{ fullMessage }}</p>
      </section>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <!-- Racks side by side; each card keeps its own height instead of stretching to the inspector beside it. -->
        <div class="flex items-start gap-4 overflow-x-auto pb-2">
          <div
            v-for="r in project.racks"
            :id="`rack-card-${r.id}`"
            :key="r.id"
            class="card w-[320px] shrink-0 p-3 transition-colors"
            :class="r.id === selectedRackId ? 'border-accent' : ''"
            @click.self="selectItem(r.id, null)"
          >
            <RackElevation
              :ref="(el) => (elevations[r.id] = el as InstanceType<typeof RackElevation> | null)"
              :rack="r"
              :items="project.rackItems"
              :selected-id="selectedItemId"
              :problem-ids="r.id === selectedRackId ? problemIds : new Set<string>()"
              @select="(id) => selectItem(r.id, id)"
              @move="(id, u) => project.updateItem(id, { uPosition: u })"
            />
            <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <template v-for="tt in [rackTotals(r, project.rackItems)]" :key="r.id">
                <dt class="text-muted">{{ t('rackPage.totals.power') }}</dt>
                <dd class="text-right font-mono">{{ kw(tt.powerW) }} · {{ tt.amps.toFixed(1) }} A</dd>
                <dt class="text-muted">{{ t('rackPage.totals.feedA') }} / {{ t('rackPage.totals.feedB') }}</dt>
                <dd class="text-right font-mono">{{ kw(tt.feedA) }} / {{ kw(tt.feedB) }}</dd>
                <dt class="text-muted">{{ t('rackPage.totals.failover') }}</dt>
                <dd class="text-right font-mono" :class="Math.max(tt.failoverA, tt.failoverB) > r.pduCapacityW ? 'text-warn' : ''">
                  {{ kw(Math.max(tt.failoverA, tt.failoverB)) }} / {{ kw(r.pduCapacityW) }}
                </dd>
                <dt class="text-muted">{{ t('rackPage.totals.heat') }}</dt>
                <dd class="text-right font-mono">{{ Math.round(tt.btuPerHour).toLocaleString() }} BTU/h</dd>
                <dt class="text-muted">{{ t('rackPage.totals.weight') }}</dt>
                <dd class="text-right font-mono">{{ Math.round(tt.weightKg) }} / {{ r.maxWeightKg }} kg</dd>
                <dt class="text-muted">{{ t('rackPage.totals.space') }}</dt>
                <dd class="text-right">{{ t('rackPage.totals.spaceValue', { used: tt.usedU, free: tt.freeU }) }}</dd>
              </template>
            </dl>
          </div>
        </div>

        <!-- Inspector -->
        <aside class="space-y-4">
          <DeviceEditor v-if="item" :key="item.id" :item-id="item.id" @removed="selectedItemId = null" />

          <section v-else-if="rack" class="card space-y-3 p-4">
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">{{ t('rackPage.rackSettings') }}</h2>
              <button class="btn px-2 py-1 text-xs" :class="{ 'border-err bg-err-soft text-err': armed === 'rack' }" @click="removeRack">
                <Trash2 class="size-3.5" /> {{ armed === 'rack' ? t('projectCommon.confirmAgain') : t('rackPage.removeRack') }}
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="rk-name" class="label normal-case">{{ t('rackPage.rackFields.name') }}</label>
                <input id="rk-name" v-model="rack.name" class="field py-1.5" maxlength="80" />
              </div>
              <div>
                <label for="rk-loc" class="label normal-case">{{ t('rackPage.rackFields.location') }}</label>
                <input id="rk-loc" v-model="rack.location" class="field py-1.5" maxlength="120" />
              </div>
              <NumberInput
                v-for="f in rackNumberFields"
                :id="`rk-${f}`"
                :key="f"
                :model-value="rack[f]"
                :label="t(`rackPage.rackFields.${f}`)"
                v-bind="rackLimits(f)"
                :hint="f === 'heightU' && highestU > 1 ? t('rackPage.heightHint', { u: highestU }) : undefined"
                @update:model-value="(v) => project.updateRack(rack!.id, { [f]: v })"
              />
              <div>
                <label for="rk-row" class="label normal-case">{{ t('rackPage.rackFields.row') }}</label>
                <select id="rk-row" class="field py-1.5" :value="rack.row ?? ''" @change="setRow(($event.target as HTMLSelectElement).value)">
                  <option value="">{{ t('rackPage.rackFields.rowNone') }}</option>
                  <option v-for="i in ROW_CHOICES" :key="i" :value="i">Row {{ rowLetter(i) }}</option>
                </select>
              </div>
              <NumberInput
                id="rk-col"
                :model-value="rack.col ?? 1"
                :label="t('rackPage.rackFields.col')"
                :min="1"
                :max="99"
                integer
                :disabled="rack.row === null"
                @update:model-value="(v) => project.updateRack(rack!.id, { col: v })"
              />
            </div>
            <p class="text-xs text-muted">{{ t('rackPage.selectHint') }}</p>
          </section>

          <section v-if="rack" class="card p-4">
            <h2 class="mb-2 font-semibold">{{ t('projectCommon.issues') }} · {{ rack.name }}</h2>
            <p v-if="!issues.length" class="text-sm text-ok">{{ t('projectCommon.noIssues') }}</p>
            <ul v-else class="space-y-1.5 text-sm">
              <li v-for="(i, n) in issues" :key="n" class="flex gap-2">
                <span class="mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-semibold" :class="i.level === 'error' ? 'bg-err-soft text-err' : 'bg-warn-soft text-warn'">
                  {{ t(`projectCommon.levels.${i.level}`) }}
                </span>
                <span>{{ t(`rackPage.issues.${i.code}`, i.params) }}</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
