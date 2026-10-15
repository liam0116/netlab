<script setup lang="ts">
import { computed } from 'vue'
import CopyButton from '@/components/common/CopyButton.vue'

/** Terminal-style aligned "key   value" output for Engineer Mode, with a copy button. */
const props = defineProps<{ title: string; rows: [string, string][] }>()

const width = computed(() => Math.max(...props.rows.map(([k]) => k.length)) + 3)
const text = computed(() => props.rows.map(([k, v]) => `${k.padEnd(width.value)}${v}`).join('\n'))
</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2">
      <span class="font-mono text-sm"><span class="text-accent">$</span> {{ title }}</span>
      <CopyButton :text="`${title}\n${text}`" label="Copy" />
    </div>
    <pre class="overflow-x-auto p-4 font-mono text-sm leading-relaxed"><template v-for="([k, v], i) in rows" :key="k"><span class="text-muted">{{ k.padEnd(width) }}</span><span class="text-fg">{{ v }}</span>{{ i < rows.length - 1 ? '\n' : '' }}</template></pre>
  </div>
</template>
