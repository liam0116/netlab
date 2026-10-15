<script setup lang="ts">
import { computed } from 'vue'
import { intToOctets, ipToInt, toBinaryOctet } from '@/utils/network'

/** Four big octet boxes showing decimal above binary. */
const props = defineProps<{ ip: string; highlight?: number }>()
const octets = computed(() => intToOctets(ipToInt(props.ip)))
</script>

<template>
  <div class="flex flex-wrap items-end justify-center gap-1 font-mono sm:gap-2">
    <template v-for="(o, i) in octets" :key="i">
      <div
        class="flex flex-col items-center rounded-lg border px-2 py-2 transition-colors duration-300 sm:px-3"
        :class="highlight === i ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2'"
      >
        <span class="text-xl font-bold sm:text-2xl" :class="highlight === i ? 'text-accent' : ''">{{ o }}</span>
        <span class="mt-1 text-[10px] tracking-wider text-muted sm:text-xs">{{ toBinaryOctet(o) }}</span>
        <span class="mt-0.5 text-[10px] text-muted/70">octet {{ i + 1 }} · 8 bits</span>
      </div>
      <span v-if="i < 3" class="pb-8 text-2xl text-muted">.</span>
    </template>
  </div>
</template>
