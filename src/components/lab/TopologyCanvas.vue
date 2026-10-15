<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { Globe, HardDrive, Monitor, Network, Router, Server, Shield } from 'lucide-vue-next'
import type { DeviceType, Selection, TopoDevice, TopoLink } from '@/types/topology'

const props = defineProps<{
  devices: TopoDevice[]
  links: TopoLink[]
  selection: Selection
  connectFrom: string | null
  connecting: boolean
  /** Worst issue level per device id. */
  deviceLevels: Map<string, 'error' | 'warning' | 'info'>
  linkLevels: Map<string, 'error' | 'warning' | 'info'>
}>()

const emit = defineEmits<{
  select: [selection: Selection]
  move: [id: string, x: number, y: number]
  deviceClick: [id: string]
}>()

const CANVAS_W = 1000
const CANVAS_H = 560
const NODE_W = 142
const NODE_H = 58

const ICONS: Record<DeviceType, Component> = {
  server: Server,
  switch: Network,
  router: Router,
  firewall: Shield,
  storage: HardDrive,
  client: Monitor,
  internet: Globe,
}
const TONES: Record<DeviceType, string> = {
  server: 'text-net',
  storage: 'text-host',
  switch: 'text-ok',
  router: 'text-warn',
  firewall: 'text-err',
  client: 'text-accent',
  internet: 'text-accent',
}

const svg = ref<SVGSVGElement | null>(null)
const byId = computed(() => new Map(props.devices.map((d) => [d.id, d])))

function toSvg(event: PointerEvent): { x: number; y: number } {
  const el = svg.value
  const ctm = el?.getScreenCTM()
  if (!el || !ctm) return { x: 0, y: 0 }
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

let drag: { id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean } | null = null

function onDeviceDown(event: PointerEvent, d: TopoDevice): void {
  event.stopPropagation()
  const p = toSvg(event)
  drag = { id: d.id, dx: p.x - d.x, dy: p.y - d.y, startX: p.x, startY: p.y, moved: false }
  svg.value?.setPointerCapture(event.pointerId)
}

function onMove(event: PointerEvent): void {
  if (!drag || props.connecting) return
  const p = toSvg(event)
  if (!drag.moved && Math.hypot(p.x - drag.startX, p.y - drag.startY) < 4) return
  drag.moved = true
  const x = Math.min(CANVAS_W - NODE_W / 2, Math.max(NODE_W / 2, p.x - drag.dx))
  const y = Math.min(CANVAS_H - NODE_H / 2 - 10, Math.max(NODE_H / 2, p.y - drag.dy))
  emit('move', drag.id, Math.round(x), Math.round(y))
}

function onUp(): void {
  if (drag && !drag.moved) {
    if (props.connecting) emit('deviceClick', drag.id)
    else emit('select', { kind: 'device', id: drag.id })
  }
  drag = null
}

function linkEnds(l: TopoLink) {
  const a = byId.value.get(l.a)
  const b = byId.value.get(l.b)
  return a && b ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 } : null
}

function deviceSub(d: TopoDevice): string {
  if (d.ip) return `${d.ip}/${d.cidr}`
  return d.vlan !== null ? `VLAN ${d.vlan}` : ''
}

const levelClass = { error: 'fill-err', warning: 'fill-warn', info: 'fill-muted' } as const
</script>

<template>
  <svg
    ref="svg"
    :viewBox="`0 0 ${CANVAS_W} ${CANVAS_H}`"
    class="h-auto w-full touch-none select-none"
    :class="connecting ? 'cursor-crosshair' : ''"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @pointerdown="emit('select', null)"
  >
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" class="fill-line" />
      </pattern>
    </defs>
    <rect :width="CANVAS_W" :height="CANVAS_H" fill="url(#grid)" />

    <!-- links -->
    <g v-for="l in links" :key="l.id">
      <template v-if="linkEnds(l)">
        <line
          v-bind="{ x1: linkEnds(l)!.x1, y1: linkEnds(l)!.y1, x2: linkEnds(l)!.x2, y2: linkEnds(l)!.y2 }"
          :class="
            selection?.kind === 'link' && selection.id === l.id
              ? 'stroke-accent'
              : linkLevels.get(l.id) === 'error'
                ? 'stroke-err'
                : 'stroke-muted/50'
          "
          :stroke-width="selection?.kind === 'link' && selection.id === l.id ? 4 : 2.5"
        />
        <!-- wide invisible hit area -->
        <line
          v-bind="{ x1: linkEnds(l)!.x1, y1: linkEnds(l)!.y1, x2: linkEnds(l)!.x2, y2: linkEnds(l)!.y2 }"
          stroke="transparent"
          stroke-width="16"
          class="cursor-pointer"
          @pointerdown.stop="emit('select', { kind: 'link', id: l.id })"
        />
        <g v-if="l.vlan !== null" :transform="`translate(${linkEnds(l)!.mx}, ${linkEnds(l)!.my})`" class="pointer-events-none">
          <rect x="-30" y="-10" width="60" height="20" rx="10" class="fill-surface" :class="linkLevels.get(l.id) === 'error' ? 'stroke-err' : 'stroke-line'" />
          <text text-anchor="middle" y="4" class="font-mono text-[11px]" :class="linkLevels.get(l.id) === 'error' ? 'fill-err' : 'fill-muted'">
            VLAN {{ l.vlan }}
          </text>
        </g>
      </template>
    </g>

    <!-- devices -->
    <g
      v-for="d in devices"
      :key="d.id"
      :transform="`translate(${d.x - NODE_W / 2}, ${d.y - NODE_H / 2})`"
      class="cursor-grab"
      @pointerdown="onDeviceDown($event, d)"
    >
      <rect
        :width="NODE_W"
        :height="NODE_H"
        rx="10"
        class="fill-surface"
        :class="
          connectFrom === d.id
            ? 'stroke-accent'
            : selection?.kind === 'device' && selection.id === d.id
              ? 'stroke-accent'
              : deviceLevels.get(d.id) === 'error'
                ? 'stroke-err'
                : 'stroke-line'
        "
        :stroke-width="(selection?.kind === 'device' && selection.id === d.id) || connectFrom === d.id ? 3 : 1.5"
        :stroke-dasharray="connectFrom === d.id ? '5 4' : undefined"
      />
      <g :class="TONES[d.type]">
        <component :is="ICONS[d.type]" x="10" y="16" :size="26" stroke-width="1.75" />
      </g>
      <text x="44" y="26" class="fill-fg text-[13px] font-semibold">{{ d.name.length > 13 ? `${d.name.slice(0, 12)}…` : d.name }}</text>
      <text x="44" y="43" class="fill-muted font-mono text-[10.5px]">{{ deviceSub(d) }}</text>
      <circle v-if="deviceLevels.get(d.id)" :cx="NODE_W - 4" cy="4" r="7" :class="levelClass[deviceLevels.get(d.id)!]" />
      <text v-if="deviceLevels.get(d.id) && deviceLevels.get(d.id) !== 'info'" :x="NODE_W - 4" y="8" text-anchor="middle" class="fill-bg text-[10px] font-bold">!</text>
    </g>
  </svg>
</template>
