<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Rack, RackItem, RackItemType } from '@/types/project'
import { itemTop } from '@/utils/rack'

/**
 * Front elevation of one rack. Styled with inline `style` + CSS variables so it can be exported
 * as a standalone SVG / PNG (see utils/svgExport). Drag a device vertically to move it.
 */
const props = withDefaults(
  defineProps<{ rack: Rack; items: RackItem[]; selectedId?: string | null; problemIds?: Set<string>; interactive?: boolean }>(),
  { selectedId: null, problemIds: () => new Set<string>(), interactive: true },
)
const emit = defineEmits<{ select: [id: string | null]; move: [id: string, uPosition: number] }>()

const U = 18
const LEFT = 30
const WIDTH = 300
const TOP = 40
const height = computed(() => TOP + props.rack.heightU * U + 14)
const inRack = computed(() => props.items.filter((i) => i.rackId === props.rack.id))

const COLORS: Record<RackItemType, string> = {
  server: 'net',
  'gpu-server': 'accent',
  storage: 'host',
  switch: 'ok',
  'mgmt-switch': 'ok',
  firewall: 'err',
  router: 'err',
  'patch-panel': 'muted',
  ups: 'warn',
  kvm: 'muted',
  blank: 'line',
  other: 'muted',
}

/** y of the top edge of U `u` (U1 is at the bottom). */
const yOfTopU = (u: number) => TOP + (props.rack.heightU - u) * U

const svg = ref<SVGSVGElement | null>(null)
defineExpose({ svg })

let drag: { id: string; offsetU: number; startY: number; moved: boolean } | null = null

function uAt(event: PointerEvent): number {
  const ctm = svg.value?.getScreenCTM()
  if (!ctm) return 1
  const y = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse()).y
  return props.rack.heightU - Math.floor((y - TOP) / U)
}

function onDown(event: PointerEvent, item: RackItem): void {
  if (!props.interactive) return
  event.stopPropagation()
  drag = { id: item.id, offsetU: itemTop(item) - uAt(event), startY: event.clientY, moved: false }
  svg.value?.setPointerCapture(event.pointerId)
  emit('select', item.id)
}

function onMove(event: PointerEvent): void {
  if (!drag) return
  if (!drag.moved && Math.abs(event.clientY - drag.startY) < 4) return
  drag.moved = true
  const item = inRack.value.find((i) => i.id === drag!.id)
  if (!item) return
  const top = uAt(event) + drag.offsetU
  const position = Math.min(props.rack.heightU - item.uHeight + 1, Math.max(1, top - item.uHeight + 1))
  if (position !== item.uPosition) emit('move', item.id, position)
}

function onUp(): void {
  drag = null
}
</script>

<template>
  <svg
    ref="svg"
    :viewBox="`0 0 ${LEFT + WIDTH + 10} ${height}`"
    class="h-auto w-full max-w-[340px] touch-none select-none"
    role="img"
    :aria-label="rack.name"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @pointerdown="interactive && emit('select', null)"
  >
    <text :x="LEFT + WIDTH / 2" y="18" text-anchor="middle" style="fill: var(--fg); font-size: 14px; font-weight: 600">{{ rack.name }}</text>
    <text v-if="rack.location" :x="LEFT + WIDTH / 2" y="32" text-anchor="middle" style="fill: var(--muted); font-size: 10px">{{ rack.location }}</text>

    <!-- frame -->
    <rect :x="LEFT - 4" :y="TOP - 4" :width="WIDTH + 8" :height="rack.heightU * U + 8" rx="4" style="fill: var(--surface-2); stroke: var(--line); stroke-width: 2" />
    <g v-for="u in rack.heightU" :key="u">
      <line :x1="LEFT" :x2="LEFT + WIDTH" :y1="yOfTopU(u) + U" :y2="yOfTopU(u) + U" style="stroke: var(--line); stroke-width: 0.5; opacity: 0.6" />
      <text :x="LEFT - 8" :y="yOfTopU(u) + U / 2 + 3.5" text-anchor="end" style="fill: var(--muted); font-size: 9px; font-family: monospace">{{ u }}</text>
    </g>

    <!-- devices -->
    <g
      v-for="it in inRack"
      :key="it.id"
      :style="{ cursor: interactive ? 'grab' : 'default' }"
      @pointerdown="onDown($event, it)"
    >
      <rect
        :x="LEFT + 2"
        :y="yOfTopU(itemTop(it)) + 1"
        :width="WIDTH - 4"
        :height="it.uHeight * U - 2"
        rx="3"
        :style="{
          fill: it.type === 'blank' ? 'var(--surface-2)' : 'var(--surface)',
          stroke: problemIds.has(it.id) ? 'var(--err)' : selectedId === it.id ? 'var(--accent)' : `var(--${COLORS[it.type]})`,
          strokeWidth: selectedId === it.id || problemIds.has(it.id) ? 2.5 : 1.5,
        }"
      />
      <rect :x="LEFT + 2" :y="yOfTopU(itemTop(it)) + 1" width="6" :height="it.uHeight * U - 2" :style="{ fill: `var(--${COLORS[it.type]})` }" />
      <text :x="LEFT + 14" :y="yOfTopU(itemTop(it)) + Math.min(it.uHeight * U, 36) / 2 + 4" style="fill: var(--fg); font-size: 11px; font-weight: 600">
        {{ it.name }}
      </text>
      <text :x="LEFT + WIDTH - 8" :y="yOfTopU(itemTop(it)) + Math.min(it.uHeight * U, 36) / 2 + 4" text-anchor="end" style="fill: var(--muted); font-size: 9.5px; font-family: monospace">
        {{ it.ip || it.model }}
      </text>
      <text v-if="it.uHeight >= 3" :x="LEFT + 14" :y="yOfTopU(itemTop(it)) + 32" style="fill: var(--muted); font-size: 9.5px">
        {{ it.model }}
      </text>
    </g>
  </svg>
</template>
