<script setup lang="ts">
import { computed } from 'vue'
import type { SequenceMessage } from '@/types/tutorial'

/**
 * Lifelines for each actor and one arrow per message. Messages up to `step` are drawn; the newest
 * one animates in. Rows for future messages are reserved so the diagram does not jump.
 */
const props = defineProps<{ actors: string[]; messages: SequenceMessage[]; step: number }>()

const W = 640
const TOP = 52
const ROW = 46
const height = computed(() => TOP + Math.max(props.messages.length, 1) * ROW + 16)
const xs = computed(() => props.actors.map((_, i) => 60 + (i * (W - 120)) / Math.max(props.actors.length - 1, 1)))
const visible = computed(() => props.messages.slice(0, Math.max(0, Math.min(props.step, props.messages.length))))

const toneClass: Record<NonNullable<SequenceMessage['tone']>, string> = {
  accent: 'text-accent',
  host: 'text-host',
  net: 'text-net',
  ok: 'text-ok',
  warn: 'text-warn',
  err: 'text-err',
}

function arrow(m: SequenceMessage, row: number) {
  const x1 = xs.value[m.from] ?? 0
  const fullX2 = xs.value[m.to] ?? 0
  const x2 = m.lost ? x1 + (fullX2 - x1) * 0.55 : fullX2
  const y = TOP + row * ROW + 26
  const dir = Math.sign(fullX2 - x1) || 1
  return { x1, x2, y, dir, mid: (x1 + fullX2) / 2 }
}
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${height}`" class="w-full" role="img" :aria-label="actors.join(', ')">
    <!-- actors -->
    <g v-for="(actor, i) in actors" :key="actor">
      <rect :x="xs[i]! - 54" y="4" width="108" height="30" rx="6" class="fill-surface-2 stroke-line" />
      <text :x="xs[i]" y="24" text-anchor="middle" class="fill-fg text-[12px] font-semibold">{{ actor }}</text>
      <line :x1="xs[i]" :x2="xs[i]" :y1="34" :y2="height - 6" class="stroke-line" stroke-dasharray="4 4" />
    </g>

    <!-- messages -->
    <g
      v-for="(m, row) in visible"
      :key="row"
      :class="[toneClass[m.tone ?? 'accent'], row === visible.length - 1 ? 'seq-new' : '']"
    >
      <line
        :x1="arrow(m, row).x1"
        :x2="arrow(m, row).x2"
        :y1="arrow(m, row).y"
        :y2="arrow(m, row).y"
        stroke="currentColor"
        stroke-width="2"
        :stroke-dasharray="m.lost ? '5 4' : undefined"
      />
      <path
        v-if="!m.lost"
        :d="`M ${arrow(m, row).x2} ${arrow(m, row).y} l ${-8 * arrow(m, row).dir} -5 v 10 z`"
        fill="currentColor"
      />
      <text v-else :x="arrow(m, row).x2 + 8 * arrow(m, row).dir" :y="arrow(m, row).y + 5" text-anchor="middle" class="text-[15px] font-bold" fill="currentColor">✗</text>
      <text :x="arrow(m, row).mid" :y="arrow(m, row).y - 7" text-anchor="middle" class="font-mono text-[11px] font-semibold" fill="currentColor">
        {{ m.label }}
      </text>
      <text v-if="m.detail" :x="arrow(m, row).mid" :y="arrow(m, row).y + 15" text-anchor="middle" class="fill-muted font-mono text-[10px]">
        {{ m.detail }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.seq-new {
  animation: seq-in 0.5s ease-out;
}
@keyframes seq-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
