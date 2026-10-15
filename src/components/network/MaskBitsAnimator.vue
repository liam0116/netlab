<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BitGrid from './BitGrid.vue'
import BitLegend from './BitLegend.vue'
import { cidrToMask, cidrToMaskInt, intToOctets, maskOctetBitCounts } from '@/utils/network'

/**
 * Mask → CIDR animation.
 * step 0: binary only · step 1..4: count network bits octet by octet · step 5: final /CIDR.
 */
const props = defineProps<{ cidr: number; step: number }>()
const { t } = useI18n()

const mask = computed(() => cidrToMask(props.cidr))
const maskInt = computed(() => cidrToMaskInt(props.cidr))
const octets = computed(() => intToOctets(maskInt.value))
const counts = computed(() => maskOctetBitCounts(mask.value))
const counted = computed(() => Math.min(props.step, 4))
const runningSum = computed(() => counts.value.slice(0, counted.value).reduce((a, b) => a + b, 0))
</script>

<template>
  <div class="space-y-5">
    <div class="text-center font-mono text-lg">{{ mask }}</div>

    <div class="flex justify-center">
      <BitGrid :value="maskInt" :cidr="cidr" :revealed="counted * 8" :show-decimal="false" />
    </div>

    <div class="grid grid-cols-4 gap-2 text-center font-mono text-sm">
      <div
        v-for="(c, i) in counts"
        :key="i"
        class="rounded-md border px-2 py-2 transition-all duration-300"
        :class="i < counted ? 'border-net/50 bg-net-soft' : 'border-line opacity-50'"
      >
        <div class="text-xs text-muted">{{ octets[i] }}</div>
        <div class="text-lg font-bold" :class="i < counted ? 'text-net' : 'text-muted'">
          {{ i < counted ? c : '?' }}
        </div>
        <div class="text-[10px] text-muted">{{ t('maskAnim.ones') }}</div>
      </div>
    </div>

    <div class="min-h-16 rounded-lg border border-line bg-surface-2 p-4 text-center font-mono">
      <template v-if="step === 0">
        <span class="text-muted">{{ t('maskAnim.intro') }}</span>
      </template>
      <template v-else-if="step < 5">
        {{ counts.slice(0, counted).join(' + ') }}
        <span class="text-muted">=</span>
        <span class="font-bold text-net">{{ runningSum }}</span>
      </template>
      <template v-else>
        <div>{{ counts.join(' + ') }} = {{ cidr }}</div>
        <div class="mt-1 text-xl">
          {{ mask }} <span class="text-muted">=</span> <span class="font-bold text-accent">/{{ cidr }}</span>
        </div>
      </template>
    </div>

    <div class="flex justify-center"><BitLegend v-if="step >= 1" :network-bits="cidr" /></div>
  </div>
</template>
