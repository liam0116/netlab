<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Rack, RackItem } from '@/types/project'
import { floorLayout, type FloorRow } from '@/utils/floor'
import { rackTotals } from '@/utils/rack'

/**
 * Top view of the room: racks in rows, with the cold / hot aisles between them. Inline `style` with CSS
 * variables so it exports as SVG / PNG like the other diagrams. Click a rack to select it.
 */
const props = withDefaults(defineProps<{ racks: Rack[]; items: RackItem[]; selectedId?: string | null; interactive?: boolean }>(), {
  selectedId: null,
  interactive: true,
})
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()

const CELL_W = 100
const CELL_H = 62
const GAP = 8
const AISLE_H = 30
const LEFT = 58
const TOP = 8
const RIGHT = 84

const plan = computed(() => floorLayout(props.racks, props.items))
// Never narrower than the legend line, so a room with one or two racks does not clip it.
const MIN_WIDTH = 520
const width = computed(() => Math.max(MIN_WIDTH, LEFT + plan.value.cols * (CELL_W + GAP) - GAP + RIGHT))
/** x of the row-power column: right after the last rack, not at the (possibly wider) right edge. */
const totalsX = computed(() => LEFT + plan.value.cols * (CELL_W + GAP) - GAP + 14)

/** y of each row, with an aisle band between rows. */
const rowY = (i: number) => TOP + i * (CELL_H + AISLE_H)
const height = computed(() => (plan.value.rows.length ? rowY(plan.value.rows.length - 1) + CELL_H + 30 : 0))
const cellX = (col: number) => LEFT + (col - 1) * (CELL_W + GAP)

const kw = (w: number) => `${(w / 1000).toFixed(1)} kW`

/** Load against one PDU feed when the other fails — the number that decides whether a rack is safe. */
function load(rack: Rack): { text: string; ratio: number; color: string; usedU: number } {
  const totals = rackTotals(rack, props.items)
  const worst = Math.max(totals.failoverA, totals.failoverB)
  const ratio = rack.pduCapacityW > 0 ? worst / rack.pduCapacityW : 0
  const color = ratio > 1 ? 'var(--err)' : ratio > 0.8 ? 'var(--warn)' : 'var(--ok)'
  return { text: kw(totals.powerW), ratio, color, usedU: totals.usedU }
}

/** Front edge of a rack cell (where cold air enters): bottom when the row faces down, top when it faces up. */
const frontY = (row: FloorRow, i: number) => (row.facing === 'down' ? rowY(i) + CELL_H - 4 : rowY(i))

const svg = ref<SVGSVGElement | null>(null)
defineExpose({ svg })
</script>

<template>
  <svg
    v-if="plan.rows.length"
    ref="svg"
    :viewBox="`0 0 ${width} ${height}`"
    :style="{ width: '100%', maxWidth: `${width * 1.4}px`, height: 'auto' }"
    role="img"
    :aria-label="t('rackPage.floor.title')"
  >
    <!-- aisles -->
    <g v-for="(a, i) in plan.aisles" :key="`aisle-${a.after}`">
      <rect
        :x="LEFT - 6"
        :y="rowY(i) + CELL_H + 3"
        :width="plan.cols * (CELL_W + GAP) - GAP + 12"
        :height="AISLE_H - 6"
        rx="4"
        :style="{ fill: a.kind === 'cold' ? 'var(--net-soft)' : 'var(--err-soft)' }"
      />
      <text
        :x="LEFT + (plan.cols * (CELL_W + GAP) - GAP) / 2"
        :y="rowY(i) + CELL_H + AISLE_H / 2 + 4"
        text-anchor="middle"
        :style="{ fill: a.kind === 'cold' ? 'var(--net)' : 'var(--err)', fontSize: '11px', fontWeight: 600 }"
      >
        {{ a.kind === 'cold' ? t('rackPage.floor.cold') : t('rackPage.floor.hot') }}
      </text>
    </g>

    <g v-for="(row, i) in plan.rows" :key="row.row">
      <!-- row label and total -->
      <text :x="LEFT - 12" :y="rowY(i) + CELL_H / 2 + 4" text-anchor="end" style="fill: var(--fg); font-size: 13px; font-weight: 700">
        Row {{ row.letter }}
      </text>
      <text :x="LEFT - 12" :y="rowY(i) + CELL_H / 2 + 17" text-anchor="end" style="fill: var(--muted); font-size: 9px">
        {{ row.facing === 'down' ? '▼' : '▲' }} {{ t('rackPage.floor.front') }}
      </text>
      <text :x="totalsX" :y="rowY(i) + CELL_H / 2" style="fill: var(--muted); font-size: 9px">{{ t('rackPage.floor.rowPower') }}</text>
      <text :x="totalsX" :y="rowY(i) + CELL_H / 2 + 13" style="fill: var(--fg); font-size: 11px; font-family: monospace">{{ kw(row.powerW) }}</text>

      <template v-for="(rack, c) in row.slots" :key="`${row.row}-${c}`">
        <!-- empty slot -->
        <rect
          v-if="!rack"
          :x="cellX(c + 1)"
          :y="rowY(i)"
          :width="CELL_W"
          :height="CELL_H"
          rx="4"
          style="fill: none; stroke: var(--line); stroke-dasharray: 4 3"
        />
        <g
          v-else
          :style="{ cursor: interactive ? 'pointer' : 'default' }"
          @click="interactive && emit('select', rack.id)"
        >
          <rect
            :x="cellX(c + 1)"
            :y="rowY(i)"
            :width="CELL_W"
            :height="CELL_H"
            rx="4"
            :style="{
              fill: 'var(--surface)',
              stroke: rack.id === selectedId ? 'var(--accent)' : 'var(--line)',
              strokeWidth: rack.id === selectedId ? 2.5 : 1.2,
            }"
          />
          <!-- front edge -->
          <rect :x="cellX(c + 1) + 3" :y="frontY(row, i)" :width="CELL_W - 6" height="4" rx="1" style="fill: var(--net)" />
          <text :x="cellX(c + 1) + 8" :y="rowY(i) + (row.facing === 'up' ? 20 : 16)" style="fill: var(--fg); font-size: 12px; font-weight: 700">{{ rack.name }}</text>
          <text :x="cellX(c + 1) + CELL_W - 8" :y="rowY(i) + (row.facing === 'up' ? 20 : 16)" text-anchor="end" style="fill: var(--muted); font-size: 9px; font-family: monospace">
            {{ load(rack).usedU }}/{{ rack.heightU }}U
          </text>
          <text :x="cellX(c + 1) + 8" :y="rowY(i) + (row.facing === 'up' ? 36 : 32)" style="fill: var(--fg); font-size: 10px; font-family: monospace">{{ load(rack).text }}</text>
          <!-- PDU load bar (worst case: one feed lost) -->
          <rect :x="cellX(c + 1) + 8" :y="rowY(i) + (row.facing === 'up' ? 44 : 40)" :width="CELL_W - 16" height="5" rx="2" style="fill: var(--surface-2)" />
          <rect
            :x="cellX(c + 1) + 8"
            :y="rowY(i) + (row.facing === 'up' ? 44 : 40)"
            :width="Math.min(1, load(rack).ratio) * (CELL_W - 16)"
            height="5"
            rx="2"
            :style="{ fill: load(rack).color }"
          />
        </g>
      </template>
    </g>

    <!-- legend -->
    <text :x="LEFT" :y="height - 8" style="fill: var(--muted); font-size: 9px">{{ t('rackPage.floor.legend') }}</text>
  </svg>
</template>
