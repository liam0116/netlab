<script setup lang="ts">
import { computed } from 'vue'
import { compactBlocks, getSubnetBlocks } from '@/utils/network'

/** Shows the block-size method: 256 − mask octet, and which block the IP falls into. */
const props = defineProps<{ ip: string; cidr: number }>()

const breakdown = computed(() => getSubnetBlocks(props.ip, props.cidr))
const display = computed(() => compactBlocks(breakdown.value.blocks))
const hit = computed(() => breakdown.value.blocks.find((b) => b.containsIp))
const octetNumber = computed(() => breakdown.value.octetIndex + 1)
</script>

<template>
  <div class="space-y-3 text-sm">
    <i18n-t keypath="blocks.intro" tag="p" class="text-muted" scope="global">
      <template #octet><span class="text-fg">{{ octetNumber }}</span></template>
      <template #mask><span class="font-mono text-fg">{{ breakdown.maskOctet }}</span></template>
    </i18n-t>
    <div class="font-mono text-base">
      256 − {{ breakdown.maskOctet }} = <span class="font-bold text-accent">{{ breakdown.blockSize }}</span>
    </div>
    <i18n-t v-if="breakdown.totalBlocks > 1" keypath="blocks.split" tag="p" class="text-muted" scope="global">
      <template #octet>{{ octetNumber }}</template>
      <template #count>{{ breakdown.totalBlocks }}</template>
    </i18n-t>
    <div class="flex flex-wrap gap-1.5 font-mono text-xs">
      <template v-for="(b, i) in display" :key="i">
        <span v-if="b === null" class="px-1 py-1 text-muted">…</span>
        <span
          v-else
          class="rounded border px-2 py-1 transition-colors"
          :class="b.containsIp ? 'border-accent bg-accent-soft font-bold text-accent' : 'border-line text-muted'"
        >
          {{ b.start }}-{{ b.end }}
        </span>
      </template>
    </div>
    <i18n-t v-if="hit" keypath="blocks.result" tag="p" scope="global">
      <template #value><span class="font-mono text-accent">{{ breakdown.ipOctet }}</span></template>
      <template #range><span class="font-mono">{{ hit.start }}-{{ hit.end }}</span></template>
      <template #network><span class="font-mono text-net">{{ hit.start }}</span></template>
      <template #broadcast><span class="font-mono text-host">{{ hit.end }}</span></template>
    </i18n-t>
  </div>
</template>
