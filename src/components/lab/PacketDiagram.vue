<script setup lang="ts">
import { computed } from 'vue'
import type { PacketFlow, PacketNode } from '@/utils/packetFlow'
import { BROADCAST_MAC } from '@/utils/mac'

/**
 * Horizontal path of nodes; the packet animates from the step's `from` node to its `to` node.
 * Re-keyed on every step so the CSS animation restarts.
 */
const props = defineProps<{
  flow: PacketFlow
  step: number
  labels: Record<PacketNode, { name: string; sub?: string }>
}>()

const WIDTH = 900
const Y = 95
const positions = computed(() => {
  const n = props.flow.nodes.length
  const map = {} as Record<PacketNode, number>
  props.flow.nodes.forEach((node, i) => (map[node] = 80 + (i * (WIDTH - 160)) / Math.max(n - 1, 1)))
  return map
})

const current = computed(() => props.flow.steps[props.step])
const isBroadcast = computed(() => current.value?.frame?.dstMac === BROADCAST_MAC)
const tone = computed(() => {
  const s = current.value
  if (!s) return 'text-accent'
  if (s.status === 'error') return 'text-err'
  if (s.status === 'ok') return 'text-ok'
  return s.frame?.kind.startsWith('ARP') ? 'text-host' : 'text-accent'
})

/** Nodes involved in the current step glow; on a broadcast flood every L2 neighbour of the switch glows. */
function active(node: PacketNode): boolean {
  const s = current.value
  if (!s) return false
  if (s.from === node || s.to === node) return true
  return isBroadcast.value && s.from === 'switch' && (node === 'src' || node === 'dst' || node === 'router')
}

const packetStyle = computed(() => {
  const s = current.value
  if (!s) return {}
  const fx = positions.value[s.from] ?? 0
  const tx = positions.value[s.to] ?? 0
  return { '--fx': `${fx}px`, '--tx': `${tx}px`, '--y': `${Y}px` }
})
const moving = computed(() => current.value && current.value.from !== current.value.to)
</script>

<template>
  <svg :viewBox="`0 0 ${WIDTH} 190`" class="w-full" role="img" :aria-label="flow.nodes.join(' → ')">
    <!-- links -->
    <line
      v-for="(node, i) in flow.nodes.slice(0, -1)"
      :key="`l-${node}`"
      :x1="positions[node]"
      :y1="Y"
      :x2="positions[flow.nodes[i + 1]!]"
      :y2="Y"
      class="stroke-line"
      stroke-width="3"
      :stroke-dasharray="flow.scenario === 'error' && node === 'switch' ? '6 6' : undefined"
    />

    <!-- nodes -->
    <g v-for="node in flow.nodes" :key="node" :transform="`translate(${positions[node]}, ${Y})`">
      <circle v-if="active(node)" r="44" class="fill-accent/10 stroke-accent/40" stroke-width="1.5">
        <animate v-if="isBroadcast" attributeName="r" values="36;48;36" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <!-- server-like -->
      <g v-if="node === 'src' || node === 'dst' || node === 'remote'">
        <rect x="-30" y="-24" width="60" height="48" rx="7" class="fill-surface-2" :class="node === 'src' ? 'stroke-net' : 'stroke-host'" stroke-width="2" />
        <rect x="-20" y="-14" width="40" height="6" rx="2" :class="node === 'src' ? 'fill-net/40' : 'fill-host/40'" />
        <rect x="-20" y="-3" width="40" height="6" rx="2" :class="node === 'src' ? 'fill-net/25' : 'fill-host/25'" />
        <circle cx="18" cy="13" r="2.5" class="fill-ok" />
      </g>
      <g v-else-if="node === 'switch'" class="text-ok">
        <rect x="-34" y="-18" width="68" height="36" rx="6" class="fill-surface-2" stroke="currentColor" stroke-width="2" />
        <circle v-for="i in 5" :key="i" :cx="-26 + i * 9" cy="6" r="2.5" fill="currentColor" />
        <rect x="-24" y="-11" width="48" height="6" rx="2" fill="currentColor" opacity="0.35" />
      </g>
      <g v-else-if="node === 'router'" class="text-warn">
        <circle r="24" class="fill-surface-2" stroke="currentColor" stroke-width="2" />
        <path d="M -12 -4 h 18 l -5 -5 M 12 4 h -18 l 5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
      </g>
      <g v-else-if="node === 'internet'" class="text-accent">
        <path
          d="M -30 12 a 12 12 0 0 1 2 -24 a 16 16 0 0 1 30 -4 a 13 13 0 0 1 24 10 a 10 10 0 0 1 -4 18 z"
          class="fill-surface-2"
          stroke="currentColor"
          stroke-width="2"
        />
      </g>
      <text y="44" text-anchor="middle" class="fill-fg text-[13px] font-semibold">{{ labels[node].name }}</text>
      <text v-if="labels[node].sub" y="60" text-anchor="middle" class="fill-muted font-mono text-[11px]">{{ labels[node].sub }}</text>
    </g>

    <!-- error marker -->
    <g v-if="current?.status === 'error'" :transform="`translate(${(positions.src + positions.switch) / 2}, ${Y})`" class="text-err">
      <circle r="13" class="fill-surface" stroke="currentColor" stroke-width="2" />
      <path d="M -5 -5 l 10 10 M 5 -5 l -10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </g>

    <!-- packet -->
    <g v-if="current && current.status !== 'error'" :key="step" :class="[tone, moving ? 'packet-move' : 'packet-pulse']" :style="packetStyle">
      <rect x="-11" y="-30" width="22" height="15" rx="3" fill="currentColor" />
      <text v-if="current.frame" y="-37" text-anchor="middle" class="font-mono text-[10px] font-semibold" fill="currentColor">
        {{ current.frame.kind === 'IPv4' ? 'IP' : 'ARP' }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.packet-move {
  animation: packet-move 0.9s ease-in-out forwards;
}
.packet-pulse {
  transform: translate(var(--tx), var(--y));
  animation: packet-pulse 1s ease-in-out infinite;
}
@keyframes packet-move {
  from {
    transform: translate(var(--fx), var(--y));
  }
  to {
    transform: translate(var(--tx), var(--y));
  }
}
@keyframes packet-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
