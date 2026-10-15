<script setup lang="ts">
import CopyButton from './CopyButton.vue'
import type { KeyValueRow } from '@/types/app'

defineProps<{ rows: KeyValueRow[] }>()

const toneClass: Record<NonNullable<KeyValueRow['tone']>, string> = {
  net: 'text-net',
  host: 'text-host',
  accent: 'text-accent',
  ok: 'text-ok',
  err: 'text-err',
}
</script>

<template>
  <dl class="divide-y divide-line">
    <div v-for="row in rows" :key="row.label" class="group flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
      <dt class="w-40 shrink-0 text-sm text-muted">{{ row.label }}</dt>
      <dd class="min-w-0 flex-1 font-mono text-sm break-all" :class="row.tone ? toneClass[row.tone] : ''">
        {{ row.value }}
        <span v-if="row.hint" class="ml-2 font-sans text-xs text-muted">{{ row.hint }}</span>
      </dd>
      <CopyButton v-if="row.copy !== false" :text="row.value" class="opacity-0 group-hover:opacity-100 focus:opacity-100" />
    </div>
  </dl>
</template>
