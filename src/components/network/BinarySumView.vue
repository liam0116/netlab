<script setup lang="ts">
import { computed } from 'vue'
import { binaryToDecimal, PLACE_VALUES } from '@/utils/network'

/** Binary → decimal: shows which place values are switched on and adds them up. */
const props = defineProps<{ binary: string }>()
const result = computed(() => binaryToDecimal(props.binary))
</script>

<template>
  <div class="space-y-4">
    <div class="overflow-x-auto">
      <table class="mx-auto border-separate border-spacing-1 font-mono">
        <tbody>
          <tr>
            <td
              v-for="(pv, i) in PLACE_VALUES"
              :key="pv"
              class="w-11 rounded-md border px-1 py-1.5 text-center text-xs sm:w-14 sm:text-sm"
              :class="result.bits[i] ? 'border-net/60 text-net' : 'border-line text-muted/60'"
            >
              {{ pv }}
            </td>
          </tr>
          <tr>
            <td
              v-for="(bit, i) in result.bits"
              :key="i"
              class="h-11 rounded-md border text-center text-lg font-bold transition-colors duration-300 sm:h-12 sm:text-xl"
              :class="bit ? 'border-net/60 bg-net-soft text-net' : 'border-line bg-surface-2 text-muted'"
            >
              {{ bit }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="rounded-lg border border-line bg-surface-2 p-4 text-center font-mono">
      <span class="tracking-widest">{{ result.bits.join('') }}</span>
      <span class="mx-2 text-muted">=</span>
      <span>{{ result.terms.length ? result.terms.join(' + ') : '0' }}</span>
      <span class="mx-2 text-muted">=</span>
      <span class="text-lg font-bold text-accent">{{ result.value }}</span>
    </div>
  </div>
</template>
