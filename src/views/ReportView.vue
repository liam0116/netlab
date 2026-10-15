<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileText, FolderKanban, Printer, Sparkles } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import RackElevation from '@/components/project/RackElevation.vue'
import ServiceDiagram from '@/components/project/ServiceDiagram.vue'
import FlowchartDiagram from '@/components/project/FlowchartDiagram.vue'
import { useProjectPlanStore } from '@/stores/planner'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { cableRows } from '@/utils/cabling'
import { firewallRows } from '@/utils/flows'
import { rackTotals } from '@/utils/rack'

const project = useProjectStore()
const plan = useProjectPlanStore()
const settings = useSettingsStore()
const { t, tm, rt } = useI18n()

const SECTIONS = ['cover', 'summary', 'ip', 'racks', 'inventory', 'cabling', 'services', 'flowcharts', 'signoff'] as const
type Section = (typeof SECTIONS)[number]
/** Which sections have anything to show. Empty ones start unticked so the printout has no blank chapters. */
const hasData = computed<Record<Section, boolean>>(() => ({
  cover: true,
  summary: true,
  ip: project.subnets.length > 0,
  racks: project.racks.length > 0,
  inventory: project.rackItems.some((i) => i.type !== 'blank'),
  cabling: project.cables.length > 0,
  services: project.services.length + project.flows.length > 0,
  flowcharts: project.flowcharts.length > 0,
  signoff: true,
}))
const enabled = ref<Record<Section, boolean>>({ ...hasData.value })
/** Nothing entered yet: show how to start instead of a document full of empty chapters. */
const isEmpty = computed(() => !project.meta.customer && !project.meta.project && SECTIONS.every((s) => ['cover', 'summary', 'signoff'].includes(s) || !hasData.value[s]))
/** Cover details still missing, listed above the preview (not printed). */
const missingMeta = computed(() => (['customer', 'project'] as const).filter((k) => !(k === 'project' ? project.meta.project || plan.project : project.meta[k])))
const docTitle = computed(() => project.meta.project || plan.project || t('reportPage.untitled'))

function loadDemo(): void {
  project.loadDemo(settings.locale)
  enabled.value = { ...hasData.value }
}

/** Numbered headings for the sections actually included. */
const numbered = computed(() => {
  let n = 0
  return Object.fromEntries(SECTIONS.filter((s) => s !== 'cover' && enabled.value[s]).map((s) => [s, ++n])) as Partial<Record<Section, number>>
})
const heading = (s: Section) => `${numbered.value[s]}. ${t(`reportPage.s.${s}`)}`

const list = (key: string): string[] => {
  const v = tm(key) as unknown
  return Array.isArray(v) ? v.map((x) => rt(x)) : []
}

