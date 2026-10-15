<script setup lang="ts">
import { computed } from 'vue'
import { intToOctets, toBitArray } from '@/utils/network'

/**
 * Renders a 32-bit value as 4 octets of bits, colouring network bits (index < cidr)
 * and host bits differently. `revealed` limits how many leading bits are coloured, for animations.
 */
const props = withDefaults(
  defineProps<{
    value: number
    cidr?: number
    revealed?: number
    label?: string
    showDecimal?: boolean
    dimHost?: boolean
  }>(),
  { cidr: undefined, revealed: 32, label: '', showDecimal: true, dimHost: false },
)

const bits = computed(() => toBitArray(props.value))
const octets = computed(() => intToOctets(props.value))

function cellClass(index: number): string {
  if (props.cidr === undefined || index >= props.revealed) return 'border-line bg-surface-2 text-fg'
  if (index < props.cidr) return 'border-net/50 bg-net-soft text-net'
  return props.dimHost ? 'border-line bg-surface-2 text-muted/60' : 'border-host/50 bg-host-soft text-host'
}
</script>

<template>
  <div>
    <div v-if="label" class="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{{ label }}</div>
    <div class="flex flex-wrap gap-x-2 gap-y-2">
      <div v-for="o in 4" :key="o" class="flex flex-col items-center">
        <div class="flex gap-0.5">
          <span
            v-for="b in 8"
            :key="b"
            class="flex size-6 items-center justify-center rounded border font-mono text-xs font-semibold transition-colors duration-300 sm:size-7 sm:text-sm"
            :class="cellClass((o - 1) * 8 + (b - 1))"
          >
            {{ bits[(o - 1) * 8 + (b - 1)] }}
          </span>
        </div>
        <span v-if="showDecimal" class="mt-1 font-mono text-xs text-muted">{{ octets[o - 1] }}</span>
      </div>
    </div>
  </div>
</template>
