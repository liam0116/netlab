<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ highlight: 'access' | 'trunk' }>()
const { t } = useI18n()

const ports = [
  { port: 1, vlan: 10 },
  { port: 2, vlan: 10 },
  { port: 3, vlan: 20 },
  { port: 4, vlan: 20 },
]
const x = (p: number) => 90 + (p - 1) * 110
</script>

<template>
  <div class="space-y-3">
    <svg viewBox="0 0 640 230" class="w-full">
      <!-- trunk uplink to router -->
      <g :opacity="highlight === 'trunk' ? 1 : 0.5">
        <line x1="560" y1="70" x2="560" y2="150" class="stroke-net" stroke-width="5" />
        <line x1="560" y1="70" x2="560" y2="150" class="stroke-host" stroke-width="5" stroke-dasharray="8 8" />
        <circle cx="560" cy="175" r="24" class="fill-surface-2 stroke-warn" stroke-width="2" />
        <text x="560" y="179" text-anchor="middle" class="fill-warn text-[11px] font-semibold">Router</text>
        <text x="575" y="112" class="fill-fg font-mono text-[10px]">Trunk</text>
        <text x="575" y="126" class="fill-muted font-mono text-[10px]">VLAN 10,20</text>
      </g>
      <rect x="40" y="20" width="560" height="50" rx="10" class="fill-surface-2 stroke-ok" stroke-width="2" />
      <text x="320" y="42" text-anchor="middle" class="fill-ok text-[13px] font-semibold">Switch</text>
      <g v-for="p in ports" :key="p.port" :opacity="highlight === 'access' ? 1 : 0.5">
        <rect :x="x(p.port) - 18" y="52" width="36" height="16" rx="3" :class="p.vlan === 10 ? 'fill-net/30 stroke-net' : 'fill-host/30 stroke-host'" />
        <line :x1="x(p.port)" :x2="x(p.port)" y1="68" y2="140" :class="p.vlan === 10 ? 'stroke-net' : 'stroke-host'" stroke-width="2.5" />
        <rect :x="x(p.port) - 40" y="140" width="80" height="44" rx="7" class="fill-surface" :class="p.vlan === 10 ? 'stroke-net' : 'stroke-host'" />
        <text :x="x(p.port)" y="160" text-anchor="middle" class="fill-fg text-[12px] font-semibold">Host {{ p.port }}</text>
        <text :x="x(p.port)" y="176" text-anchor="middle" class="font-mono text-[10px]" :class="p.vlan === 10 ? 'fill-net' : 'fill-host'">
          VLAN {{ p.vlan }}
        </text>
        <text :x="x(p.port)" y="104" text-anchor="middle" class="fill-muted font-mono text-[9px]">untagged</text>
      </g>
      <text x="200" y="215" text-anchor="middle" class="fill-net text-[11px]">VLAN 10 = 10.0.10.0/24</text>
      <text x="420" y="215" text-anchor="middle" class="fill-host text-[11px]">VLAN 20 = 10.0.20.0/24</text>
    </svg>
    <p class="text-center text-sm" :class="highlight === 'trunk' ? 'text-accent' : 'text-fg/85'">
      {{ highlight === 'trunk' ? t('visuals.vlanSwitch.trunk') : t('visuals.vlanSwitch.access') }}
    </p>
  </div>
</template>
