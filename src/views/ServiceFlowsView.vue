<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, GitBranch, Image as ImageIcon, Plus, Trash2 } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import ServiceDiagram from '@/components/project/ServiceDiagram.vue'
import { useProjectStore } from '@/stores/project'
import type { ServiceFlow, ServiceKind, ServiceNode } from '@/types/project'
import { FIREWALL_COLUMNS, firewallRows } from '@/utils/flows'
import { toCsv } from '@/utils/csv'
import { downloadText, slugify } from '@/utils/download'
import { downloadPng, downloadSvg } from '@/utils/svgExport'

const project = useProjectStore()
const { t, tm, rt } = useI18n()

const KINDS: ServiceKind[] = ['client', 'lb', 'app', 'db', 'storage', 'mgmt', 'external', 'other']
const highlight = ref<string | null>(null)
const diagram = ref<InstanceType<typeof ServiceDiagram> | null>(null)

const rows = computed(() => firewallRows(project.services, project.flows))
const fwHeader = computed(() => {
  const list = tm('flowsPage.fwCols') as unknown
  return Array.isArray(list) ? list.map((x) => rt(x)) : [...FIREWALL_COLUMNS]
})
const issueIds = computed(() => new Set(project.flowIssues.flatMap((i) => i.ids)))

function setService<K extends keyof ServiceNode>(s: ServiceNode, key: K, value: ServiceNode[K]): void {
  s[key] = value
}
function setFlow<K extends keyof ServiceFlow>(f: ServiceFlow, key: K, value: ServiceFlow[K]): void {
  f[key] = value
}

