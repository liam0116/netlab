<script setup lang="ts">
import { computed } from 'vue'
import type { DiagramDevice } from '@/types/app'

/**
 * Two endpoints connected through a middle device, with an animated packet.
 * - switch:  same subnet, frames go straight through a Layer 2 switch
 * - router:  different subnets, traffic must be routed
 * - blocked: misconfiguration, the packet stops in the middle
 */
const props = withDefaults(
  defineProps<{ a: DiagramDevice; b: DiagramDevice; via: 'switch' | 'router' | 'blocked'; viaLabel?: string; animate?: boolean }>(),
  { viaLabel: '', animate: true },
)

const middleLabel = computed(
  () => props.viaLabel || { switch: 'Switch (L2)', router: 'Router / L3 Switch', blocked: '?' }[props.via],
)
const path = computed(() => (props.via === 'blocked' ? 'M 110 80 L 285 80' : 'M 110 80 L 300 80 L 490 80'))
const tone = computed(() => ({ switch: 'text-ok', router: 'text-warn', blocked: 'text-err' })[props.via])
</script>

<template>
  <svg viewBox="0 0 600 170" class="w-full" role="img" :aria-label="`${a.name} to ${b.name} via ${middleLabel}`">
    <!-- links -->
    <line x1="110" y1="80" x2="255" y2="80" class="stroke-line" stroke-width="3" />
    <line
      x1="345"
      y1="80"
      x2="490"
      y2="80"
      class="stroke-line"
      stroke-width="3"
      :stroke-dasharray="via === 'blocked' ? '6 6' : undefined"
    />

    <!-- endpoint A -->
    <g>
      <rect x="20" y="50" width="90" height="60" rx="8" class="fill-surface-2 stroke-net" stroke-width="2" />
      <rect x="34" y="64" width="62" height="8" rx="2" class="fill-net/40" />
      <rect x="34" y="78" width="62" height="8" rx="2" class="fill-net/25" />
      <circle cx="90" cy="98" r="3" class="fill-ok" />
      <text x="65" y="130" text-anchor="middle" class="fill-fg text-[13px] font-semibold">{{ a.name }}</text>
      <text x="65" y="148" text-anchor="middle" class="fill-muted font-mono text-[11px]">{{ a.ip }}</text>
      <text v-if="a.sub" x="65" y="163" text-anchor="middle" class="fill-muted font-mono text-[10px]">{{ a.sub }}</text>
    </g>

    <!-- middle device -->
    <g :class="tone">
      <rect x="255" y="55" width="90" height="50" rx="8" class="fill-surface-2" stroke="currentColor" stroke-width="2" />
      <template v-if="via === 'switch'">
        <circle v-for="i in 4" :key="i" :cx="266 + i * 14" cy="88" r="3" fill="currentColor" />
        <rect x="270" y="66" width="60" height="8" rx="2" fill="currentColor" opacity="0.35" />
      </template>
      <template v-else-if="via === 'router'">
        <circle cx="300" cy="80" r="14" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M 292 80 h 16 M 300 72 v 16" stroke="currentColor" stroke-width="2" />
      </template>
      <template v-else>
        <path d="M 290 70 l 20 20 M 310 70 l -20 20" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </template>
      <text x="300" y="40" text-anchor="middle" class="text-[12px] font-semibold" fill="currentColor">{{ middleLabel }}</text>
    </g>

    <!-- endpoint B -->
    <g>
      <rect x="490" y="50" width="90" height="60" rx="8" class="fill-surface-2 stroke-host" stroke-width="2" />
      <rect x="504" y="64" width="62" height="8" rx="2" class="fill-host/40" />
      <rect x="504" y="78" width="62" height="8" rx="2" class="fill-host/25" />
      <circle cx="560" cy="98" r="3" class="fill-ok" />
      <text x="535" y="130" text-anchor="middle" class="fill-fg text-[13px] font-semibold">{{ b.name }}</text>
      <text x="535" y="148" text-anchor="middle" class="fill-muted font-mono text-[11px]">{{ b.ip }}</text>
      <text v-if="b.sub" x="535" y="163" text-anchor="middle" class="fill-muted font-mono text-[10px]">{{ b.sub }}</text>
    </g>

    <!-- packet -->
    <g v-if="animate" :key="`${via}-${a.ip}-${b.ip}`" :class="tone">
      <rect x="-9" y="-6" width="18" height="12" rx="3" fill="currentColor">
        <animateMotion :path="path" dur="2.4s" repeatCount="indefinite" />
      </rect>
    </g>
  </svg>
</template>
