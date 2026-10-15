<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowDown, ArrowUp, ClipboardList, Copy, Download, Image as ImageIcon, ListPlus, Plus, Trash2 } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import FlowchartDiagram from '@/components/project/FlowchartDiagram.vue'
import { useConfirm } from '@/composables/useConfirm'
import { FLOWCHART_TEMPLATES } from '@/i18n/content/flowcharts'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import type { FlowNode, FlowNodeType } from '@/types/project'
import { checkFlowchart, newNodeId } from '@/utils/flowchart'
import { slugify } from '@/utils/download'
import { downloadPng, downloadSvg } from '@/utils/svgExport'

const project = useProjectStore()
const settings = useSettingsStore()
const { t } = useI18n()
const { armed, confirm } = useConfirm()

const route = useRoute()
// ?chart=<id> opens a specific chart, e.g. one just generated from a work order.
const requested = typeof route.query.chart === 'string' && project.flowcharts.some((f) => f.id === route.query.chart) ? route.query.chart : null
const selectedId = ref<string | null>(requested ?? project.flowcharts[0]?.id ?? null)
const selectedNode = ref<string | null>(null)
const diagram = ref<InstanceType<typeof FlowchartDiagram> | null>(null)

watch(
  () => project.flowcharts.map((f) => f.id),
  (ids) => {
    if (!selectedId.value || !ids.includes(selectedId.value)) selectedId.value = ids[0] ?? null
  },
)

const chart = computed(() => project.flowcharts.find((f) => f.id === selectedId.value) ?? null)
const issues = computed(() => (chart.value ? checkFlowchart(chart.value) : []))
const TYPES: FlowNodeType[] = ['start', 'step', 'decision', 'end']

function create(template: (typeof FLOWCHART_TEMPLATES)[number] | 'blank'): void {
  selectedId.value = project.addFlowchart(settings.locale, template, t('flowchartsPage.blankTitle')).id
}
function removeChart(): void {
  if (chart.value && confirm('chart')) project.removeFlowchart(chart.value.id)
}
/** Same procedure for another VM / host / system: copy the chart, then change its title and scope. */
function duplicateChart(): void {
  if (!chart.value) return
  const { id: _id, ...rest } = chart.value
  selectedId.value = project.insertFlowchart({ ...rest, title: t('flowchartsPage.copyTitle', { title: rest.title }).slice(0, 120) }).id
}

/** Inserts a step right after a start / step row and links it in between that row and its next step. */
function insertAfter(index: number): void {
  if (!chart.value) return
  const prev = chart.value.nodes[index]!
  const node: FlowNode = { id: newNodeId(chart.value.nodes), type: 'step', text: t('flowchartsPage.types.step'), next: prev.next, yes: null, no: null }
  prev.next = node.id
  chart.value.nodes.splice(index + 1, 0, node)
  selectedNode.value = node.id
  void nextTick(() => document.querySelector<HTMLInputElement>(`#fc-row-${node.id} input`)?.select())
}

/** Changes the row order only (reading order and placement within a level); the links stay as they are. */
function moveRow(index: number, delta: -1 | 1): void {
  const nodes = chart.value?.nodes
  const to = index + delta
  if (!nodes || to < 0 || to >= nodes.length) return
  ;[nodes[index], nodes[to]] = [nodes[to]!, nodes[index]!]
}

function addNode(type: 'step' | 'decision'): void {
  if (!chart.value) return
  const node: FlowNode = { id: newNodeId(chart.value.nodes), type, text: type === 'step' ? t('flowchartsPage.types.step') : '?', next: null, yes: null, no: null }
  // Insert before the first end node so new steps land in a natural place.
  const endIndex = chart.value.nodes.findIndex((n) => n.type === 'end')
  chart.value.nodes.splice(endIndex >= 0 ? endIndex : chart.value.nodes.length, 0, node)
  selectedNode.value = node.id
}

function removeNode(id: string): void {
  if (!chart.value) return
  chart.value.nodes = chart.value.nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, next: n.next === id ? null : n.next, yes: n.yes === id ? null : n.yes, no: n.no === id ? null : n.no }))
}

function setType(node: FlowNode, type: FlowNodeType): void {
  node.type = type
  if (type === 'decision') node.next = null
  else {
    node.yes = null
    node.no = null
  }
  if (type === 'end') node.next = null
}

const target = (e: Event) => (e.target as HTMLSelectElement).value || null
const nodeLabel = (n: FlowNode) => (n.text.length > 24 ? `${n.text.slice(0, 23)}…` : n.text) || n.id

