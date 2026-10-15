<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { describeMac } from '@/utils/mac'

const props = defineProps<{ mac: string; highlight?: 'oui' | 'nic' | 'bits' }>()
const { t } = useI18n()
const info = computed(() => describeMac(props.mac))
const bytes = computed(() => info.value.mac.split(':'))
</script>

<template>
  <div class="space-y-4 font-mono">
    <div class="flex flex-wrap items-end justify-center gap-1">
      <template v-for="(b, i) in bytes" :key="i">
        <span
          class="rounded-md border px-2.5 py-2 text-xl font-bold transition-colors sm:text-2xl"
          :class="
            i < 3
              ? highlight === 'nic'
                ? 'border-line text-muted'
                : 'border-net/50 bg-net-soft text-net'
              : highlight === 'oui'
                ? 'border-line text-muted'
                : 'border-host/50 bg-host-soft text-host'
          "
        >
          {{ b }}
        </span>
        <span v-if="i < 5" class="pb-2 text-muted">:</span>
      </template>
    </div>
    <div class="grid grid-cols-2 gap-2 text-center font-sans text-xs">
      <div class="rounded border border-net/40 px-2 py-1.5 text-net">{{ t('visuals.mac.oui') }}<br /><span class="font-mono">{{ info.oui }}</span></div>
      <div class="rounded border border-host/40 px-2 py-1.5 text-host">{{ t('visuals.mac.nic') }}<br /><span class="font-mono">{{ info.nic }}</span></div>
    </div>
    <div v-if="highlight === 'bits'" class="space-y-2 rounded-lg border border-line bg-surface-2 p-3 text-xs">
      <div class="font-sans text-muted">{{ t('visuals.mac.firstByte') }} ({{ bytes[0] }})</div>
      <div class="flex gap-1">
        <span
          v-for="(bit, i) in info.firstByteBits.split('')"
          :key="i"
          class="flex size-7 items-center justify-center rounded border text-sm font-bold"
          :class="i === 7 ? 'border-accent bg-accent-soft text-accent' : i === 6 ? 'border-warn bg-warn-soft text-warn' : 'border-line text-muted'"
        >
          {{ bit }}
        </span>
      </div>
      <div class="font-sans text-accent">{{ t('visuals.mac.ig', { value: info.multicast ? 1 : 0 }) }}</div>
      <div class="font-sans text-warn">{{ t('visuals.mac.ul', { value: info.locallyAdministered ? 1 : 0 }) }}</div>
    </div>
  </div>
</template>
