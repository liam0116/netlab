<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ServiceFlow, ServiceKind, ServiceNode } from '@/types/project'
import { layoutServices, splitAddresses } from '@/utils/flows'

/**
 * Service interaction diagram: one column per zone, arrows labelled with protocol / port.
 * Inline styles with CSS variables so it exports cleanly (utils/svgExport).
 */
const props = defineProps<{ nodes: ServiceNode[]; flows: ServiceFlow[]; highlight?: string | null }>()

const W = 180
const H = 54
const COL = 300
const ROW = 110
const TOP = 56
const layout = computed(() => layoutServices(props.nodes, COL, ROW, TOP))
const svg = ref<SVGSVGElement | null>(null)
defineExpose({ svg })

const KIND_COLOR: Record<ServiceKind, string> = {
  client: 'net',
  lb: 'warn',
  app: 'accent',
  db: 'host',
  storage: 'host',
  mgmt: 'ok',
  external: 'muted',
  other: 'muted',
}

interface Arrow {
  key: string
  ids: string[]
  points: { x: number; y: number }[]
  lines: string[]
  lx: number
  ly: number
}

const label = (f: ServiceFlow) => `${f.protocol}${f.protocol === 'ICMP' ? '' : ` ${f.ports.replace(/\s/g, '')}`}`

/**
 * Orthogonal routing through the empty lanes: columns are COL wide with W-wide boxes, so there is
 * a free vertical lane on each column boundary, and rows leave a horizontal lane between them.
 * Flows between the same pair (same direction) share one arrow with a multi-line label.
 */
