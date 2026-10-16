<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, ClipboardPaste, Copy, Download, FileSpreadsheet, FolderKanban, Plus, RotateCcw, Sparkles, Tags, Trash2, Upload } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useLabelTemplate } from '@/composables/useLabelTemplate'
import { MAX_LABELS, useCableLabelsStore } from '@/stores/cableLabels'
import { useProjectStore } from '@/stores/project'
import { END_MARKS, generateLabels, labelsFromCables, parsePasted, sheetFileName } from '@/utils/cableLabels'
import { downloadBlob } from '@/utils/download'
import { labelSheets, type LabelText } from '@/utils/labelWorkbook'

const store = useCableLabelsStore()
const project = useProjectStore()
const { t, tm, rt } = useI18n()
const { armed, confirm } = useConfirm()
const template = useLabelTemplate()
onMounted(() => template.restore())

/** Labels per row on the printed sheet (5 × 6 on A4). */
const PER_ROW = 5
/** Longer labels usually need a smaller font in Excel. */
const LONG_LABEL = 20
const SEPARATORS = ['_', '-', '.', ''] as const

const notice = ref<{ variant: 'ok' | 'err'; text: string } | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function flash(variant: 'ok' | 'err', text: string): void {
  notice.value = { variant, text }
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = null), 5000)
}
onBeforeUnmount(() => clearTimeout(noticeTimer))

const list = (key: string): string[] => {
  const v = tm(key) as unknown
  return Array.isArray(v) ? v.map((x) => rt(x)) : []
}

function addAll(items: LabelText[]): void {
  if (!items.length) return
  const n = store.add(items)
  flash(n < items.length ? 'err' : 'ok', n < items.length ? t('labelsPage.full', { max: MAX_LABELS }) : t('labelsPage.added', { n }))
}

// Generate from a pattern
const generated = computed(() => generateLabels(store.pattern))
const PREVIEW = 8
function addGenerated(): void {
  addAll(generated.value)
}
function loadSample(): void {
  store.pattern.devices = t('labelsPage.sampleDevices')
  store.pattern.ports = t('labelsPage.samplePorts')
  addGenerated()
}

// Paste from Excel
const pasted = ref('')
const pastedLabels = computed(() => parsePasted(pasted.value, store.pattern.toSameAsFrom))
function addPasted(): void {
  addAll(pastedLabels.value)
  pasted.value = ''
}

// From the project's cabling list
const itemName = (id: string) => project.rackItems.find((i) => i.id === id)?.name ?? ''
const projectLabels = computed(() =>
  labelsFromCables(
    project.cables.map((c) => ({ aName: itemName(c.aItemId), aPort: c.aPort, bName: itemName(c.bItemId), bPort: c.bPort })),
    store.pattern.separator,
    store.pattern.letterCase,
  ),
)

// The list
const SHOWN = 120
const showAll = ref(false)
const shown = computed(() => (showAll.value ? store.labels : store.labels.slice(0, SHOWN)))
const capacity = computed(() => template.capacity.value)
function position(index: number): string {
  const within = index % capacity.value
  return t('labelsPage.list.position', { sheet: Math.floor(index / capacity.value) + 1, row: Math.floor(within / PER_ROW) + 1, col: (within % PER_ROW) + 1 })
}
function addOne(): void {
  const last = store.labels.at(-1)
  store.insertAfter(store.labels.length - 1, { from: last?.from ?? '', to: last?.to ?? '' })
}
function clearAll(): void {
  if (confirm('clear')) store.clear()
}

// Sheets and export
const sheets = computed(() => labelSheets(store.labels, capacity.value))
const prefix = computed(() => store.filePrefix.trim() || t('labelsPage.file.prefixDefault'))
const fileName = (i: number) => sheetFileName(prefix.value, i + 1, sheets.value[i] ?? [], store.pattern.separator || '_')
const busy = ref(false)

