<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, ArrowRight, ArrowLeftRight, Download, Plus, Printer, Sparkles, Trash2, Upload, Wrench } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import FlowchartDiagram from '@/components/project/FlowchartDiagram.vue'
import MaintenanceSheet from '@/components/project/MaintenanceSheet.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useMaintenanceText } from '@/composables/useMaintenanceText'
import { useMaintenanceStore } from '@/stores/maintenance'
import { useSettingsStore } from '@/stores/settings'
import type { PartOp } from '@/types/project'
import { downloadText, slugify } from '@/utils/download'
import { analyzeJob, newPartOp, PART_KINDS, PART_OP_KINDS, usesFrom, usesTo } from '@/utils/maintenance'

const store = useMaintenanceStore()
const settings = useSettingsStore()
const { t } = useI18n()
const { armed, confirm } = useConfirm()
const { opText, opDetail, changeText, toFlowchart } = useMaintenanceText()

const selectedId = ref<string | null>(store.jobs.at(-1)?.id ?? null)
watch(
  () => store.jobs.map((j) => j.id),
  (ids) => {
    if (!selectedId.value || !ids.includes(selectedId.value)) selectedId.value = ids.at(-1) ?? null
  },
)
const job = computed(() => store.jobs.find((j) => j.id === selectedId.value) ?? null)
const analysis = computed(() => (job.value ? analyzeJob(job.value) : { issues: [], hosts: [] }))
const issuesFor = (opId: string) => analysis.value.issues.filter((i) => i.opId === opId)
const doneCount = computed(() => job.value?.ops.filter((o) => o.done).length ?? 0)
/** The procedure drawn from the work order; it follows every edit. */
const flowchart = computed(() => (job.value?.ops.length ? toFlowchart(job.value, 'fc-job') : null))
const printFlow = ref(true)
/** Customer / engineer sign-off at the very end of each printed order; off unless asked for. */
const printSign = ref(false)

/** Machine names from earlier lines and work orders, offered as suggestions. */
const hostOptions = computed(() => store.knownHosts())

const notice = ref<{ variant: 'ok' | 'err'; text: string } | null>(null)
function flash(variant: 'ok' | 'err', text: string): void {
  notice.value = { variant, text }
  setTimeout(() => (notice.value = null), 4000)
}

function newJob(): void {
  selectedId.value = store.addJob(t('maintenancePage.newTitle', { date: new Date().toISOString().slice(0, 10) }), job.value ?? undefined).id
  addLine()
}
function loadSample(): void {
  selectedId.value = store.addSample(settings.locale).id
}
function removeJob(): void {
  if (job.value && confirm('job')) store.removeJob(job.value.id)
}

function addLine(): void {
  if (!job.value) return
  const prev = job.value.ops.at(-1)
  store.addPartOp(job.value.id, (id) => newPartOp(id, prev))
  const id = job.value.ops.at(-1)!.id
  void nextTick(() => document.querySelector<HTMLInputElement>(`#op-${id} [data-first]`)?.focus())
}
/** What a host actually shows after power-on; an emptied field is dropped rather than kept as ''. */
function setActual(host: string, value: string): void {
  if (!job.value) return
  const next = { ...job.value.actual }
  if (value.trim()) next[host] = value
  else delete next[host]
  job.value.actual = next
}
const nowTime = () => new Date().toTimeString().slice(0, 5)

function removeLine(op: PartOp): void {
  if (job.value && confirm(`op-${op.id}`)) store.removePartOp(job.value.id, op.id)
}

function exportJobs(all: boolean): void {
  const j = job.value
  const name = all || !j ? 'work-orders' : slugify([j.customer, j.ticket || j.title].filter(Boolean).join(' '), 'work-order')
  downloadText(`${name}.netlab-job.json`, store.exportJobs(all || !j ? undefined : [j.id]), 'application/json')
  flash('ok', t('maintenancePage.exported'))
}

