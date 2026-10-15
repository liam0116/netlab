<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { decimalToBinarySteps, PLACE_VALUES } from '@/utils/network'

/**
 * Decimal → binary, one place value at a time.
 * `step`: 0 = idle, 1 ~ 8 = bit (step − 1) was just decided and is explained, 9 = final result.
 */
const props = defineProps<{ value: number; step: number }>()
const { t } = useI18n()

const steps = computed(() => decimalToBinarySteps(props.value))
const active = computed(() => (props.step >= 1 && props.step <= 8 ? steps.value[props.step - 1] : undefined))
const done = computed(() => props.step >= 9)
const binary = computed(() => steps.value.map((s) => s.bit).join(''))
const terms = computed(() => steps.value.filter((s) => s.bit === 1).map((s) => s.placeValue))
</script>

<template>
  <div class="space-y-5">
    <!-- Place value table -->
    <div class="overflow-x-auto">
      <table class="mx-auto border-separate border-spacing-1 font-mono">
        <tbody>
          <tr>
            <td
              v-for="(pv, i) in PLACE_VALUES"
              :key="pv"
              class="w-11 rounded-md border px-1 py-1.5 text-center text-xs transition-all duration-300 sm:w-14 sm:text-sm"
              :class="i === step - 1 && !done ? 'scale-110 border-accent bg-accent-soft text-accent' : 'border-line text-muted'"
            >
              {{ pv }}
            </td>
          </tr>
          <tr>
            <td
              v-for="(s, i) in steps"
              :key="s.placeValue"
              class="h-11 rounded-md border text-center text-lg font-bold transition-all duration-300 sm:h-12 sm:text-xl"
              :class="
                i < step
                  ? s.bit
                    ? 'border-net/60 bg-net-soft text-net'
                    : 'border-line bg-surface-2 text-muted'
                  : 'border-dashed border-line text-transparent'
              "
            >
              {{ i < step ? s.bit : '·' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Current step explanation -->
    <div class="min-h-24 rounded-lg border border-line bg-surface-2 p-4 font-mono text-sm">
        <div v-if="active" :key="step" class="anim-slide space-y-1.5">
          <div>
            <span class="text-muted">{{ t('binaryAnim.remaining') }}</span> {{ active.remainderBefore }}
            <span :class="active.bit ? 'text-ok' : 'text-err'">{{ active.bit ? '>=' : '<' }}</span>
            {{ active.placeValue }}
          </div>
          <div>
            {{ t('binaryAnim.soBit') }} <span class="font-bold" :class="active.bit ? 'text-net' : 'text-muted'">{{ active.bit }}</span>
          </div>
          <div v-if="active.bit">
            {{ active.remainderBefore }} − {{ active.placeValue }} =
            <span class="text-accent">{{ active.remainderAfter }}</span>
          </div>
          <div v-else class="text-muted">{{ t('binaryAnim.noFit', { value: active.remainderAfter }) }}</div>
        </div>
        <div v-else-if="done" key="done" class="anim-slide space-y-1.5">
          <div class="text-lg">
            {{ value }} <span class="text-muted">→</span>
            <span class="font-bold tracking-widest text-net">{{ binary }}</span>
          </div>
          <div class="text-muted">
            = {{ terms.length ? terms.join(' + ') : '0' }} = <span class="text-fg">{{ value }}</span>
          </div>
        </div>
        <div v-else key="idle" class="anim-fade text-muted">{{ t('binaryAnim.idle') }}</div>
    </div>
  </div>
</template>

