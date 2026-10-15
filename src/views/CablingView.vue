<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cable as CableIcon, Download, Plus, Tags, Trash2 } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import { useProjectStore } from '@/stores/project'
import type { Cable } from '@/types/project'
import { CABLE_COLUMNS, CABLE_TYPES, cableLabels, cableRows, freePorts } from '@/utils/cabling'
import { toCsv } from '@/utils/csv'
import { downloadText, slugify } from '@/utils/download'

const project = useProjectStore()
const { t } = useI18n()

const filter = ref('')
const focused = ref<string | null>(null)

const devices = computed(() => [...project.rackItems].filter((i) => i.type !== 'blank').sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))
const visible = computed(() => (filter.value ? project.cables.filter((c) => c.aItemId === filter.value || c.bItemId === filter.value) : project.cables))

const issueByCable = computed(() => {
  const map = new Map<string, 'error' | 'warning'>()
  for (const i of project.cableIssues) for (const id of i.cableIds) if (map.get(id) !== 'error') map.set(id, i.level)
  return map
})
const errors = computed(() => project.cableIssues.filter((i) => i.level === 'error').length)
const warnings = computed(() => project.cableIssues.filter((i) => i.level === 'warning').length)

/** Ports for a cable end: free ports first, then the rest marked as in use. */
function portOptions(cable: Cable, end: 'a' | 'b'): { name: string; used: boolean }[] {
  const itemId = end === 'a' ? cable.aItemId : cable.bItemId
  const item = project.rackItems.find((i) => i.id === itemId)
  if (!item) return []
  const free = new Set(freePorts(item, project.cables, cable.id))
  return item.ports.map((p) => ({ name: p.name, used: !free.has(p.name) })).sort((x, y) => Number(x.used) - Number(y.used))
}

function addCable(): void {
  const first = filter.value || devices.value[0]?.id || ''
  const c = project.addCable({ aItemId: first })
  focused.value = c.id
}

function set<K extends keyof Cable>(c: Cable, key: K, value: Cable[K]): void {
  project.updateCable(c.id, { [key]: value } as Partial<Cable>)
}
/** Accessible name for a cell, e.g. "Bond · C-001", so each field is identifiable without the header row. */
const cellLabel = (col: string, c: Cable) => `${t(`cablingPage.cols.${col}`)} · ${c.label || c.id}`
const numOrNull = (e: Event) => {
  const v = (e.target as HTMLInputElement).value.trim()
  return v === '' ? null : Number(v)
}