const rackName = (id: string) => project.racks.find((r) => r.id === id)?.name ?? '—'
const inventory = computed(() =>
  [...project.rackItems]
    .filter((i) => i.type !== 'blank')
    .sort((a, b) => rackName(a.rackId).localeCompare(rackName(b.rackId)) || b.uPosition - a.uPosition),
)
const cableTable = computed(() => cableRows(project.rackItems, project.cables))
const fwTable = computed(() => firewallRows(project.services, project.flows))
const metaRows = computed(() =>
  (['customer', 'project', 'site', 'engineer', 'company', 'date'] as const)
    .map((k) => ({ label: t(`reportPage.meta.${k}`), value: project.meta[k] || (k === 'project' ? plan.project : '') }))
    .filter((r) => r.value),
)
const summaryRows = computed(() => [
  [t('reportPage.summary.subnets'), project.subnets.length],
  [t('reportPage.summary.racks'), project.racks.length],
  [t('reportPage.summary.devices'), inventory.value.length],
  [t('reportPage.summary.cables'), project.cables.length],
  [t('reportPage.summary.services'), project.services.length],
  [t('reportPage.summary.flows'), project.flows.length],
])
const printDoc = () => window.print()
const kw = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`)
</script>

<template>
  <div class="space-y-5">
    <!-- Controls (not printed) -->
    <div class="space-y-4 print:hidden">
      <PageHeader :title="t('reportPage.title')" :description="t('reportPage.desc')" :icon="FileText">
        <template #actions>
          <button class="btn btn-primary" :disabled="isEmpty" @click="printDoc"><Printer class="size-4" /> {{ t('reportPage.print') }}</button>
        </template>
      </PageHeader>
      <div v-if="isEmpty" class="card space-y-3 p-6 text-center text-sm">
        <p class="font-medium">{{ t('reportPage.emptyProject') }}</p>
        <p class="text-muted">{{ t('reportPage.emptyProjectHint') }}</p>
        <div class="flex flex-wrap justify-center gap-2">
          <RouterLink to="/project" class="btn btn-primary"><FolderKanban class="size-4" /> {{ t('reportPage.goProject') }}</RouterLink>
          <button class="btn" @click="loadDemo"><Sparkles class="size-4" /> {{ t('reportPage.loadDemo') }}</button>
        </div>
      </div>
      <div v-if="!isEmpty" class="card flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
        <span class="text-xs text-muted">{{ t('reportPage.sections') }}</span>
        <label v-for="s in SECTIONS" :key="s" class="flex items-center gap-1.5">
          <input v-model="enabled[s]" type="checkbox" class="accent-[var(--accent)]" />
          {{ t(`reportPage.s.${s}`) }}
          <span v-if="!hasData[s]" class="text-xs text-muted">{{ t('reportPage.noData') }}</span>
        </label>
      </div>
      <p v-if="!isEmpty && missingMeta.length" class="text-xs text-warn">
        {{ t('reportPage.missingMeta', { fields: missingMeta.map((k) => t(`reportPage.meta.${k}`)).join(t('maintenancePage.listSep')) }) }}
        <RouterLink to="/project" class="underline">{{ t('reportPage.goProject') }}</RouterLink>
      </p>
      <p v-if="!isEmpty" class="text-xs text-muted">{{ t('reportPage.printHint') }}</p>
    </div>

    <!-- Document -->
    <article v-if="!isEmpty" class="paper mx-auto max-w-[210mm] rounded-lg border border-line px-10 py-10 text-sm shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <!-- Cover -->
      <section v-if="enabled.cover" class="flex min-h-[60vh] flex-col justify-between print:min-h-[250mm]">
        <div class="flex items-start justify-between gap-6">
          <img v-if="project.meta.logo" :src="project.meta.logo" alt="" class="max-h-16 max-w-48 object-contain" />
          <div class="ml-auto text-right text-xs text-muted">{{ project.meta.company }}</div>
        </div>
        <div>
          <div class="text-sm tracking-widest text-muted uppercase">{{ t('reportPage.docTitle') }}</div>
          <h1 class="mt-2 text-3xl font-bold" :class="{ 'text-muted': docTitle === t('reportPage.untitled') }">{{ docTitle }}</h1>
          <div v-if="project.meta.customer" class="mt-1 text-lg text-muted">{{ project.meta.customer }}</div>
          <dl class="mt-8 grid max-w-md grid-cols-[7rem_1fr] gap-y-1.5">
            <template v-for="r in metaRows" :key="r.label">
              <dt class="text-muted">{{ r.label }}</dt>
              <dd>{{ r.value }}</dd>
            </template>
          </dl>
          <p v-if="project.meta.notes" class="mt-6 max-w-xl leading-relaxed whitespace-pre-line text-muted">{{ project.meta.notes }}</p>
        </div>
        <div class="text-xs text-muted">Generated by Server Engineer Network Lab</div>
      </section>

      <!-- Summary -->
      <section v-if="enabled.summary" class="doc-section">
        <h2 class="doc-h2">{{ heading('summary') }}</h2>
        <table class="doc-table max-w-md">
          <tbody>
            <tr v-for="[label, value] in summaryRows" :key="String(label)">
              <th>{{ label }}</th>
              <td class="font-mono">{{ value }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- IP plan -->
      <section v-if="enabled.ip" class="doc-section">
        <h2 class="doc-h2">{{ heading('ip') }}</h2>
        <p v-if="!project.subnets.length" class="text-muted">{{ t('reportPage.empty') }}</p>
        <table v-else class="doc-table">
          <thead>
            <tr><th v-for="h in list('reportPage.ipCols')" :key="h">{{ h }}</th></tr>
          </thead>
          <tbody class="font-mono text-xs">
            <tr v-for="s in project.subnets" :key="s.requirementId">
              <td class="font-sans">{{ s.name }}</td>
              <td>{{ s.vlan ?? '—' }}</td>
              <td>{{ s.network }}/{{ s.cidr }}</td>
              <td>{{ s.subnetMask }}</td>
              <td>{{ s.gateway }}</td>
              <td>{{ s.firstIp }} – {{ s.lastIp }}</td>
              <td>{{ s.broadcast }}</td>
              <td>{{ s.availableHosts }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Racks -->
      <section v-if="enabled.racks" class="doc-section">
        <h2 class="doc-h2">{{ heading('racks') }}</h2>
        <p v-if="!project.racks.length" class="text-muted">{{ t('reportPage.empty') }}</p>
        <!-- Inline blocks are never split across pages; each figure is also capped to one page height. -->
        <div class="-mr-6">
          <figure v-for="r in project.racks" :key="r.id" class="rack-fig">
            <RackElevation :rack="r" :items="project.rackItems" :interactive="false" />
            <figcaption class="mt-1 text-center font-mono text-xs text-muted">
              {{ kw(rackTotals(r, project.rackItems).powerW) }} · {{ Math.round(rackTotals(r, project.rackItems).btuPerHour).toLocaleString() }} BTU/h ·
              {{ Math.round(rackTotals(r, project.rackItems).weightKg) }} kg
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- Inventory -->
      <section v-if="enabled.inventory" class="doc-section">
        <h2 class="doc-h2">{{ heading('inventory') }}</h2>
        <p v-if="!inventory.length" class="text-muted">{{ t('reportPage.empty') }}</p>
        <table v-else class="doc-table">
          <thead>
            <tr><th v-for="h in list('reportPage.invCols')" :key="h">{{ h }}</th></tr>
          </thead>
          <tbody class="text-xs">
            <tr v-for="i in inventory" :key="i.id">
              <td class="font-medium">{{ i.name }}</td>
              <td>
                {{ i.model }}
                <div v-if="i.os" class="text-muted">{{ i.os }}</div>
              </td>
              <td class="font-mono">{{ rackName(i.rackId) }} / U{{ i.uPosition }}{{ i.uHeight > 1 ? `–${i.uPosition + i.uHeight - 1}` : '' }}</td>
              <td class="font-mono">{{ i.hostname }}</td>
              <td class="font-mono">
                {{ i.ip }}
                <div v-for="x in i.addresses.filter((x) => x.address)" :key="x.id">
                  {{ x.address }} <span class="font-sans text-muted">{{ t(`projectCommon.purposes.${x.purpose}`) }}</span>
                </div>
              </td>
              <td class="font-mono">{{ i.mgmtIp }}</td>
              <td class="font-mono">
                {{ i.serial }}
                <div v-if="i.assetTag" class="text-muted">{{ i.assetTag }}</div>
              </td>
              <td class="font-mono">{{ i.powerW ? kw(i.powerW) : '' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Cabling -->
      <section v-if="enabled.cabling" class="doc-section">
        <h2 class="doc-h2">{{ heading('cabling') }}</h2>
        <p v-if="!cableTable.length" class="text-muted">{{ t('reportPage.empty') }}</p>
        <table v-else class="doc-table">
          <thead>
            <tr>
              <th>{{ t('cablingPage.cols.label') }}</th>
              <th>{{ t('cablingPage.cols.aDevice') }}</th>
              <th>{{ t('cablingPage.cols.aPort') }}</th>
              <th>{{ t('cablingPage.cols.bDevice') }}</th>
              <th>{{ t('cablingPage.cols.bPort') }}</th>
              <th>{{ t('cablingPage.cols.type') }}</th>
              <th>{{ t('cablingPage.cols.length') }}</th>
              <th>{{ t('cablingPage.cols.mode') }}</th>
              <th>VLAN</th>
              <th>{{ t('cablingPage.cols.bond') }}</th>
            </tr>
          </thead>
          <tbody class="font-mono text-xs">
            <tr v-for="row in cableTable" :key="row[0]">
              <td>{{ row[0] }}</td>
              <td class="font-sans">{{ row[1] }}</td>
              <td>{{ row[2] }}</td>
              <td class="font-sans">{{ row[3] }}</td>
              <td>{{ row[4] }}</td>
              <td>{{ row[5] }}</td>
              <td>{{ row[6] }}</td>
              <td>{{ row[7] }}</td>
              <td>{{ row[7] === 'trunk' ? row[9] : row[8] }}</td>
              <td>{{ row[10] }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Services -->
      <section v-if="enabled.services" class="doc-section">
        <h2 class="doc-h2">{{ heading('services') }}</h2>
        <p v-if="!project.services.length" class="text-muted">{{ t('reportPage.empty') }}</p>
        <template v-else>
          <div class="fig-fit">
            <ServiceDiagram :nodes="project.services" :flows="project.flows" />
          </div>
          <table v-if="fwTable.length" class="doc-table mt-4">
            <thead>
              <tr><th v-for="h in list('flowsPage.fwCols')" :key="h">{{ h }}</th></tr>
            </thead>
            <tbody class="text-xs">
              <tr v-for="r in fwTable" :key="r[0]">
                <td v-for="(cell, i) in r" :key="i" :class="[2, 4, 6].includes(i) ? 'font-mono' : ''">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </section>

      <!-- Flowcharts -->
      <section v-if="enabled.flowcharts" class="doc-section">
        <h2 class="doc-h2">{{ heading('flowcharts') }}</h2>
        <p v-if="!project.flowcharts.length" class="text-muted">{{ t('reportPage.empty') }}</p>
        <div v-for="f in project.flowcharts" :key="f.id" class="fig-block mb-6">
          <h3 class="mb-1 font-semibold">{{ f.title }}</h3>
          <p v-if="f.scope.trim()" class="mb-2 text-xs text-muted">
            {{ t('flowchartsPage.scopeShort') }} {{ f.scope.trim().split('\n').filter(Boolean).join(' · ') }}
          </p>
          <div class="fig-fit mx-auto max-w-lg">
            <FlowchartDiagram :chart="f" :yes-label="t('flowchartsPage.yes')" :no-label="t('flowchartsPage.no')" />
          </div>
        </div>
      </section>

      <!-- Sign-off -->
      <section v-if="enabled.signoff" class="doc-section break-inside-avoid">
        <h2 class="doc-h2">{{ heading('signoff') }}</h2>
        <p class="mb-8">{{ t('reportPage.signoffText') }}</p>
        <div class="grid grid-cols-2 gap-10">
          <div v-for="who in ['signCustomer', 'signEngineer'] as const" :key="who" class="space-y-6">
            <div class="font-semibold">{{ t(`reportPage.${who}`) }}</div>
            <div v-for="f in ['signName', 'signature', 'signDate'] as const" :key="f" class="flex items-end gap-2">
              <span class="w-16 shrink-0 text-xs text-muted">{{ t(`reportPage.${f}`) }}</span>
              <span class="flex-1 border-b border-fg/40 pb-0.5">{{ who === 'signEngineer' && f === 'signName' ? project.meta.engineer : '' }}&nbsp;</span>
            </div>
          </div>
        </div>
      </section>
    </article>
  </div>
</template>

<style scoped>
@reference '../style.css';

@layer components {
  .doc-section {
    @apply mt-10 print:mt-0 print:break-before-page;
  }
  .doc-h2 {
    @apply mb-3 border-b-2 border-accent pb-1 text-lg font-bold;
    break-after: avoid;
  }
  /* Racks: atomic inline boxes, so the printer moves a whole rack to the next page instead of cutting it. */
  .rack-fig {
    @apply mr-6 mb-6 inline-block w-[300px] align-top;
    break-inside: avoid;
  }
  .fig-block {
    break-inside: avoid;
  }
  /* A diagram taller than a printed page is scaled down to fit one page rather than cut. */
  @media print {
    .rack-fig :deep(svg) {
      max-height: 235mm;
    }
    .fig-fit :deep(svg) {
      max-height: 225mm;
    }
  }
  .doc-table {
    @apply w-full border-collapse;
  }
  .doc-table :where(th, td) {
    @apply border border-line px-2 py-1 text-left align-top;
  }
  .doc-table thead th {
    @apply bg-surface-2 text-xs font-semibold;
  }
  .doc-table tbody th {
    @apply w-40 bg-surface-2 font-normal text-muted;
  }
  .doc-table tr {
    break-inside: avoid;
  }
}
</style>
