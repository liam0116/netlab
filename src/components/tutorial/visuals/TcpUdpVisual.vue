<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const rows = ['connection', 'reliable', 'order', 'overhead', 'uses'] as const
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-line">
    <table class="w-full text-sm">
      <thead class="bg-surface-2 text-left text-xs text-muted">
        <tr>
          <th class="px-3 py-2 font-medium">{{ t('visuals.tcpUdp.feature') }}</th>
          <th class="px-3 py-2 font-mono font-semibold text-accent">TCP</th>
          <th class="px-3 py-2 font-mono font-semibold text-host">UDP</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r" class="border-t border-line">
          <td class="px-3 py-2 text-muted">{{ t(`visuals.tcpUdp.rows.${r}.label`) }}</td>
          <td class="px-3 py-2">{{ t(`visuals.tcpUdp.rows.${r}.tcp`) }}</td>
          <td class="px-3 py-2">{{ t(`visuals.tcpUdp.rows.${r}.udp`) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
