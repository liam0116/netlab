<script setup lang="ts">
import { computed } from 'vue'
import BitGrid from './BitGrid.vue'
import BitLegend from './BitLegend.vue'
import { calculateSubnet, cidrToMaskInt, ipToInt } from '@/utils/network'

/**
 * and: IP AND Mask = Network
 * or:  Network OR Wildcard = Broadcast
 */
const props = defineProps<{ ip: string; cidr: number; op: 'and' | 'or' }>()

const info = computed(() => calculateSubnet(props.ip, props.cidr))
const rows = computed(() => {
  const mask = cidrToMaskInt(props.cidr)
  if (props.op === 'and') {
    return [
      { label: `IP ${info.value.ip}`, value: ipToInt(info.value.ip) },
      { label: `AND Mask ${info.value.subnetMask}`, value: mask },
      { label: `= Network ${info.value.networkAddress}`, value: ipToInt(info.value.networkAddress) },
    ]
  }
  return [
    { label: `Network ${info.value.networkAddress}`, value: ipToInt(info.value.networkAddress) },
    { label: `OR Wildcard ${info.value.wildcardMask}`, value: ~mask >>> 0 },
    { label: `= Broadcast ${info.value.broadcastAddress}`, value: ipToInt(info.value.broadcastAddress) },
  ]
})
</script>

<template>
  <div class="space-y-3">
    <BitGrid v-for="row in rows" :key="row.label" :value="row.value" :cidr="cidr" :label="row.label" />
    <BitLegend :network-bits="cidr" />
  </div>
</template>
