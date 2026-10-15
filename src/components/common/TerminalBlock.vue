<script setup lang="ts">
import CopyButton from './CopyButton.vue'

defineProps<{ command: string; output?: string }>()
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-line bg-surface-2 font-mono text-sm">
    <div class="flex items-start justify-between gap-2 border-b border-line px-3 py-2">
      <span class="min-w-0 break-all whitespace-pre-wrap"><span class="text-accent">$</span> {{ command }}</span>
      <CopyButton :text="command" />
    </div>
    <pre v-if="output" class="overflow-x-auto px-3 py-2 leading-relaxed text-muted">{{ output }}</pre>
  </div>
</template>
