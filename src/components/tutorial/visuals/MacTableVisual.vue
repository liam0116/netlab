<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { processFrames, type SwitchFrame } from '@/utils/switching'

/** step 0 = empty table; step n = after the n-th frame. */
const props = defineProps<{ step: number }>()
const { t } = useI18n()

const PORTS = [1, 2, 3, 4]
const HOSTS = [
  { name: 'A', mac: 'aa:aa:aa:00:00:01', port: 1 },
  { name: 'B', mac: 'bb:bb:bb:00:00:02', port: 2 },
  { name: 'C', mac: 'cc:cc:cc:00:00:03', port: 3 },
  { name: 'D', mac: 'dd:dd:dd:00:00:04', port: 4 },
]
const macOf = (name: string) => HOSTS.find((h) => h.name === name)!.mac
const nameOf = (mac: string) => HOSTS.find((h) => h.mac === mac)?.name ?? mac

const FRAMES: SwitchFrame[] = [
  { inPort: 1, srcMac: macOf('A'), dstMac: macOf('B') },
  { inPort: 2, srcMac: macOf('B'), dstMac: macOf('A') },
  { inPort: 1, srcMac: macOf('A'), dstMac: macOf('B') },
]
const decisions = processFrames(FRAMES, PORTS)
const current = computed(() => (props.step > 0 ? decisions[Math.min(props.step, decisions.length) - 1] : undefined))
const table = computed(() => [...(current.value?.table ?? new Map<string, number>())])

const portX = (p: number) => 110 + (p - 1) * 140
function portClass(p: number): string {
  const d = current.value
  if (!d) return 'fill-surface-2 stroke-line'
  if (p === d.frame.inPort) return 'fill-accent/30 stroke-accent'
  if (d.outPorts.includes(p)) return d.action === 'flood' ? 'fill-host/30 stroke-host' : 'fill-ok/30 stroke-ok'
  return 'fill-surface-2 stroke-line'
}
</script>

<template>
  <div class="space-y-3">
    <svg viewBox="0 0 640 200" class="w-full">
      <rect x="60" y="20" width="520" height="56" rx="10" class="fill-surface-2 stroke-ok" stroke-width="2" />
      <text x="320" y="44" text-anchor="middle" class="fill-ok text-[13px] font-semibold">Switch</text>
      <g v-for="h in HOSTS" :key="h.name">
        <rect :x="portX(h.port) - 16" y="56" width="32" height="16" rx="3" :class="portClass(h.port)" stroke-width="1.5" />
        <text :x="portX(h.port)" y="68" text-anchor="middle" class="fill-fg font-mono text-[10px]">{{ h.port }}</text>
        <line :x1="portX(h.port)" :x2="portX(h.port)" y1="72" y2="120" class="stroke-line" stroke-width="2" />
        <rect :x="portX(h.port) - 42" y="120" width="84" height="44" rx="7" class="fill-surface stroke-line" />
        <text :x="portX(h.port)" y="140" text-anchor="middle" class="fill-fg text-[13px] font-semibold">Host {{ h.name }}</text>
        <text :x="portX(h.port)" y="156" text-anchor="middle" class="fill-muted font-mono text-[9px]">{{ h.mac }}</text>
      </g>
    </svg>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="rounded-lg border border-line bg-surface-2 p-3 text-sm">
        <template v-if="current">
          <div class="font-mono text-xs">
            {{ t('visuals.macTable.frame', { src: nameOf(current.frame.srcMac), dst: nameOf(current.frame.dstMac), port: current.frame.inPort }) }}
          </div>
          <div v-if="current.learned" class="mt-1 text-accent">
            {{ t('visuals.macTable.learned', { mac: nameOf(current.learned.mac), port: current.learned.port }) }}
          </div>
          <div class="mt-1" :class="current.action === 'flood' ? 'text-host' : 'text-ok'">
            {{ t(`visuals.macTable.${current.action}`, { ports: current.outPorts.join(', ') }) }}
          </div>
        </template>
        <div v-else class="text-muted">{{ t('visuals.macTable.start') }}</div>
      </div>
      <div class="rounded-lg border border-line p-3">
        <div class="label">{{ t('visuals.macTable.table') }}</div>
        <table class="w-full font-mono text-xs">
          <tbody>
            <tr v-for="[mac, port] in table" :key="mac" class="border-t border-line first:border-t-0">
              <td class="py-1">{{ mac }} <span class="text-muted">({{ nameOf(mac) }})</span></td>
              <td class="py-1 text-right">{{ t('visuals.macTable.port') }} {{ port }}</td>
            </tr>
            <tr v-if="table.length === 0">
              <td class="py-1 text-muted">{{ t('visuals.macTable.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