const fileBase = computed(() => slugify(project.title, 'project'))
// The CSV keeps English column names so it pastes into any firewall request template.
const exportCsv = () => downloadText(`${fileBase.value}-firewall.csv`, toCsv(FIREWALL_COLUMNS, rows.value), 'text/csv', true)
function exportDiagram(kind: 'svg' | 'png'): void {
  const svg = diagram.value?.svg
  if (!svg) return
  if (kind === 'svg') downloadSvg(svg, `${fileBase.value}-services.svg`)
  else void downloadPng(svg, `${fileBase.value}-services.png`)
}
/** Accessible names for table cells ("名稱 · #2"), since the inputs have no visible label of their own. */
const svcLabel = (col: string, i: number) => `${t(`flowsPage.cols.${col}`)} · #${i + 1}`
const flowLabel = (col: string, i: number) => `${t(`flowsPage.cols.${col}`)} · #${i + 1}`
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('flowsPage.title')" :description="t('flowsPage.desc')" :icon="GitBranch" />

    <!-- Services -->
    <section class="card overflow-x-auto">
      <div class="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 class="font-semibold">{{ t('flowsPage.services') }}</h2>
        <button class="btn px-2 py-1 text-xs" @click="project.addService()"><Plus class="size-3.5" /> {{ t('flowsPage.addService') }}</button>
      </div>
      <table class="w-full min-w-[760px] text-sm">
        <thead class="bg-surface-2 text-left text-xs text-muted">
          <tr>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.name') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.kind') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.zone') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.addresses') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, si) in project.services" :key="s.id" class="border-t border-line" :class="issueIds.has(s.id) ? 'bg-warn-soft/30' : ''">
            <td class="px-2 py-1"><input class="field py-1" :value="s.name" :aria-label="svcLabel('name', si)" maxlength="80" @input="setService(s, 'name', ($event.target as HTMLInputElement).value)" /></td>
            <td class="px-2 py-1">
              <select class="field py-1" :value="s.kind" :aria-label="svcLabel('kind', si)" @change="setService(s, 'kind', ($event.target as HTMLSelectElement).value as ServiceKind)">
                <option v-for="k in KINDS" :key="k" :value="k">{{ t(`flowsPage.kinds.${k}`) }}</option>
              </select>
            </td>
            <td class="px-2 py-1"><input class="field py-1" :value="s.zone" :aria-label="svcLabel('zone', si)" maxlength="60" @input="setService(s, 'zone', ($event.target as HTMLInputElement).value)" /></td>
            <td class="px-2 py-1"><input class="field py-1" :value="s.addresses" :aria-label="svcLabel('addresses', si)" maxlength="1000" spellcheck="false" @input="setService(s, 'addresses', ($event.target as HTMLInputElement).value)" /></td>
            <td class="px-2 py-1 text-right">
              <button class="rounded p-1 text-muted hover:text-err" :title="t('projectCommon.remove')" :aria-label="`${t('projectCommon.remove')} · ${s.name || si + 1}`" @click="project.removeService(s.id)"><Trash2 class="size-4" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Flows -->
    <section class="card overflow-x-auto">
      <div class="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 class="font-semibold">{{ t('flowsPage.flows') }}</h2>
        <button class="btn px-2 py-1 text-xs" :disabled="!project.services.length" @click="project.addFlow()"><Plus class="size-3.5" /> {{ t('flowsPage.addFlow') }}</button>
      </div>
      <p v-if="!project.services.length" class="p-4 text-sm text-muted">{{ t('flowsPage.empty') }}</p>
      <table v-else class="w-full min-w-[760px] text-sm">
        <thead class="bg-surface-2 text-left text-xs text-muted">
          <tr>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.from') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.to') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.protocol') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.ports') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('flowsPage.cols.purpose') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(f, fi) in project.flows"
            :key="f.id"
            class="border-t border-line"
            :class="issueIds.has(f.id) ? 'bg-err-soft/30' : ''"
            @mouseenter="highlight = f.id"
            @mouseleave="highlight = null"
          >
            <td class="px-2 py-1">
              <select class="field py-1" :value="f.from" :aria-label="flowLabel('from', fi)" @change="setFlow(f, 'from', ($event.target as HTMLSelectElement).value)">
                <option v-for="s in project.services" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </td>
            <td class="px-2 py-1">
              <select class="field py-1" :value="f.to" :aria-label="flowLabel('to', fi)" @change="setFlow(f, 'to', ($event.target as HTMLSelectElement).value)">
                <option v-for="s in project.services" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </td>
            <td class="px-2 py-1">
              <select class="field py-1" :value="f.protocol" :aria-label="flowLabel('protocol', fi)" @change="setFlow(f, 'protocol', ($event.target as HTMLSelectElement).value as ServiceFlow['protocol'])">
                <option v-for="p in ['TCP', 'UDP', 'ICMP']" :key="p" :value="p">{{ p }}</option>
              </select>
            </td>
            <td class="px-2 py-1">
              <input class="field py-1" :value="f.ports" :aria-label="flowLabel('ports', fi)" :disabled="f.protocol === 'ICMP'" placeholder="443" maxlength="200" @input="setFlow(f, 'ports', ($event.target as HTMLInputElement).value)" />
            </td>
            <td class="px-2 py-1"><input class="field py-1 font-sans" :value="f.purpose" :aria-label="flowLabel('purpose', fi)" maxlength="200" @input="setFlow(f, 'purpose', ($event.target as HTMLInputElement).value)" /></td>
            <td class="px-2 py-1 text-right">
              <button class="rounded p-1 text-muted hover:text-err" :title="t('projectCommon.remove')" :aria-label="`${t('projectCommon.remove')} · #${fi + 1}`" @click="project.removeFlow(f.id)"><Trash2 class="size-4" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="project.flowIssues.length" class="card p-4">
      <h2 class="mb-2 font-semibold">{{ t('projectCommon.issues') }}</h2>
      <ul class="space-y-1 text-sm">
        <li v-for="(i, n) in project.flowIssues" :key="n" class="flex gap-2">
          <span class="mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-semibold" :class="i.level === 'error' ? 'bg-err-soft text-err' : 'bg-warn-soft text-warn'">{{ t(`projectCommon.levels.${i.level}`) }}</span>
          <span>{{ t(`flowsPage.issues.${i.code}`, i.params) }}</span>
        </li>
      </ul>
    </section>

    <!-- Diagram -->
    <section v-if="project.services.length" class="card overflow-hidden">
      <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 class="mr-auto font-semibold">{{ t('flowsPage.diagram') }}</h2>
        <button class="btn px-2 py-1 text-xs" @click="exportDiagram('svg')"><Download class="size-3.5" /> {{ t('projectCommon.exportSvg') }}</button>
        <button class="btn px-2 py-1 text-xs" @click="exportDiagram('png')"><ImageIcon class="size-3.5" /> {{ t('projectCommon.exportPng') }}</button>
      </div>
      <div class="overflow-x-auto p-3">
        <div class="min-w-[640px]"><ServiceDiagram ref="diagram" :nodes="project.services" :flows="project.flows" :highlight="highlight" /></div>
      </div>
    </section>

    <!-- Firewall matrix -->
    <section v-if="rows.length" class="card overflow-x-auto">
      <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 class="mr-auto font-semibold">{{ t('flowsPage.firewall') }}</h2>
        <button class="btn px-2 py-1 text-xs" @click="exportCsv"><Download class="size-3.5" /> {{ t('projectCommon.exportCsv') }}</button>
      </div>
      <table class="w-full min-w-[760px] text-xs">
        <thead class="bg-surface-2 text-left text-muted">
          <tr><th v-for="h in fwHeader" :key="h" class="px-3 py-2 font-medium">{{ h }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r[0]" class="border-t border-line">
            <td v-for="(cell, i) in r" :key="i" class="px-3 py-1.5" :class="[2, 4, 6].includes(i) ? 'font-mono' : ''">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