const fileBase = computed(() => slugify(project.title, 'project'))
const exportCsv = () => downloadText(`${fileBase.value}-cabling.csv`, toCsv(CABLE_COLUMNS, cableRows(project.rackItems, project.cables)), 'text/csv', true)
const exportLabels = () => downloadText(`${fileBase.value}-labels.txt`, cableLabels(project.rackItems, project.cables).join('\n') + '\n', 'text/plain')
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('cablingPage.title')" :description="t('cablingPage.desc')" :icon="CableIcon">
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <button class="btn px-2 py-1 text-xs" :disabled="!devices.length" @click="addCable"><Plus class="size-3.5" /> {{ t('cablingPage.addCable') }}</button>
          <button class="btn px-2 py-1 text-xs" :disabled="!project.cables.length" @click="exportCsv"><Download class="size-3.5" /> {{ t('projectCommon.exportCsv') }}</button>
          <button class="btn px-2 py-1 text-xs" :disabled="!project.cables.length" @click="exportLabels"><Tags class="size-3.5" /> {{ t('cablingPage.exportLabels') }}</button>
        </div>
      </template>
    </PageHeader>

    <p v-if="!devices.length" class="card p-6 text-center text-sm text-muted">{{ t('cablingPage.noDevices') }}</p>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <label for="cb-filter" class="text-xs text-muted">{{ t('cablingPage.filter') }}</label>
        <select id="cb-filter" v-model="filter" class="field w-48 py-1.5">
          <option value="">{{ t('cablingPage.all') }}</option>
          <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
        <span class="ml-auto text-xs text-muted">{{ t('projectCommon.errorsWarnings', { errors, warnings }) }}</span>
      </div>

      <section class="card overflow-x-auto">
        <table class="w-full min-w-[1200px] text-xs">
          <thead class="bg-surface-2 text-left text-muted">
            <tr>
              <th v-for="col in ['label', 'aDevice', 'aPort', 'bDevice', 'bPort', 'type', 'length', 'mode', 'vlan', 'allowed', 'bond', 'notes']" :key="col" class="px-2 py-2 font-medium whitespace-nowrap">
                {{ t(`cablingPage.cols.${col}`) }}
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in visible"
              :key="c.id"
              class="border-t border-line"
              :class="[
                issueByCable.get(c.id) === 'error' ? 'bg-err-soft/40' : issueByCable.get(c.id) === 'warning' ? 'bg-warn-soft/30' : '',
                focused === c.id ? 'outline outline-2 -outline-offset-2 outline-accent' : '',
              ]"
            >
              <td class="px-1 py-1"><input class="cell w-20" :value="c.label" :aria-label="cellLabel('label', c)" maxlength="40" @input="set(c, 'label', ($event.target as HTMLInputElement).value)" /></td>
              <td class="px-1 py-1">
                <select class="cell w-28" :value="c.aItemId" :aria-label="cellLabel('aDevice', c)" @change="set(c, 'aItemId', ($event.target as HTMLSelectElement).value)">
                  <option value="">{{ t('projectCommon.select') }}</option>
                  <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </td>
              <td class="px-1 py-1">
                <select class="cell w-28" :value="c.aPort" :aria-label="cellLabel('aPort', c)" @change="set(c, 'aPort', ($event.target as HTMLSelectElement).value)">
                  <option value="">—</option>
                  <option v-if="c.aPort && !portOptions(c, 'a').some((p) => p.name === c.aPort)" :value="c.aPort">{{ c.aPort }}</option>
                  <option v-for="p in portOptions(c, 'a')" :key="p.name" :value="p.name">{{ p.name }}{{ p.used && p.name !== c.aPort ? ` ${t('cablingPage.usedPort')}` : '' }}</option>
                </select>
              </td>
              <td class="px-1 py-1">
                <select class="cell w-28" :value="c.bItemId" :aria-label="cellLabel('bDevice', c)" @change="set(c, 'bItemId', ($event.target as HTMLSelectElement).value)">
                  <option value="">{{ t('projectCommon.select') }}</option>
                  <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </td>
              <td class="px-1 py-1">
                <select class="cell w-28" :value="c.bPort" :aria-label="cellLabel('bPort', c)" @change="set(c, 'bPort', ($event.target as HTMLSelectElement).value)">
                  <option value="">—</option>
                  <option v-if="c.bPort && !portOptions(c, 'b').some((p) => p.name === c.bPort)" :value="c.bPort">{{ c.bPort }}</option>
                  <option v-for="p in portOptions(c, 'b')" :key="p.name" :value="p.name">{{ p.name }}{{ p.used && p.name !== c.bPort ? ` ${t('cablingPage.usedPort')}` : '' }}</option>
                </select>
              </td>
              <td class="px-1 py-1">
                <select class="cell w-20" :value="c.type" :aria-label="cellLabel('type', c)" @change="set(c, 'type', ($event.target as HTMLSelectElement).value as Cable['type'])">
                  <option v-for="ty in CABLE_TYPES" :key="ty" :value="ty">{{ ty }}</option>
                </select>
              </td>
              <td class="px-1 py-1"><input class="cell w-16" type="number" min="0" :value="c.lengthM ?? ''" :aria-label="cellLabel('length', c)" @input="set(c, 'lengthM', numOrNull($event))" /></td>
              <td class="px-1 py-1">
                <select class="cell w-20" :value="c.mode" :aria-label="cellLabel('mode', c)" @change="set(c, 'mode', ($event.target as HTMLSelectElement).value as Cable['mode'])">
                  <option value="access">{{ t('cablingPage.modes.access') }}</option>
                  <option value="trunk">{{ t('cablingPage.modes.trunk') }}</option>
                </select>
              </td>
              <td class="px-1 py-1"><input class="cell w-16" type="number" min="1" max="4094" :value="c.vlan ?? ''" :aria-label="cellLabel('vlan', c)" @input="set(c, 'vlan', numOrNull($event))" /></td>
              <td class="px-1 py-1">
                <input class="cell w-24" :value="c.allowedVlans" :aria-label="cellLabel('allowed', c)" :disabled="c.mode !== 'trunk'" placeholder="10,20-30" maxlength="200" @input="set(c, 'allowedVlans', ($event.target as HTMLInputElement).value)" />
              </td>
              <td class="px-1 py-1"><input class="cell w-16" :value="c.bond" :aria-label="cellLabel('bond', c)" maxlength="20" @input="set(c, 'bond', ($event.target as HTMLInputElement).value)" /></td>
              <td class="px-1 py-1"><input class="cell w-32" :value="c.notes" :aria-label="cellLabel('notes', c)" maxlength="400" @input="set(c, 'notes', ($event.target as HTMLInputElement).value)" /></td>
              <td class="px-1 py-1 text-right">
                <button class="rounded p-1 text-muted hover:text-err" :title="t('projectCommon.remove')" :aria-label="`${t('projectCommon.remove')} · ${c.label || c.id}`" @click="project.removeCable(c.id)"><Trash2 class="size-3.5" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card p-4">
        <h2 class="mb-2 font-semibold">{{ t('projectCommon.issues') }}</h2>
        <p v-if="!project.cableIssues.length" class="text-sm text-ok">{{ t('projectCommon.noIssues') }}</p>
        <ul v-else class="space-y-1 text-sm">
          <li v-for="(i, n) in project.cableIssues" :key="n">
            <button class="flex w-full gap-2 rounded px-1 py-0.5 text-left hover:bg-surface-2" @click="focused = i.cableIds[0] ?? null">
              <span class="mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-semibold" :class="i.level === 'error' ? 'bg-err-soft text-err' : 'bg-warn-soft text-warn'">
                {{ t(`projectCommon.levels.${i.level}`) }}
              </span>
              <span>{{ t(`cablingPage.issues.${i.code}`, i.params) }}</span>
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
@reference '../style.css';

@layer components {
  .cell {
    @apply rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-xs text-fg outline-none hover:border-line focus:border-accent focus:bg-surface-2 disabled:opacity-40;
  }
}
</style>