const fileInput = ref<HTMLInputElement | null>(null)
async function onImport(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  const result = file.size > 5 * 1024 * 1024 ? ({ ok: false, error: 'too-large' } as const) : store.importFile(await file.text())
  if (!result.ok) return flash('err', t(`maintenancePage.importErrors.${result.error}`))
  selectedId.value = result.jobs.at(-1)!.id
  flash('ok', t('maintenancePage.imported', { n: result.jobs.length }))
}

/** Which work orders the printed sheet holds: the open one, or all of them (one per page). */
const printAll = ref(false)
const printJobs = computed(() => (printAll.value ? store.jobs : job.value ? [job.value] : []))
async function printSheets(all: boolean): Promise<void> {
  printAll.value = all
  await nextTick()
  window.print()
}
// Ctrl+P after "print all" should print just the open order again.
const resetPrint = () => (printAll.value = false)
onMounted(() => window.addEventListener('afterprint', resetPrint))
onBeforeUnmount(() => window.removeEventListener('afterprint', resetPrint))
const label = (col: string, i: number) => `${t(`maintenancePage.cols.${col}`)} · #${i + 1}`
const dirIcon = (kind: PartOp['kind']) => (kind === 'swap' ? ArrowLeftRight : ArrowRight)
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-5 print:hidden">
      <PageHeader :title="t('maintenancePage.title')" :description="t('maintenancePage.desc')" :icon="Wrench">
        <template #actions>
          <button class="btn btn-primary" @click="newJob"><Plus class="size-4" /> {{ t('maintenancePage.newJob') }}</button>
          <button class="btn" @click="fileInput?.click()"><Upload class="size-4" /> {{ t('maintenancePage.importFile') }}</button>
          <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" :aria-label="t('maintenancePage.importFile')" @change="onImport" />
        </template>
      </PageHeader>

      <StatusBanner v-if="store.storageError" variant="warn" :title="t('maintenancePage.storageError')" />
      <StatusBanner v-if="notice" :variant="notice.variant" :title="notice.text" />

      <div v-if="!store.jobs.length" class="card space-y-3 p-6 text-center text-sm text-muted">
        <p>{{ t('maintenancePage.empty') }}</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button class="btn btn-primary" @click="newJob"><Plus class="size-4" /> {{ t('maintenancePage.newJob') }}</button>
          <button class="btn" @click="loadSample"><Sparkles class="size-4" /> {{ t('maintenancePage.sample') }}</button>
        </div>
        <p class="text-xs">{{ t('maintenancePage.storageNote') }}</p>
      </div>

      <template v-else>
        <div class="flex flex-wrap gap-1.5" role="tablist">
          <button
            v-for="j in store.jobs"
            :key="j.id"
            role="tab"
            :aria-selected="j.id === selectedId"
            class="rounded-md border px-3 py-1.5 text-sm transition-colors"
            :class="j.id === selectedId ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg'"
            @click="selectedId = j.id"
          >
            {{ j.title || t('maintenancePage.untitled') }}
            <span class="ml-1 font-mono text-xs opacity-70">{{ j.ops.filter((o) => o.done).length }}/{{ j.ops.length }}</span>
          </button>
        </div>

        <template v-if="job">
          <!-- Work order header -->
          <section class="card space-y-3 p-4">
            <div class="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_10rem]">
              <div>
                <label for="mt-title" class="label">{{ t('maintenancePage.jobTitle') }}</label>
                <input id="mt-title" v-model="job.title" class="field font-sans" maxlength="120" />
              </div>
              <div>
                <label for="mt-ticket" class="label">{{ t('maintenancePage.ticket') }}</label>
                <input id="mt-ticket" v-model="job.ticket" class="field" maxlength="80" :placeholder="t('maintenancePage.ticketPlaceholder')" />
              </div>
              <div>
                <label for="mt-date" class="label">{{ t('maintenancePage.date') }}</label>
                <input id="mt-date" v-model="job.date" type="date" class="field" />
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div v-for="f in ['customer', 'site', 'engineer'] as const" :key="f">
                <label :for="`mt-${f}`" class="label">{{ t(`maintenancePage.${f}`) }}</label>
                <input :id="`mt-${f}`" v-model="job[f]" class="field font-sans" maxlength="120" />
              </div>
            </div>
            <div>
              <label for="mt-notes" class="label">{{ t('maintenancePage.notes') }}</label>
              <textarea id="mt-notes" v-model="job.notes" class="field min-h-14 font-sans" maxlength="4000" :placeholder="t('maintenancePage.notesPlaceholder')" />
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-primary px-2 py-1.5 text-xs" @click="printSheets(false)"><Printer class="size-3.5" /> {{ t('maintenancePage.print') }}</button>
              <button v-if="store.jobs.length > 1" class="btn px-2 py-1.5 text-xs" @click="printSheets(true)">
                <Printer class="size-3.5" /> {{ t('maintenancePage.printAll', { n: store.jobs.length }) }}
              </button>
              <label class="flex items-center gap-1.5 text-xs text-muted">
                <input v-model="printFlow" type="checkbox" class="size-4" />
                {{ t('maintenancePage.printFlow') }}
              </label>
              <label class="flex items-center gap-1.5 text-xs text-muted">
                <input v-model="printSign" type="checkbox" class="size-4" />
                {{ t('maintenancePage.printSign') }}
              </label>
              <button class="btn px-2 py-1.5 text-xs" @click="exportJobs(false)"><Download class="size-3.5" /> {{ t('maintenancePage.exportJob') }}</button>
              <button v-if="store.jobs.length > 1" class="btn px-2 py-1.5 text-xs" @click="exportJobs(true)"><Download class="size-3.5" /> {{ t('maintenancePage.exportAll') }}</button>
              <button class="btn ml-auto px-2 py-1.5 text-xs" :class="{ 'border-err bg-err-soft text-err': armed === 'job' }" @click="removeJob">
                <Trash2 class="size-3.5" /> {{ armed === 'job' ? t('projectCommon.confirmAgain') : t('maintenancePage.removeJob') }}
              </button>
            </div>
            <p class="text-xs text-muted">{{ t('maintenancePage.printHint') }}</p>
          </section>

          <div class="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <!-- Lines -->
            <section class="space-y-3">
              <div class="flex items-center justify-between">
                <h2 class="font-semibold">{{ t('maintenancePage.lines') }}</h2>
                <span class="font-mono text-xs" :class="job.ops.length && doneCount === job.ops.length ? 'text-ok' : 'text-muted'">
                  {{ t('maintenancePage.progress', { done: doneCount, total: job.ops.length }) }}
                </span>
              </div>
              <datalist id="mt-hosts">
                <option v-for="h in hostOptions" :key="h" :value="h" />
              </datalist>

              <article
                v-for="(op, i) in job.ops"
                :id="`op-${op.id}`"
                :key="op.id"
                class="card space-y-3 p-3"
                :class="op.done ? 'border-ok/60 bg-ok-soft/30' : ''"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">#{{ i + 1 }}</span>
                  <select v-model="op.kind" data-first class="field w-auto py-1 font-sans text-xs" :aria-label="label('kind', i)">
                    <option v-for="k in PART_OP_KINDS" :key="k" :value="k">{{ t(`maintenancePage.kinds.${k}`) }}</option>
                  </select>
                  <select v-model="op.part" class="field w-auto py-1 font-sans text-xs" :aria-label="label('part', i)">
                    <option v-for="p in PART_KINDS" :key="p" :value="p">{{ t(`maintenancePage.parts.${p}`) }}</option>
                  </select>
                  <label class="ml-auto flex items-center gap-1.5 text-xs font-medium">
                    <input v-model="op.done" type="checkbox" class="size-4 accent-[var(--ok)]" :aria-label="label('done', i)" />
                    {{ t('maintenancePage.cols.done') }}
                  </label>
                </div>

                <div class="grid items-end gap-2" :class="usesFrom(op.kind) && usesTo(op.kind) ? 'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : ''">
                  <fieldset v-if="usesFrom(op.kind)" class="grid grid-cols-2 gap-2 rounded-md border border-line p-2">
                    <legend class="px-1 text-xs text-muted">{{ t(op.kind === 'swap' ? 'maintenancePage.sideA' : op.kind === 'replace' ? 'maintenancePage.at' : 'maintenancePage.from') }}</legend>
                    <input v-model="op.fromHost" list="mt-hosts" class="field py-1 text-xs" maxlength="80" :placeholder="t('maintenancePage.hostPlaceholder')" :aria-label="label('fromHost', i)" />
                    <input v-model="op.fromSlots" class="field py-1 text-xs" maxlength="200" :placeholder="t('maintenancePage.slotsPlaceholder')" :aria-label="label('fromSlots', i)" />
                  </fieldset>
                  <component :is="dirIcon(op.kind)" v-if="usesFrom(op.kind) && usesTo(op.kind)" class="mx-auto mb-3 hidden size-4 text-muted sm:block" aria-hidden="true" />
                  <fieldset v-if="usesTo(op.kind)" class="grid grid-cols-2 gap-2 rounded-md border border-line p-2">
                    <legend class="px-1 text-xs text-muted">{{ t(op.kind === 'swap' ? 'maintenancePage.sideB' : 'maintenancePage.to') }}</legend>
                    <input
                      v-model="op.toHost"
                      list="mt-hosts"
                      class="field py-1 text-xs"
                      maxlength="80"
                      :placeholder="op.kind === 'swap' ? t('maintenancePage.sameHost') : t('maintenancePage.hostPlaceholder')"
                      :aria-label="label('toHost', i)"
                    />
                    <input v-model="op.toSlots" class="field py-1 text-xs" maxlength="200" :placeholder="t('maintenancePage.slotsPlaceholder')" :aria-label="label('toSlots', i)" />
                  </fieldset>
                </div>

                <div class="grid gap-2 sm:grid-cols-2">
                  <input v-model="op.spec" class="field py-1 text-xs" maxlength="120" :placeholder="t('maintenancePage.specPlaceholder')" :aria-label="label('spec', i)" />
                  <input v-model="op.serial" class="field py-1 text-xs" maxlength="200" :placeholder="t('maintenancePage.serialPlaceholder')" :aria-label="label('serial', i)" />
                </div>
                <input v-model="op.notes" class="field py-1 font-sans text-xs" maxlength="400" :placeholder="t('maintenancePage.lineNotesPlaceholder')" :aria-label="label('notes', i)" />

                <div class="flex flex-wrap items-start gap-2 border-t border-line pt-2">
                  <p class="min-w-0 flex-1 text-sm">
                    <span class="font-medium">{{ opText(op) }}</span>
                    <span class="ml-1 text-xs text-muted">{{ opDetail(op) }}</span>
                  </p>
                  <div class="flex shrink-0">
                    <button class="rounded p-1 text-muted hover:text-fg disabled:opacity-30" :disabled="i === 0" :aria-label="`${t('flowchartsPage.moveUp')} · #${i + 1}`" :title="t('flowchartsPage.moveUp')" @click="store.movePartOp(job.id, i, -1)">
                      <ArrowUp class="size-4" />
                    </button>
                    <button
                      class="rounded p-1 text-muted hover:text-fg disabled:opacity-30"
                      :disabled="i === job.ops.length - 1"
                      :aria-label="`${t('flowchartsPage.moveDown')} · #${i + 1}`"
                      :title="t('flowchartsPage.moveDown')"
                      @click="store.movePartOp(job.id, i, 1)"
                    >
                      <ArrowDown class="size-4" />
                    </button>
                    <button
                      class="rounded px-1 text-muted hover:text-err"
                      :class="{ 'bg-err-soft text-err': armed === `op-${op.id}` }"
                      :aria-label="`${t('projectCommon.remove')} · #${i + 1}`"
                      :title="t('projectCommon.remove')"
                      @click="removeLine(op)"
                    >
                      <span v-if="armed === `op-${op.id}`" class="text-xs">{{ t('projectCommon.confirmAgain') }}</span>
                      <Trash2 v-else class="size-4" />
                    </button>
                  </div>
                </div>
                <ul v-if="issuesFor(op.id).length" class="space-y-0.5 text-xs">
                  <li v-for="(iss, k) in issuesFor(op.id)" :key="k" :class="iss.level === 'error' ? 'text-err' : 'text-warn'">
                    {{ t(`maintenancePage.issues.${iss.code}`, iss.params) }}
                  </li>
                </ul>
              </article>

              <button class="btn w-full justify-center" @click="addLine"><Plus class="size-4" /> {{ t('maintenancePage.addLine') }}</button>
              <p class="text-xs text-muted">{{ t('maintenancePage.slotsHelp') }}</p>
            </section>

            <!-- Per machine -->
            <section class="card h-fit overflow-hidden">
              <div class="border-b border-line px-4 py-3">
                <h2 class="font-semibold">{{ t('maintenancePage.byHost') }}</h2>
                <p class="text-xs text-muted">{{ t('maintenancePage.byHostHint') }}</p>
              </div>
              <p v-if="!analysis.hosts.length" class="p-4 text-sm text-muted">{{ t('maintenancePage.byHostEmpty') }}</p>
              <ul v-else class="divide-y divide-line">
                <li v-for="h in analysis.hosts" :key="h.host" class="space-y-2 px-4 py-3">
                  <div class="flex flex-wrap items-baseline justify-between gap-2">
                    <span class="font-semibold">{{ h.host }}</span>
                    <span class="text-xs" :class="h.in - h.out > 0 ? 'text-ok' : h.in - h.out < 0 ? 'text-warn' : 'text-muted'">{{ changeText(h) }}</span>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="s in h.slots"
                      :key="s.slot"
                      class="rounded border px-1.5 py-0.5 text-xs"
                      :class="{
                        'border-ok/60 bg-ok-soft text-ok': s.events.at(-1)!.dir === 'in' || s.events.at(-1)!.dir === 'replace',
                        'border-warn/60 bg-warn-soft text-warn': s.events.at(-1)!.dir === 'out',
                        'border-accent/60 bg-accent-soft text-accent': s.events.at(-1)!.dir === 'swap',
                      }"
                      :title="s.events.map((e) => `#${e.line} ${t(`maintenancePage.slotDir.${e.dir}`, { peer: e.peer })}`).join('\n')"
                    >
                      <span class="font-mono font-semibold">{{ s.slot }}</span>
                      {{ t(`maintenancePage.slotDir.${s.events.at(-1)!.dir}`, { peer: s.events.at(-1)!.peer }) }}
                    </span>
                  </div>
                  <input
                    :value="job.actual[h.host] ?? ''"
                    class="field py-1 text-xs"
                    maxlength="200"
                    :placeholder="t('maintenancePage.actualPlaceholder')"
                    :aria-label="`${t('maintenancePage.sheetCols.actual')} · ${h.host}`"
                    @input="setActual(h.host, ($event.target as HTMLInputElement).value)"
                  />
                </li>
              </ul>
              <div class="flex flex-wrap gap-3 border-t border-line px-4 py-2 text-xs text-muted">
                <span><span class="mr-1 inline-block size-2 rounded-sm bg-ok" />{{ t('maintenancePage.legend.in') }}</span>
                <span><span class="mr-1 inline-block size-2 rounded-sm bg-warn" />{{ t('maintenancePage.legend.out') }}</span>
                <span><span class="mr-1 inline-block size-2 rounded-sm bg-accent" />{{ t('maintenancePage.legend.swap') }}</span>
              </div>
            </section>
          </div>

          <!-- Filled in on-site; printed in place of the blanks -->
          <section class="card space-y-3 p-4">
            <div>
              <h2 class="font-semibold">{{ t('maintenancePage.fieldRecord') }}</h2>
              <p class="text-xs text-muted">{{ t('maintenancePage.fieldRecordHint') }}</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div v-for="f in ['startTime', 'endTime'] as const" :key="f">
                <label :for="`mt-${f}`" class="label">{{ t(`maintenancePage.${f}`) }}</label>
                <div class="flex gap-2">
                  <input :id="`mt-${f}`" v-model="job[f]" type="time" class="field" />
                  <button class="btn shrink-0 px-2 py-1.5 text-xs" @click="job[f] = nowTime()">{{ t('maintenancePage.now') }}</button>
                </div>
              </div>
            </div>
            <div>
              <label for="mt-field-notes" class="label">{{ t('maintenancePage.fieldNotes') }}</label>
              <textarea id="mt-field-notes" v-model="job.fieldNotes" class="field min-h-20 font-sans" maxlength="4000" :placeholder="t('maintenancePage.fieldNotesPlaceholder')" />
            </div>
          </section>

          <!-- Procedure drawn from the work order -->
          <section class="card space-y-3 p-4">
            <h2 class="font-semibold">{{ t('maintenancePage.toFlowchart') }}</h2>
            <p v-if="!flowchart" class="text-sm text-muted">{{ t('maintenancePage.flowEmpty') }}</p>
            <div v-else class="mx-auto max-w-xl overflow-x-auto">
              <FlowchartDiagram :chart="flowchart" :yes-label="t('flowchartsPage.yes')" :no-label="t('flowchartsPage.no')" />
            </div>
          </section>
          <p class="text-xs text-muted">{{ t('maintenancePage.storageNote') }}</p>
        </template>
      </template>
    </div>

    <!-- Printed work orders: one per page, each followed by its flowchart -->
    <div class="hidden print:block">
      <article v-for="(j, n) in printJobs" :key="j.id" class="paper bg-white text-fg" :class="{ 'next-job': n > 0 }">
        <div class="mb-4 flex items-start justify-between gap-6 border-b-2 border-accent pb-2">
          <div>
            <div class="text-xs tracking-widest text-muted uppercase">{{ t('maintenancePage.sheetTitle') }}</div>
            <div class="text-lg font-bold">{{ j.customer || j.title || t('maintenancePage.untitled') }}</div>
            <div class="text-xs text-muted">{{ [j.site, j.engineer].filter(Boolean).join(' · ') }}</div>
          </div>
        </div>
        <MaintenanceSheet :job="j" paper />
        <div v-if="printFlow && j.ops.length" class="flow-page" :class="{ 'with-sign': printSign }">
          <h3 class="mb-2 font-semibold">{{ t('maintenancePage.toFlowchart') }} · {{ j.title || t('maintenancePage.untitled') }}</h3>
          <div class="mx-auto max-w-lg">
            <FlowchartDiagram :chart="toFlowchart(j, `fc-${j.id}`)" :yes-label="t('flowchartsPage.yes')" :no-label="t('flowchartsPage.no')" />
          </div>
        </div>
        <div v-if="printSign" class="sign-block grid grid-cols-2 gap-10 pt-8 text-sm">
          <div v-for="who in ['signCustomer', 'signEngineer'] as const" :key="who" class="space-y-5">
            <div class="font-semibold">{{ t(`reportPage.${who}`) }}</div>
            <div v-for="f in ['signName', 'signature', 'signDate'] as const" :key="f" class="flex items-end gap-2">
              <span class="w-16 shrink-0 text-xs text-muted">{{ t(`reportPage.${f}`) }}</span>
              <span class="flex-1 border-b border-fg/40 pb-0.5">&nbsp;</span>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
/* Each work order starts a new page; its flowchart gets its own page and is scaled to fit rather than cut. */
@media print {
  .next-job {
    break-before: page;
  }
  .sign-block {
    break-inside: avoid;
  }
  .flow-page {
    break-before: page;
    break-inside: avoid;
  }
  .flow-page :deep(svg) {
    max-height: 235mm;
  }
  /* Leave room for the sign-off under the flowchart instead of pushing it onto a page of its own. */
  .flow-page.with-sign :deep(svg) {
    max-height: 185mm;
  }
}
</style>