const arrows = computed<Arrow[]>(() => {
  const pos = layout.value.nodes
  const groups = new Map<string, ServiceFlow[]>()
  for (const f of props.flows) {
    if (f.from === f.to || !pos.has(f.from) || !pos.has(f.to)) continue
    const key = `${f.from}>${f.to}`
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  const laneUse = new Map<number, number>()
  const nextOffset = (lane: number) => {
    const n = laneUse.get(lane) ?? 0
    laneUse.set(lane, n + 1)
    return (n % 2 ? -1 : 1) * Math.ceil(n / 2) * 8
  }
  const rowLane = (y: number) => {
    const k = Math.round((y - TOP) / ROW)
    return TOP + k * ROW
  }
  const out: Arrow[] = []
  for (const [key, flows] of groups) {
    const a = pos.get(flows[0]!.from)!
    const b = pos.get(flows[0]!.to)!
    const lines = flows.map(label)
    let points: { x: number; y: number }[]
    if (Math.abs(a.x - b.x) < 1) {
      // Same zone: out of the right side, down the column's right lane, back in.
      const lane = a.x + COL / 2
      const x = lane - 14 + nextOffset(lane)
      points = [{ x: a.x + W / 2, y: a.y + 6 }, { x, y: a.y + 6 }, { x, y: b.y - 6 }, { x: b.x + W / 2 + 2, y: b.y - 6 }]
    } else {
      const dir = Math.sign(b.x - a.x)
      const laneA = a.x + (dir * COL) / 2
      const laneB = b.x - (dir * COL) / 2
      const xa = laneA + nextOffset(laneA)
      if (Math.abs(laneA - laneB) < 1) {
        points = [{ x: a.x + (dir * W) / 2, y: a.y }, { x: xa, y: a.y }, { x: xa, y: b.y }, { x: b.x - (dir * W) / 2 - dir * 2, y: b.y }]
      } else {
        // Skip columns along the horizontal lane between rows nearest the midpoint.
        const yLane = rowLane((a.y + b.y) / 2) + nextOffset(10000 + rowLane((a.y + b.y) / 2))
        const xb = laneB + nextOffset(laneB)
        points = [
          { x: a.x + (dir * W) / 2, y: a.y },
          { x: xa, y: a.y },
          { x: xa, y: yLane },
          { x: xb, y: yLane },
          { x: xb, y: b.y },
          { x: b.x - (dir * W) / 2 - dir * 2, y: b.y },
        ]
      }
    }
    // Label on the last vertical segment, which runs through a free lane.
    const p = points[points.length - 2]!
    const q = points[points.length - 3]!
    out.push({ key, ids: flows.map((f) => f.id), points, lines, lx: p.x, ly: (p.y + q.y) / 2 })
  }
  // Nudge labels that would overlap each other apart vertically.
  const placed: { x: number; y: number; h: number }[] = []
  for (const a of out) {
    const h = a.lines.length * 12 + 6
    let guard = 0
    while (placed.some((o) => Math.abs(o.x - a.lx) < 84 && Math.abs(o.y - a.ly) < (o.h + h) / 2) && guard++ < 20) a.ly += 8
    placed.push({ x: a.lx, y: a.ly, h })
  }
  return out
})

const pathOf = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
</script>

<template>
  <svg ref="svg" :viewBox="`0 0 ${Math.max(layout.width, 260)} ${layout.height}`" class="h-auto w-full" role="img" aria-label="Service flows">
    <defs>
      <marker id="svc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--muted)" />
      </marker>
      <marker id="svc-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--accent)" />
      </marker>
    </defs>

    <!-- zone bands -->
    <g v-for="z in layout.zones" :key="z.name">
      <rect :x="z.x + 8" y="6" :width="z.width - 16" :height="layout.height - 12" rx="10" style="fill: var(--surface-2); stroke: var(--line); stroke-dasharray: 4 4" />
      <text :x="z.x + z.width / 2" y="28" text-anchor="middle" style="fill: var(--muted); font-size: 12px; font-weight: 600">{{ z.name }}</text>
    </g>

    <!-- arrows -->
    <g v-for="a in arrows" :key="a.key">
      <path
        :d="pathOf(a.points)"
        :marker-end="highlight && a.ids.includes(highlight) ? 'url(#svc-arrow-hl)' : 'url(#svc-arrow)'"
        :style="{
          fill: 'none',
          stroke: highlight && a.ids.includes(highlight) ? 'var(--accent)' : 'var(--muted)',
          strokeWidth: highlight && a.ids.includes(highlight) ? 2.5 : 1.5,
          strokeLinejoin: 'round',
        }"
      />
    </g>
    <!-- labels drawn after every line so no arrow crosses a label -->
    <g v-for="a in arrows" :key="`l-${a.key}`">
      <rect :x="a.lx - 40" :y="a.ly - (a.lines.length * 12) / 2 - 3" width="80" :height="a.lines.length * 12 + 4" rx="4" style="fill: var(--surface); stroke: var(--line)" />
      <text v-for="(line, i) in a.lines" :key="i" :x="a.lx" :y="a.ly - (a.lines.length * 12) / 2 + 8 + i * 12" text-anchor="middle" style="fill: var(--fg); font-size: 9.5px; font-family: monospace">
        {{ line.length > 15 ? `${line.slice(0, 14)}…` : line }}
      </text>
    </g>

    <!-- nodes -->
    <g v-for="n in nodes" :key="n.id">
      <template v-if="layout.nodes.get(n.id)">
        <rect
          :x="layout.nodes.get(n.id)!.x - W / 2"
          :y="layout.nodes.get(n.id)!.y - H / 2"
          :width="W"
          :height="H"
          rx="8"
          :style="{ fill: 'var(--surface)', stroke: `var(--${KIND_COLOR[n.kind]})`, strokeWidth: 2 }"
        />
        <text :x="layout.nodes.get(n.id)!.x" :y="layout.nodes.get(n.id)!.y - 4" text-anchor="middle" style="fill: var(--fg); font-size: 12px; font-weight: 600">
          {{ n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name }}
        </text>
        <text :x="layout.nodes.get(n.id)!.x" :y="layout.nodes.get(n.id)!.y + 13" text-anchor="middle" style="fill: var(--muted); font-size: 9.5px; font-family: monospace">
          {{ (splitAddresses(n.addresses).join(', ') || '—').slice(0, 30) }}{{ splitAddresses(n.addresses).join(', ').length > 30 ? '…' : '' }}
        </text>
      </template>
    </g>
  </svg>
</template>
