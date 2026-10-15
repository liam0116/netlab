<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-vue-next'

const props = defineProps<{ variant: 'ok' | 'warn' | 'err' | 'info'; title: string }>()

const style = computed(
  () =>
    ({
      ok: { icon: CircleCheck, cls: 'border-ok/40 bg-ok-soft text-ok' },
      warn: { icon: TriangleAlert, cls: 'border-warn/40 bg-warn-soft text-warn' },
      err: { icon: CircleX, cls: 'border-err/40 bg-err-soft text-err' },
      info: { icon: Info, cls: 'border-accent/40 bg-accent-soft text-accent' },
    })[props.variant],
)
</script>

<template>
  <div class="flex gap-3 rounded-lg border px-4 py-3" :class="style.cls" role="status">
    <component :is="style.icon" class="mt-0.5 size-5 shrink-0" />
    <div class="min-w-0">
      <div class="font-semibold">{{ title }}</div>
      <div v-if="$slots.default" class="mt-1 text-sm text-fg/85"><slot /></div>
    </div>
  </div>
</template>
