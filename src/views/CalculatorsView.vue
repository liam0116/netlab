<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sigma } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import { useProjectStore } from '@/stores/project'
import {
  powerFigures,
  requiredGbps,
  splitDuration,
  storageCapacity,
  toBytes,
  transferSeconds,
  upsFits,
  upsRuntimeMinutes,
  type SizeUnit,
  type StorageScheme,
} from '@/utils/calculators'
import { rackTotals } from '@/utils/rack'

const project = useProjectStore()
const { t } = useI18n()

// --- Transfer ---------------------------------------------------------------------
const size = ref(50)
const unit = ref<SizeUnit>('TB')
const gbps = ref(25)
const efficiency = ref(70)
const windowHours = ref(8)

const bytes = computed(() => toBytes(size.value, unit.value))
const seconds = computed(() => transferSeconds(bytes.value, gbps.value, efficiency.value / 100))
const duration = computed(() => {
  if (seconds.value === null) return '—'
  const d = splitDuration(seconds.value)
  return d.days ? t('calcPage.transfer.duration', { d: d.days, h: d.hours, m: d.minutes, s: d.seconds }) : t('calcPage.transfer.durationShort', { h: d.hours, m: d.minutes, s: d.seconds })
})
const throughput = computed(() => (gbps.value * (efficiency.value / 100)) / 8) // GB/s
const needed = computed(() => requiredGbps(bytes.value, windowHours.value * 3600, efficiency.value / 100))

// --- Storage ----------------------------------------------------------------------
const scheme = ref<StorageScheme>('raid6')
const disks = ref(12)
const diskTB = ref(8)
const replicas = ref(3)
const k = ref(4)
const m = ref(2)
const storage = computed(() => storageCapacity({ scheme: scheme.value, disks: disks.value, diskTB: diskTB.value, replicas: replicas.value, k: k.value, m: m.value }))
const SCHEMES: StorageScheme[] = ['raid0', 'raid1', 'raid5', 'raid6', 'raid10', 'replica', 'ec']

// --- Power -------------------------------------------------------------------------
const load = ref(3000)
const voltage = ref(230)
const pf = ref(0.95)
const upsVa = ref(6000)
const upsW = ref(5400)
const batteryWh = ref(2000)
const power = computed(() => powerFigures(load.value, voltage.value, pf.value))
const fits = computed(() => (power.value ? upsFits(load.value, power.value.va, upsVa.value, upsW.value) : false))
const runtime = computed(() => upsRuntimeMinutes(load.value, batteryWh.value))
function useRack(event: Event): void {
  const rack = project.racks.find((r) => r.id === (event.target as HTMLSelectElement).value)
  if (rack) {
    load.value = Math.round(rackTotals(rack, project.rackItems).powerW)
    voltage.value = rack.voltage
  }
}