async function selectFromDiagram(id: string): Promise<void> {
  selectedNode.value = id
  await nextTick()
  document.getElementById(`fc-row-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function exportChart(kind: 'svg' | 'png'): void {
  const svg = diagram.value?.svg
  if (!svg || !chart.value) return
  const name = `${slugify(project.title, 'project')}-${slugify(chart.value.title, 'flowchart')}`
  if (kind === 'svg') downloadSvg(svg, `${name}.svg`)
  else void downloadPng(svg, `${name}.png`)
}
/** Accessible names for the step table cells, e.g. "文字 · #3". */
const stepLabel = (col: string, i: number) => `${t(`flowchartsPage.cols.${col}`)} · #${i + 1}`
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('flowchartsPage.title')" :description="t('flowchartsPage.desc')" :icon="ClipboardList" />

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-muted">{{ t('flowchartsPage.newFrom') }}</span>
      <button v-for="tpl in [...FLOWCHART_TEMPLATES, 'blank' as const]" :key="tpl" class="btn px-2 py-1 text-xs" @click="create(tpl)">
        <Plus class="size-3" /> {{ t(`flowchartsPage.templates.${tpl}`) }}
      </button>
    </div>

    <p v-if="!project.flowcharts.length" class="card p-6 text-center text-sm text-muted">{{ t('flowchartsPage.empty') }}</p>

    <template v-else>
      <div class="flex flex-wrap gap-1.5" role="tablist">
        <button
          v-for="f in project.flowcharts"
          :key="f.id"
          role="tab"
          :aria-selected="f.id === selectedId"
          class="rounded-md border px-3 py-1.5 text-sm transition-colors"
          :class="f.id === selectedId ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg'"
          @click="selectedId = f.id"
        >
          {{ f.title || '—' }}
        </button>
      </div>

      <div v-if="chart" class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <!-- Editor -->
        <section class="card space-y-3 overflow-hidden p-4">
          <div class="flex flex-wrap items-end gap-2">
            <div class="min-w-48 flex-1">
              <label for="fc-title" class="label">{{ t('flowchartsPage.chartTitle') }}</label>
              <input id="fc-title" v-model="chart.title" class="field font-sans" maxlength="120" />
            </div>
            <button class="btn px-2 py-1.5 text-xs" :title="t('flowchartsPage.duplicateHint')" @click="duplicateChart">
              <Copy class="size-3.5" /> {{ t('flowchartsPage.duplicate') }}
            </button>
            <button class="btn px-2 py-1.5 text-xs" :class="{ 'border-err bg-err-soft text-err': armed === 'chart' }" @click="removeChart">
              <Trash2 class="size-3.5" /> {{ armed === 'chart' ? t('projectCommon.confirmAgain') : t('flowchartsPage.removeChart') }}
            </button>
          </div>

          <div>
            <label for="fc-scope" class="label">{{ t('flowchartsPage.scope') }}</label>
            <textarea id="fc-scope" v-model="chart.scope" class="field min-h-14 font-sans text-xs" maxlength="2000" :placeholder="t('flowchartsPage.scopePlaceholder')" />
            <p class="mt-1 text-xs text-muted">{{ t('flowchartsPage.scopeHint') }}</p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[700px] text-xs">
              <thead class="text-left text-muted">
                <tr>
                  <th class="w-6 px-1 py-1 font-medium">#</th>
                  <th class="px-1 py-1 font-medium">{{ t('flowchartsPage.cols.type') }}</th>
                  <th class="px-1 py-1 font-medium">{{ t('flowchartsPage.cols.text') }}</th>
                  <th class="px-1 py-1 font-medium">{{ t('flowchartsPage.cols.next') }} / {{ t('flowchartsPage.cols.yes') }}</th>
                  <th class="px-1 py-1 font-medium">{{ t('flowchartsPage.cols.no') }}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(n, ni) in chart.nodes"
                  :id="`fc-row-${n.id}`"
                  :key="n.id"
                  class="border-t border-line"
                  :class="selectedNode === n.id ? 'bg-accent-soft/50' : ''"
                  @focusin="selectedNode = n.id"
                >
                  <td class="px-1 py-1 font-mono text-muted">{{ ni + 1 }}</td>
                  <td class="px-1 py-1">
                    <select class="field w-24 py-1 font-sans text-xs" :value="n.type" :aria-label="stepLabel('type', ni)" @change="setType(n, ($event.target as HTMLSelectElement).value as FlowNodeType)">
                      <option v-for="ty in TYPES" :key="ty" :value="ty">{{ t(`flowchartsPage.types.${ty}`) }}</option>
                    </select>
                  </td>
                  <td class="px-1 py-1"><input v-model="n.text" class="field py-1 font-sans text-xs" maxlength="200" :aria-label="stepLabel('text', ni)" /></td>
                  <td class="px-1 py-1">
                    <select
                      v-if="n.type !== 'end'"
                      class="field w-36 py-1 font-sans text-xs"
                      :value="(n.type === 'decision' ? n.yes : n.next) ?? ''"
                      :aria-label="stepLabel(n.type === 'decision' ? 'yes' : 'next', ni)"
                      @change="n.type === 'decision' ? (n.yes = target($event)) : (n.next = target($event))"
                    >
                      <option value="">—</option>
                      <option v-for="o in chart.nodes.filter((x) => x.id !== n.id)" :key="o.id" :value="o.id">{{ nodeLabel(o) }}</option>
                    </select>
                  </td>
                  <td class="px-1 py-1">
                    <select v-if="n.type === 'decision'" class="field w-36 py-1 font-sans text-xs" :value="n.no ?? ''" :aria-label="stepLabel('no', ni)" @change="n.no = target($event)">
                      <option value="">—</option>
                      <option v-for="o in chart.nodes.filter((x) => x.id !== n.id)" :key="o.id" :value="o.id">{{ nodeLabel(o) }}</option>
                    </select>
                  </td>
                  <td class="px-1 py-1 text-right whitespace-nowrap">
                    <button
                      v-if="n.type === 'start' || n.type === 'step'"
                      class="rounded p-1 text-muted hover:text-accent"
                      :title="t('flowchartsPage.insertAfter')"
                      :aria-label="`${t('flowchartsPage.insertAfter')} · #${ni + 1}`"
                      @click="insertAfter(ni)"
                    >
                      <ListPlus class="size-3.5" />
                    </button>
                    <button class="rounded p-1 text-muted hover:text-fg disabled:opacity-30" :disabled="ni === 0" :title="t('flowchartsPage.moveUp')" :aria-label="`${t('flowchartsPage.moveUp')} · #${ni + 1}`" @click="moveRow(ni, -1)">
                      <ArrowUp class="size-3.5" />
                    </button>
                    <button
                      class="rounded p-1 text-muted hover:text-fg disabled:opacity-30"
                      :disabled="ni === chart.nodes.length - 1"
                      :title="t('flowchartsPage.moveDown')"
                      :aria-label="`${t('flowchartsPage.moveDown')} · #${ni + 1}`"
                      @click="moveRow(ni, 1)"
                    >
                      <ArrowDown class="size-3.5" />
                    </button>
                    <button class="rounded p-1 text-muted hover:text-err" :title="t('projectCommon.remove')" :aria-label="`${t('projectCommon.remove')} · #${ni + 1}`" @click="removeNode(n.id)"><Trash2 class="size-3.5" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex gap-2">
            <button class="btn px-2 py-1 text-xs" @click="addNode('step')"><Plus class="size-3" /> {{ t('flowchartsPage.addStep') }}</button>
            <button class="btn px-2 py-1 text-xs" @click="addNode('decision')"><Plus class="size-3" /> {{ t('flowchartsPage.addDecision') }}</button>
          </div>
          <ul v-if="issues.length" class="space-y-1 border-t border-line pt-3 text-xs">
            <li v-for="(i, k) in issues" :key="k" :class="i.level === 'error' ? 'text-err' : 'text-warn'">{{ t(`flowchartsPage.issues.${i.code}`, i.params) }}</li>
          </ul>
        </section>

        <!-- Diagram -->
        <section class="card overflow-hidden">
          <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <span class="mr-auto text-xs text-muted">{{ t('flowchartsPage.clickHint') }}</span>
            <button class="btn px-2 py-1 text-xs" @click="exportChart('svg')"><Download class="size-3.5" /> {{ t('projectCommon.exportSvg') }}</button>
            <button class="btn px-2 py-1 text-xs" @click="exportChart('png')"><ImageIcon class="size-3.5" /> {{ t('projectCommon.exportPng') }}</button>
          </div>
          <div v-if="chart.scope.trim()" class="border-b border-line px-4 py-2 text-xs">
            <div class="text-muted">{{ t('flowchartsPage.scopeShort') }}</div>
            <div class="whitespace-pre-line">{{ chart.scope.trim() }}</div>
          </div>
          <div class="p-3">
            <FlowchartDiagram
              ref="diagram"
              :chart="chart"
              :yes-label="t('flowchartsPage.yes')"
              :no-label="t('flowchartsPage.no')"
              :selected-id="selectedNode"
              @select="selectFromDiagram"
            />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
