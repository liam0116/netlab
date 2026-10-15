<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Flowchart, FlowNodeType } from '@/types/project'
import { layoutFlowchart } from '@/utils/flowchart'

/** Renders a flowchart with the layered layout. Inline styles so it exports cleanly. */
const props = withDefaults(defineProps<{ chart: Flowchart; yesLabel?: string; noLabel?: string; selectedId?: string | null }>(), {
  yesLabel: 'Yes',
  noLabel: 'No',
  selectedId: null,
})
const emit = defineEmits<{ select: [id: string] }>()

const layout = computed(() => layoutFlowchart(props.chart))
const svg = ref<SVGSVGElement | null>(null)
defineExpose({ svg })

const COLOR: Record<FlowNodeType, string> = { start: 'accent', step: 'net', decision: 'warn', end: 'ok' }

/** Wraps text by visual width: CJK characters count double. */
function wrap(text: string, maxUnits: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  let units = 0
  const words = text.split(/(\s+)/)
  for (const word of words) {
    for (const ch of word.length > maxUnits || /[　-鿿＀-￯]/.test(word) ? [...word] : [word]) {
      const w = [...ch].reduce((s, c) => s + (/[　-鿿＀-￯]/.test(c) ? 2 : 1), 0)
      if (units + w > maxUnits && line.trim()) {
        lines.push(line.trim())
        line = ''
        units = 0
      }
      line += ch
      units += w
    }
  }
  if (line.trim()) lines.push(line.trim())
  if (lines.length > maxLines) return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1]}…`]
  return lines
}

const pathOf = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
</script>

<template>
  <svg ref="svg" :viewBox="`0 0 ${layout.width} ${layout.height}`" class="h-auto w-full" role="img" :aria-label="chart.title">
    <defs>
      <marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--muted)" />
      </marker>
    </defs>

    <g v-for="(e, i) in layout.edges" :key="i">
      <path :d="pathOf(e.points)" marker-end="url(#fc-arrow)" :style="{ fill: 'none', stroke: 'var(--muted)', strokeWidth: 1.5, strokeDasharray: e.back ? '5 4' : 'none' }" />
      <text
        v-if="e.label"
        :x="e.points[0]!.x + (e.back ? 14 : e.points.length > 2 ? (e.points[2]!.x > e.points[0]!.x ? 10 : e.points[2]!.x < e.points[0]!.x ? -10 : 8) : 8)"
        :y="e.points[0]!.y + (e.back ? -6 : 14)"
        :text-anchor="e.points.length > 2 && e.points[2]!.x < e.points[0]!.x ? 'end' : 'start'"
        :style="{ fill: e.label === 'yes' ? 'var(--ok)' : 'var(--err)', fontSize: '11px', fontWeight: 600 }"
      >
        {{ e.label === 'yes' ? yesLabel : noLabel }}
      </text>
    </g>

    <g v-for="n in layout.nodes" :key="n.node.id" style="cursor: pointer" @click="emit('select', n.node.id)">
      <polygon
        v-if="n.node.type === 'decision'"
        :points="`${n.x},${n.y - n.h / 2} ${n.x + n.w / 2},${n.y} ${n.x},${n.y + n.h / 2} ${n.x - n.w / 2},${n.y}`"
        :style="{ fill: 'var(--surface)', stroke: selectedId === n.node.id ? 'var(--accent)' : `var(--${COLOR.decision})`, strokeWidth: selectedId === n.node.id ? 3 : 2 }"
      />
      <rect
        v-else
        :x="n.x - n.w / 2"
        :y="n.y - n.h / 2"
        :width="n.w"
        :height="n.h"
        :rx="n.node.type === 'step' ? 8 : n.h / 2"
        :style="{
          fill: n.node.type === 'step' ? 'var(--surface)' : `var(--${COLOR[n.node.type]}-soft)`,
          stroke: selectedId === n.node.id ? 'var(--accent)' : `var(--${COLOR[n.node.type]})`,
          strokeWidth: selectedId === n.node.id ? 3 : 2,
        }"
      />
      <text
        v-for="(line, i) in wrap(n.node.text, n.node.type === 'decision' ? 18 : 28, n.node.type === 'decision' ? 2 : 3)"
        :key="i"
        :x="n.x"
        :y="n.y + (i - (wrap(n.node.text, n.node.type === 'decision' ? 18 : 28, n.node.type === 'decision' ? 2 : 3).length - 1) / 2) * 15 + 4"
        text-anchor="middle"
        :style="{ fill: 'var(--fg)', fontSize: '12px', fontWeight: n.node.type === 'step' ? 400 : 600 }"
      >
        {{ line }}
      </text>
    </g>
  </svg>
</template>