const fmt = (n: number, digits = 1) => n.toLocaleString(undefined, { maximumFractionDigits: digits })
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('calcPage.title')" :description="t('calcPage.desc')" :icon="Sigma" />

    <div class="grid gap-5 xl:grid-cols-3">
      <!-- Transfer -->
      <section class="card space-y-3 p-4">
        <h2 class="font-semibold">{{ t('calcPage.transfer.title') }}</h2>
        <div class="grid grid-cols-[1fr_6rem] gap-2">
          <div>
            <label for="ct-size" class="label normal-case">{{ t('calcPage.transfer.size') }}</label>
            <input id="ct-size" v-model.number="size" type="number" min="0" class="field" />
          </div>
          <div>
            <label for="ct-unit" class="label normal-case">&nbsp;</label>
            <select id="ct-unit" v-model="unit" class="field">
              <option v-for="u in ['GB', 'TB', 'PB', 'GiB', 'TiB']" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
        </div>
        <div>
          <label for="ct-bw" class="label normal-case">{{ t('calcPage.transfer.bandwidth') }}</label>
          <div class="flex gap-2">
            <input id="ct-bw" v-model.number="gbps" type="number" min="0.1" step="0.1" class="field" />
            <button v-for="b in [1, 10, 25, 100]" :key="b" class="kbd shrink-0 px-2 hover:text-accent" @click="gbps = b">{{ b }}</button>
          </div>
        </div>
        <div>
          <label for="ct-eff" class="label normal-case">{{ t('calcPage.transfer.efficiency') }}: {{ efficiency }}%</label>
          <input id="ct-eff" v-model.number="efficiency" type="range" min="20" max="100" step="5" class="w-full accent-[var(--accent)]" />
          <p class="text-xs text-muted">{{ t('calcPage.transfer.efficiencyHint') }}</p>
        </div>
        <div class="rounded-lg border border-line bg-surface-2 p-3">
          <div class="text-xs text-muted">{{ t('calcPage.transfer.result') }}</div>
          <div class="font-mono text-xl font-bold text-accent">{{ duration }}</div>
          <div class="mt-1 text-xs text-muted">{{ t('calcPage.transfer.throughput') }}: <span class="font-mono text-fg">{{ fmt(throughput, 2) }} GB/s</span></div>
        </div>
        <div class="grid grid-cols-2 items-end gap-2">
          <div>
            <label for="ct-win" class="label normal-case">{{ t('calcPage.transfer.window') }}</label>
            <input id="ct-win" v-model.number="windowHours" type="number" min="0.1" step="0.5" class="field" />
          </div>
          <div class="pb-2 text-sm">
            {{ t('calcPage.transfer.needed') }}:
            <span class="font-mono font-semibold text-accent">{{ needed === null ? '—' : `${fmt(needed)} Gbps` }}</span>
          </div>
        </div>
      </section>

      <!-- Storage -->
      <section class="card space-y-3 p-4">
        <h2 class="font-semibold">{{ t('calcPage.storage.title') }}</h2>
        <div>
          <label for="cs-scheme" class="label normal-case">{{ t('calcPage.storage.scheme') }}</label>
          <select id="cs-scheme" v-model="scheme" class="field">
            <option v-for="s in SCHEMES" :key="s" :value="s">{{ t(`calcPage.storage.schemes.${s}`) }}</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label for="cs-disks" class="label normal-case">{{ t('calcPage.storage.disks') }}</label>
            <input id="cs-disks" v-model.number="disks" type="number" min="1" class="field" />
          </div>
          <div>
            <label for="cs-size" class="label normal-case">{{ t('calcPage.storage.diskTB') }}</label>
            <input id="cs-size" v-model.number="diskTB" type="number" min="0.1" step="0.1" class="field" />
          </div>
          <div v-if="scheme === 'replica'">
            <label for="cs-rep" class="label normal-case">{{ t('calcPage.storage.replicas') }}</label>
            <input id="cs-rep" v-model.number="replicas" type="number" min="1" max="10" class="field" />
          </div>
          <template v-if="scheme === 'ec'">
            <div>
              <label for="cs-k" class="label normal-case">{{ t('calcPage.storage.k') }}</label>
              <input id="cs-k" v-model.number="k" type="number" min="1" class="field" />
            </div>
            <div>
              <label for="cs-m" class="label normal-case">{{ t('calcPage.storage.m') }}</label>
              <input id="cs-m" v-model.number="m" type="number" min="1" class="field" />
            </div>
          </template>
        </div>
        <div v-if="storage.valid" class="space-y-1.5 rounded-lg border border-line bg-surface-2 p-3 text-sm">
          <div class="flex justify-between"><span class="text-muted">{{ t('calcPage.storage.raw') }}</span><span class="font-mono">{{ fmt(storage.rawTB) }} TB</span></div>
          <div class="flex justify-between">
            <span class="text-muted">{{ t('calcPage.storage.usable') }}</span>
            <span class="font-mono text-lg font-bold text-accent">{{ fmt(storage.usableTB) }} TB <span class="text-sm font-normal text-muted">({{ fmt(storage.usableTiB) }} TiB)</span></span>
          </div>
          <div class="flex justify-between"><span class="text-muted">{{ t('calcPage.storage.efficiency') }}</span><span class="font-mono">{{ fmt(storage.efficiency * 100) }}%</span></div>
          <div class="flex justify-between">
            <span class="text-muted">{{ t('calcPage.storage.tolerance') }}</span>
            <span :class="storage.faultTolerance ? 'text-ok' : 'text-err'">{{ t('calcPage.storage.toleranceValue', { n: storage.faultTolerance }) }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-err">{{ t(`calcPage.storage.invalid.${storage.reason}`, { n: storage.minDisks }) }}</p>
        <p class="text-xs text-muted">{{ t('calcPage.storage.tibNote') }}</p>
      </section>

      <!-- Power -->
      <section class="card space-y-3 p-4">
        <h2 class="font-semibold">{{ t('calcPage.power.title') }}</h2>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label for="cp-load" class="label normal-case">{{ t('calcPage.power.load') }}</label>
            <input id="cp-load" v-model.number="load" type="number" min="0" class="field" />
          </div>
          <div>
            <label for="cp-rack" class="label normal-case">{{ t('calcPage.power.fromRack') }}</label>
            <select id="cp-rack" class="field" :disabled="!project.racks.length" @change="useRack">
              <option value="">—</option>
              <option v-for="r in project.racks" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
          <div>
            <label for="cp-v" class="label normal-case">{{ t('calcPage.power.voltage') }}</label>
            <input id="cp-v" v-model.number="voltage" type="number" min="1" class="field" />
          </div>
          <div>
            <label for="cp-pf" class="label normal-case">{{ t('calcPage.power.pf') }}</label>
            <input id="cp-pf" v-model.number="pf" type="number" min="0.1" max="1" step="0.01" class="field" />
          </div>
        </div>
        <div v-if="power" class="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm">
          <div><div class="text-xs text-muted">{{ t('calcPage.power.amps') }}</div><div class="font-mono text-lg font-bold text-accent">{{ fmt(power.amps) }} A</div></div>
          <div><div class="text-xs text-muted">{{ t('calcPage.power.va') }}</div><div class="font-mono">{{ fmt(power.va, 0) }} VA</div></div>
          <div><div class="text-xs text-muted">{{ t('calcPage.power.heat') }}</div><div class="font-mono">{{ fmt(power.btuPerHour, 0) }} BTU/h</div></div>
          <div><div class="text-xs text-muted">{{ t('calcPage.power.daily') }}</div><div class="font-mono">{{ fmt(power.kwhPerDay) }} kWh</div></div>
        </div>
        <h3 class="pt-1 text-sm font-semibold">{{ t('calcPage.power.ups') }}</h3>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label for="cp-uva" class="label normal-case">{{ t('calcPage.power.upsVa') }}</label>
            <input id="cp-uva" v-model.number="upsVa" type="number" min="0" class="field" />
          </div>
          <div>
            <label for="cp-uw" class="label normal-case">{{ t('calcPage.power.upsW') }}</label>
            <input id="cp-uw" v-model.number="upsW" type="number" min="0" class="field" />
          </div>
          <div>
            <label for="cp-wh" class="label normal-case">{{ t('calcPage.power.battery') }}</label>
            <input id="cp-wh" v-model.number="batteryWh" type="number" min="0" class="field" />
          </div>
        </div>
        <div class="rounded-lg border p-3 text-sm" :class="fits ? 'border-ok/40 bg-ok-soft' : 'border-err/40 bg-err-soft'">
          <div :class="fits ? 'text-ok' : 'text-err'" class="font-semibold">{{ fits ? t('calcPage.power.fits') : t('calcPage.power.notFits') }}</div>
          <div v-if="fits && runtime !== null" class="mt-1">
            {{ t('calcPage.power.runtime') }}: <span class="font-mono font-semibold">{{ t('calcPage.power.runtimeValue', { min: Math.round(runtime) }) }}</span>
          </div>
        </div>
        <p class="text-xs text-muted">{{ t('calcPage.power.note') }}</p>
      </section>
    </div>
  </div>
</template>