async function exportSheet(i: number): Promise<boolean> {
  try {
    const name = fileName(i)
    downloadBlob(name, await template.build(sheets.value[i] ?? []))
    flash('ok', t('labelsPage.exported', { name }))
    return true
  } catch {
    flash('err', t('labelsPage.exportFailed'))
    return false
  }
}
async function exportAll(): Promise<void> {
  busy.value = true
  try {
    for (let i = 0; i < sheets.value.length; i++) {
      if (!(await exportSheet(i))) break
      // Browsers drop downloads started in the same instant.
      if (i < sheets.value.length - 1) await new Promise((r) => setTimeout(r, 700))
    }
  } finally {
    busy.value = false
  }
}
async function exportOne(i: number): Promise<void> {
  busy.value = true
  await exportSheet(i)
  busy.value = false
}

// Template
const templateInput = ref<HTMLInputElement | null>(null)
async function onTemplate(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const error = await template.useCustom(file)
  if (error && error !== 'storage') flash('err', t(`labelsPage.template.errors.${error}`))
  else flash(error ? 'err' : 'ok', error ? t('labelsPage.template.errors.storage') : t('labelsPage.template.saved', { name: file.name }))
}
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('labelsPage.title')" :description="t('labelsPage.desc')" :icon="Tags">
      <template #actions>
        <button class="btn btn-primary" :disabled="!store.labels.length || busy" @click="exportAll">
          <Download class="size-4" />
          {{ busy ? t('labelsPage.exporting') : sheets.length > 1 ? t('labelsPage.exportAll', { n: sheets.length }) : t('labelsPage.export') }}
        </button>
      </template>
    </PageHeader>

    <StatusBanner v-if="store.storageError" variant="warn" :title="t('labelsPage.storageError')" />
    <StatusBanner v-if="notice" :variant="notice.variant" :title="notice.text" />

    <!-- Generate (the usual way in) -->
    <section class="card space-y-3 p-4">
      <div>
        <h2 class="font-semibold">{{ t('labelsPage.gen.title') }}</h2>
        <p class="text-xs text-muted">{{ t('labelsPage.gen.hint') }}</p>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label for="lb-devices" class="label normal-case">{{ t('labelsPage.gen.devices') }}</label>
          <textarea id="lb-devices" v-model="store.pattern.devices" rows="2" class="field font-mono" maxlength="2000" :placeholder="t('labelsPage.gen.devicesPlaceholder')" />
          <p class="mt-1 text-xs text-muted">{{ t('labelsPage.gen.devicesHelp') }}</p>
        </div>
        <div>
          <label for="lb-ports" class="label normal-case">{{ t('labelsPage.gen.ports') }}</label>
          <textarea id="lb-ports" v-model="store.pattern.ports" rows="2" class="field font-mono" maxlength="2000" :placeholder="t('labelsPage.gen.portsPlaceholder')" />
          <p class="mt-1 text-xs text-muted">{{ t('labelsPage.gen.portsHelp') }}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label for="lb-sep" class="label normal-case">{{ t('labelsPage.gen.separator') }}</label>
          <select id="lb-sep" v-model="store.pattern.separator" class="field py-1.5 font-mono">
            <option v-for="s in SEPARATORS" :key="s" :value="s">{{ s || t('labelsPage.gen.sepNone') }}</option>
          </select>
        </div>
        <div>
          <label for="lb-copies" class="label normal-case">{{ t('labelsPage.gen.copies') }}</label>
          <select id="lb-copies" v-model.number="store.pattern.copies" class="field py-1.5">
            <option :value="2">{{ t('labelsPage.gen.copies2') }}</option>
            <option :value="1">{{ t('labelsPage.gen.copies1') }}</option>
          </select>
        </div>
        <div>
          <label for="lb-end" class="label normal-case">{{ t('labelsPage.gen.endMark') }}</label>
          <select id="lb-end" v-model="store.pattern.endMark" class="field py-1.5" :disabled="store.pattern.copies === 1">
            <option v-for="m in END_MARKS" :key="m" :value="m">{{ t(`labelsPage.gen.endMarks.${m}`) }}</option>
          </select>
        </div>
        <div>
          <label for="lb-case" class="label normal-case">{{ t('labelsPage.gen.letterCase') }}</label>
          <select id="lb-case" v-model="store.pattern.letterCase" class="field py-1.5">
            <option v-for="c in ['keep', 'upper', 'lower'] as const" :key="c" :value="c">{{ t(`labelsPage.gen.cases.${c}`) }}</option>
          </select>
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="store.pattern.toSameAsFrom" type="checkbox" class="accent-[var(--accent)]" />
        {{ t('labelsPage.gen.toSame') }}
      </label>
      <div class="rounded-md border border-line bg-surface-2 p-3 text-sm">
        <template v-if="generated.length">
          <div class="mb-1.5 text-xs text-muted">{{ t('labelsPage.gen.preview', { n: generated.length }) }}</div>
          <div class="flex flex-wrap gap-1.5">
            <code v-for="(l, i) in generated.slice(0, PREVIEW)" :key="i" class="rounded border border-line bg-surface px-1.5 py-0.5 text-xs break-all">{{ l.from }}</code>
            <span v-if="generated.length > PREVIEW" class="text-xs text-muted">{{ t('labelsPage.gen.more', { n: generated.length - PREVIEW }) }}</span>
          </div>
        </template>
        <p v-else class="text-xs text-muted">{{ t('labelsPage.gen.nothing') }}</p>
      </div>
      <button class="btn btn-primary" :disabled="!generated.length" @click="addGenerated"><Plus class="size-4" /> {{ t('labelsPage.gen.add', { n: generated.length }) }}</button>
    </section>

    <!-- Other ways in -->
    <div class="grid gap-5 lg:grid-cols-2">
      <section class="card space-y-2 p-4">
        <h2 class="font-semibold">{{ t('labelsPage.paste.title') }}</h2>
        <p class="text-xs text-muted">{{ t('labelsPage.paste.hint') }}</p>
        <label for="lb-paste" class="sr-only">{{ t('labelsPage.paste.label') }}</label>
        <textarea id="lb-paste" v-model="pasted" rows="4" class="field font-mono text-xs" :placeholder="'PeoEsxi21_PS1\tPeoEsxi21_PS1\nPeoEsxi21_PS2\tPeoEsxi21_PS2'" />
        <button class="btn" :disabled="!pastedLabels.length" @click="addPasted"><ClipboardPaste class="size-4" /> {{ t('labelsPage.paste.add', { n: pastedLabels.length }) }}</button>
      </section>
      <section class="card space-y-2 p-4">
        <h2 class="font-semibold">{{ t('labelsPage.project.title') }}</h2>
        <p class="text-xs text-muted">{{ t('labelsPage.project.hint') }}</p>
        <button v-if="project.cables.length" class="btn" @click="addAll(projectLabels)">
          <FolderKanban class="size-4" /> {{ t('labelsPage.project.add', { cables: project.cables.length, n: projectLabels.length }) }}
        </button>
        <p v-else class="text-xs text-muted">{{ t('labelsPage.project.none') }}</p>
      </section>
    </div>

    <!-- Label sheets: one file each -->
    <section v-if="store.labels.length" class="card space-y-3 p-4">
      <div>
        <h2 class="font-semibold">{{ t('labelsPage.sheets.title') }}</h2>
        <p class="text-xs text-muted">{{ t('labelsPage.sheets.hint') }}</p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="lb-prefix" class="label normal-case">{{ t('labelsPage.file.prefix') }}</label>
          <input id="lb-prefix" v-model="store.filePrefix" class="field w-48 py-1.5" maxlength="60" :placeholder="t('labelsPage.file.prefixDefault')" />
        </div>
        <p class="pb-2 text-xs break-all text-muted">{{ t('labelsPage.file.example', { name: fileName(0) }) }}</p>
      </div>
      <p v-if="sheets.length > 1" class="text-xs text-muted">{{ t('labelsPage.multiHint') }}</p>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="(sheet, s) in sheets" :key="s" class="rounded-md border border-line p-3">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <FileSpreadsheet class="size-4 text-accent" />
            <span class="text-sm font-semibold">{{ t('labelsPage.sheets.label', { n: s + 1 }) }}</span>
            <span class="text-xs text-muted">{{ t('labelsPage.sheets.range', { from: s * capacity + 1, to: s * capacity + sheet.length }) }}</span>
            <button class="btn ml-auto px-2 py-1 text-xs" :disabled="busy" @click="exportOne(s)"><Download class="size-3.5" /> {{ t('labelsPage.exportSheet') }}</button>
          </div>
          <div class="grid grid-cols-5 gap-0.5 rounded bg-line/40 p-0.5">
            <div
              v-for="k in capacity"
              :key="k"
              class="min-h-10 rounded-sm bg-surface p-1 font-mono text-[10px] leading-tight break-all"
              :class="sheet[k - 1] ? '' : 'opacity-40'"
            >
              <template v-if="sheet[k - 1]">
                <div class="font-semibold">{{ sheet[k - 1]!.from }}</div>
                <div v-if="sheet[k - 1]!.to && sheet[k - 1]!.to !== sheet[k - 1]!.from" class="text-muted">{{ sheet[k - 1]!.to }}</div>
              </template>
            </div>
          </div>
          <p class="mt-1 truncate text-[11px] text-muted" :title="fileName(s)">{{ fileName(s) }}</p>
        </div>
      </div>
    </section>

    <!-- Label list -->
    <section class="card space-y-3 p-4">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="font-semibold">{{ t('labelsPage.list.title') }}</h2>
        <span v-if="store.labels.length" class="text-xs text-muted">
          {{ t('labelsPage.list.summary', { n: store.labels.length, sheets: sheets.length, per: capacity }) }}
        </span>
        <button v-if="store.labels.length" class="btn ml-auto px-2 py-1 text-xs" :class="{ 'border-err bg-err-soft text-err': armed === 'clear' }" @click="clearAll">
          <Trash2 class="size-3.5" /> {{ armed === 'clear' ? t('labelsPage.confirmClear') : t('labelsPage.clearAll') }}
        </button>
      </div>

      <div v-if="!store.labels.length" class="space-y-3 rounded-md border border-dashed border-line p-6 text-center text-sm">
        <p class="font-medium">{{ t('labelsPage.emptyTitle') }}</p>
        <p class="text-muted">{{ t('labelsPage.emptyHint') }}</p>
        <button class="btn" @click="loadSample"><Sparkles class="size-4" /> {{ t('labelsPage.sample') }}</button>
      </div>

      <div v-else>
        <div class="hidden grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-2 text-xs text-muted sm:grid" aria-hidden="true">
          <span />
          <span>{{ t('labelsPage.list.from') }}</span>
          <span>{{ t('labelsPage.list.to') }}</span>
          <span class="w-[7.5rem]" />
        </div>
        <ol class="divide-y divide-line">
          <li v-for="(l, i) in shown" :key="l.id" class="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-1 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
            <span class="row-span-2 pt-2 text-right font-mono text-xs text-muted sm:row-span-1">{{ i + 1 }}</span>
            <div>
              <label :for="`lb-from-${l.id}`" class="sr-only">{{ t('labelsPage.list.from') }}</label>
              <input :id="`lb-from-${l.id}`" v-model="l.from" class="field py-1.5 font-mono text-sm" maxlength="80" :placeholder="t('labelsPage.list.from')" />
            </div>
            <div class="col-start-2 sm:col-start-auto">
              <label :for="`lb-to-${l.id}`" class="sr-only">{{ t('labelsPage.list.to') }}</label>
              <input :id="`lb-to-${l.id}`" v-model="l.to" class="field py-1.5 font-mono text-sm" maxlength="80" :placeholder="t('labelsPage.list.to')" />
            </div>
            <div class="col-start-2 flex flex-wrap items-center gap-1 sm:col-start-auto">
              <button class="btn px-1.5 py-1" :aria-label="t('labelsPage.list.up')" :disabled="i === 0" @click="store.move(i, -1)"><ArrowUp class="size-3.5" /></button>
              <button class="btn px-1.5 py-1" :aria-label="t('labelsPage.list.down')" :disabled="i === store.labels.length - 1" @click="store.move(i, 1)"><ArrowDown class="size-3.5" /></button>
              <button class="btn px-1.5 py-1" :aria-label="t('labelsPage.list.duplicate')" @click="store.insertAfter(i, l)"><Copy class="size-3.5" /></button>
              <button class="btn px-1.5 py-1" :aria-label="t('labelsPage.list.remove')" @click="store.remove(l.id)"><Trash2 class="size-3.5" /></button>
            </div>
            <p class="col-start-2 text-xs text-muted sm:col-span-3">
              {{ position(i) }}
              <span v-if="l.from.length > LONG_LABEL || l.to.length > LONG_LABEL" class="text-warn"> · {{ t('labelsPage.list.long') }}</span>
            </p>
          </li>
        </ol>
      </div>
      <div v-if="store.labels.length" class="flex flex-wrap gap-2">
        <button class="btn px-2 py-1 text-xs" @click="addOne"><Plus class="size-3.5" /> {{ t('labelsPage.list.add') }}</button>
        <button v-if="!showAll && store.labels.length > SHOWN" class="btn px-2 py-1 text-xs" @click="showAll = true">{{ t('labelsPage.list.showAll', { n: store.labels.length }) }}</button>
      </div>
      <p class="text-xs text-muted">{{ t('labelsPage.storageNote') }}</p>
    </section>

    <!-- Template -->
    <section class="card space-y-2 p-4">
      <h2 class="font-semibold">{{ t('labelsPage.template.title') }}</h2>
      <p class="text-sm">
        {{
          template.customName.value
            ? t('labelsPage.template.custom', { name: template.customName.value, n: capacity })
            : t('labelsPage.template.builtIn', { n: capacity })
        }}
      </p>
      <p class="text-xs text-muted">{{ t('labelsPage.template.hint') }}</p>
      <div class="flex flex-wrap gap-2">
        <button class="btn" @click="templateInput?.click()"><Upload class="size-4" /> {{ t('labelsPage.template.upload') }}</button>
        <button v-if="template.customName.value" class="btn" @click="template.useBuiltIn()"><RotateCcw class="size-4" /> {{ t('labelsPage.template.reset') }}</button>
        <input ref="templateInput" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hidden" :aria-label="t('labelsPage.template.upload')" @change="onTemplate" />
      </div>
    </section>

    <!-- Notes from the template, in plain words -->
    <div class="grid gap-5 lg:grid-cols-2">
      <section class="card space-y-2 p-4">
        <h2 class="font-semibold">{{ t('labelsPage.notes.title') }}</h2>
        <ol class="list-decimal space-y-1 pl-5 text-sm">
          <li v-for="(n, i) in list('labelsPage.notes.items')" :key="i">{{ n }}</li>
        </ol>
        <p class="text-xs text-muted">{{ t('labelsPage.notes.fileNote') }}</p>
      </section>
      <section class="card space-y-2 p-4">
        <h2 class="font-semibold">{{ t('labelsPage.printer.title') }}</h2>
        <p class="text-sm text-muted">{{ t('labelsPage.printer.intro') }}</p>
        <ol class="list-decimal space-y-1.5 pl-5 text-sm">
          <li v-for="(n, i) in list('labelsPage.printer.steps')" :key="i">{{ n }}</li>
        </ol>
        <div class="rounded-md border border-line bg-surface-2 p-3 text-xs">
          <div class="font-semibold">{{ t('labelsPage.printer.rowsTitle') }}</div>
          <p class="mt-1 text-muted">{{ t('labelsPage.printer.rows') }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
