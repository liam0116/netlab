<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/** PAT walk-through. step 0: outbound before NAT · 1: translated · 2: reply arrives · 3: translated back. */
const props = defineProps<{ step: number }>()
const { t, tm, rt } = useI18n()

const INSIDE = '192.168.1.10:51000'
const PUBLIC = '203.0.113.10:62001'
const REMOTE = '8.8.8.8:443'

const packets = [
  { src: INSIDE, dst: REMOTE, side: 'inside' },
  { src: PUBLIC, dst: REMOTE, side: 'outside' },
  { src: REMOTE, dst: PUBLIC, side: 'outside' },
  { src: REMOTE, dst: INSIDE, side: 'inside' },
] as const

const s = computed(() => Math.min(Math.max(props.step, 0), 3))
const packet = computed(() => packets[s.value]!)
const caption = computed(() => {
  const list = tm('visuals.nat.steps') as unknown
  return Array.isArray(list) && list[s.value] !== undefined ? rt(list[s.value]) : ''
})
const changed = (field: 'src' | 'dst') => (s.value === 1 && field === 'src') || (s.value === 3 && field === 'dst')
</script>

<template>
  <div class="space-y-3">
    <svg viewBox="0 0 640 120" class="w-full">
      <rect x="10" y="10" width="300" height="100" rx="10" class="fill-net/5 stroke-net/40" stroke-dasharray="5 4" />
      <text x="24" y="30" class="fill-net text-[11px] font-semibold">{{ t('visuals.nat.inside') }}</text>
      <rect x="330" y="10" width="300" height="100" rx="10" class="fill-host/5 stroke-host/40" stroke-dasharray="5 4" />
      <text x="344" y="30" class="fill-host text-[11px] font-semibold">{{ t('visuals.nat.outside') }}</text>
      <rect x="40" y="48" width="110" height="40" rx="7" class="fill-surface stroke-net" />
      <text x="95" y="73" text-anchor="middle" class="fill-fg font-mono text-[11px]">192.168.1.10</text>
      <circle cx="320" cy="68" r="26" class="fill-surface-2 stroke-warn" stroke-width="2" />
      <text x="320" y="72" text-anchor="middle" class="fill-warn text-[11px] font-bold">NAT</text>
      <rect x="490" y="48" width="110" height="40" rx="7" class="fill-surface stroke-host" />
      <text x="545" y="73" text-anchor="middle" class="fill-fg font-mono text-[11px]">8.8.8.8</text>
      <line x1="150" y1="68" x2="294" y2="68" class="stroke-line" stroke-width="2" />
      <line x1="346" y1="68" x2="490" y2="68" class="stroke-line" stroke-width="2" />
      <circle
        :cx="[222, 418, 418, 222][s]"
        cy="68"
        r="9"
        class="fill-accent transition-all duration-500"
      />
    </svg>

    <p class="text-center text-sm text-fg/85">{{ caption }}</p>

    <div class="grid gap-3">
      <div class="rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs">
        <div class="label font-sans">{{ t('visuals.nat.packet') }}</div>
        <div>src <span :class="changed('src') ? 'font-bold text-warn' : ''">{{ packet.src }}</span></div>
        <div>dst <span :class="changed('dst') ? 'font-bold text-warn' : ''">{{ packet.dst }}</span></div>
      </div>
      <div class="rounded-lg border border-line p-3 text-xs">
        <div class="label">{{ t('visuals.nat.table') }}</div>
        <dl v-if="s >= 1" class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono" :class="s === 3 ? 'text-accent' : ''">
          <dt class="font-sans text-muted">{{ t('visuals.nat.insideLocal') }}</dt>
          <dd>{{ INSIDE }}</dd>
          <dt class="font-sans text-muted">{{ t('visuals.nat.insideGlobal') }}</dt>
          <dd>{{ PUBLIC }}</dd>
          <dt class="font-sans text-muted">{{ t('visuals.nat.outsideAddr') }}</dt>
          <dd>{{ REMOTE }}</dd>
        </dl>
        <div v-else class="text-muted">—</div>
      </div>
    </div>
  </div>
</template>
