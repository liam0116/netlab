<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MaintenanceJob } from '@/types/project'
import { useMaintenanceText } from '@/composables/useMaintenanceText'
import { analyzeJob } from '@/utils/maintenance'

/**
 * A work order as a printable sheet: lines with tick boxes and the per-machine check list.
 * `paper` adds blanks to fill in by hand, for a sheet printed in the office and carried into the machine room.
 */
const props = defineProps<{ job: MaintenanceJob; paper?: boolean }>()
const { t } = useI18n()
const { opText, opDetail, changeText, slots } = useMaintenanceText()
const analysis = computed(() => analyzeJob(props.job))

function slotLine(dir: string, peer: string): string {
  return t(`maintenancePage.slotDir.${dir}`, { peer })
}
</script>

<template>
  <div class="space-y-4 text-sm">
    <div class="sheet-block">
      <h3 class="text-base font-semibold">{{ job.title || t('maintenancePage.untitled') }}</h3>
      <div class="mt-1 flex flex-wrap gap-x-6 text-xs text-muted">
        <span v-if="job.ticket">{{ t('maintenancePage.ticket') }} <span class="font-mono text-fg">{{ job.ticket }}</span></span>
        <span v-if="job.date">{{ t('maintenancePage.date') }} <span class="font-mono text-fg">{{ job.date }}</span></span>
      </div>
      <p v-if="job.notes" class="mt-2 whitespace-pre-line text-muted">{{ job.notes }}</p>
      <div v-if="paper" class="mt-3 grid grid-cols-2 gap-8 text-xs">
        <div v-for="f in ['startTime', 'endTime'] as const" :key="f" class="flex items-end gap-2">
          <span class="shrink-0 text-muted">{{ t(`maintenancePage.${f}`) }}</span>
          <span class="flex-1 border-b border-fg/40 font-mono">{{ job[f] || '\u00a0' }}</span>
        </div>
      </div>
    </div>

    <table class="sheet-table">
      <thead>
        <tr>
          <th class="w-8">✓</th>
          <th class="w-8">#</th>
          <th>{{ t('maintenancePage.sheetCols.action') }}</th>
          <th>{{ t('maintenancePage.sheetCols.part') }}</th>
          <th>{{ t('maintenancePage.cols.serial') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(op, i) in job.ops" :key="op.id" :class="{ 'h-12': paper }">
          <td class="text-center text-base leading-none">{{ op.done ? '☑' : '☐' }}</td>
          <td class="font-mono">{{ i + 1 }}</td>
          <td>
            {{ opText(op) }}
            <div v-if="op.notes" class="text-xs text-muted">{{ op.notes }}</div>
          </td>
          <td class="text-xs">{{ opDetail(op) }}</td>
          <td class="font-mono text-xs">{{ op.serial }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="analysis.hosts.length">
      <h4 class="mb-1 font-semibold">{{ t('maintenancePage.byHost') }}</h4>
      <table class="sheet-table">
        <thead>
          <tr>
            <th>{{ t('maintenancePage.sheetCols.host') }}</th>
            <th>{{ t('maintenancePage.sheetCols.slots') }}</th>
            <th>{{ t('maintenancePage.sheetCols.verify') }}</th>
            <th v-if="paper" class="w-1/4">{{ t('maintenancePage.sheetCols.actual') }}</th>
            <th class="w-8">✓</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in analysis.hosts" :key="h.host">
            <td class="font-medium">{{ h.host }}</td>
            <td class="text-xs">
              <div v-for="s in h.slots" :key="s.slot">
                <span class="font-mono font-semibold">{{ s.slot }}</span>
                <span v-for="(e, k) in s.events" :key="k" class="ml-1.5">{{ slotLine(e.dir, e.peer) }}</span>
              </div>
            </td>
            <td class="text-xs">{{ changeText(h) }}</td>
            <td v-if="paper" class="text-xs">{{ job.actual[h.host] }}</td>
            <td class="text-center text-base leading-none">☐</td>
          </tr>
        </tbody>
      </table>
      <p class="mt-1 text-xs text-muted">{{ t('maintenancePage.slotsNote', { example: slots('A1-A4') }) }}</p>
    </div>

    <div v-if="paper" class="sheet-block">
      <h4 class="mb-1 font-semibold">{{ t('maintenancePage.fieldNotes') }}</h4>
      <p v-if="job.fieldNotes.trim()" class="whitespace-pre-line">{{ job.fieldNotes }}</p>
      <!-- Room to keep writing by hand, a little less when something was typed already. -->
      <div v-for="n in job.fieldNotes.trim() ? 2 : 4" :key="n" class="h-7 border-b border-fg/30" />
    </div>

  </div>
</template>

<style scoped>
@reference '../../style.css';

@layer components {
  .sheet-table {
    @apply w-full border-collapse;
  }
  .sheet-table :where(th, td) {
    @apply border border-line px-2 py-1 text-left align-top;
  }
  .sheet-table thead th {
    @apply bg-surface-2 text-xs font-semibold;
  }
  .sheet-table tr,
  .sheet-block {
    break-inside: avoid;
  }
}
</style>
