<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubnetInfo } from '@/types/network'
import { ipToInt } from '@/utils/network'

/** A horizontal bar from Network to Broadcast with a marker for the IP (and optional gateway). */
const props = defineProps<{ info: SubnetInfo; gateway?: string; highlight?: 'network' | 'broadcast' | 'hosts' | 'none' }>()
const { t } = useI18n()

function position(ip: string): number {
  const start = ipToInt(props.info.networkAddress)
  const span = props.info.totalAddresses - 1
  if (span === 0) return 50
  // Clamp so labels near the edges stay inside the bar.
  return Math.min(92, Math.max(8, ((ipToInt(ip) - start) / span) * 100))
}

const ipPos = computed(() => position(props.info.ip))
const gwInRange = computed(() => {
  if (!props.gateway) return false
  const g = ipToInt(props.gateway)
  return g >= ipToInt(props.info.networkAddress) && g <= ipToInt(props.info.broadcastAddress)
})
const gwPos = computed(() => (props.gateway && gwInRange.value ? position(props.gateway) : 0))
const hl = computed(() => props.highlight ?? 'none')
</script>

<template>
  <div class="pt-7 pb-1">
    <div class="relative h-9">
      <div class="absolute inset-0 flex overflow-hidden rounded-md border border-line font-mono text-[10px]">
        <div
          class="flex w-14 shrink-0 items-center justify-center border-r border-line transition-colors"
          :class="hl === 'network' ? 'bg-net text-bg' : 'bg-net-soft text-net'"
        >
          NET
        </div>
        <div
          class="flex flex-1 items-center justify-center transition-colors"
          :class="hl === 'hosts' ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted'"
        >
          {{ t('range.usable', { count: info.usableHosts.toLocaleString() }) }}
        </div>
        <div
          class="flex w-14 shrink-0 items-center justify-center border-l border-line transition-colors"
          :class="hl === 'broadcast' ? 'bg-host text-bg' : 'bg-host-soft text-host'"
        >
          BCAST
        </div>
      </div>
      <!-- IP marker -->
      <div class="absolute -top-6 -translate-x-1/2 transition-all duration-500" :style="{ left: `${ipPos}%` }">
        <div class="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-bg">{{ info.ip }}</div>
        <div class="mx-auto h-8 w-0.5 bg-accent" />
      </div>
      <div
        v-if="gateway && gwInRange"
        class="absolute top-full -translate-x-1/2 transition-all duration-500"
        :style="{ left: `${gwPos}%` }"
      >
        <div class="mx-auto h-2 w-0.5 bg-ok" />
        <div class="rounded bg-ok px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-bg">GW {{ gateway }}</div>
      </div>
    </div>
    <div class="mt-1 flex justify-between font-mono text-xs text-muted" :class="{ 'mt-7': gateway && gwInRange }">
      <span>{{ info.networkAddress }}</span>
      <span>{{ info.broadcastAddress }}</span>
    </div>
  </div>
</template>
