<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Calculator } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/common/PageHeader.vue'
import IpInput from '@/components/common/IpInput.vue'
import CidrSelect from '@/components/common/CidrSelect.vue'
import KeyValueList from '@/components/common/KeyValueList.vue'
import LearnNote from '@/components/common/LearnNote.vue'
import RichText from '@/components/common/RichText.vue'
import BitGrid from '@/components/network/BitGrid.vue'
import BitLegend from '@/components/network/BitLegend.vue'
import SubnetRangeBar from '@/components/network/SubnetRangeBar.vue'
import SubnetBlocksList from '@/components/network/SubnetBlocksList.vue'
import EngineerOutput from '@/components/network/EngineerOutput.vue'
import { useSettingsStore } from '@/stores/settings'
import type { KeyValueRow } from '@/types/app'
import { calculateSubnet, cidrToMaskInt, ipToInt, isValidIPv4, parseCidr, parseCidrNotation } from '@/utils/network'

const settings = useSettingsStore()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const examples = ['192.168.50.137/27', '10.20.30.150/26', '172.20.77.9/20', '10.0.0.1/31']

const initial = parseCidrNotation(`${route.query.ip ?? ''}/${route.query.cidr ?? ''}`) ?? { ip: '192.168.50.137', cidr: 27 }
const ipInput = ref(initial.ip)
const cidr = ref(initial.cidr)
const submitted = ref<{ ip: string; cidr: number }>({ ...initial })

// Pasting "10.0.0.5/24" into the IP field splits it automatically.
watch(ipInput, (value) => {
  if (!value.includes('/')) return
  const parsed = parseCidrNotation(value)
  if (parsed) {
    ipInput.value = parsed.ip
    cidr.value = parsed.cidr
  }
})

const canCalculate = computed(() => isValidIPv4(ipInput.value) && parseCidr(cidr.value) !== null)

function calculate(): void {
  if (!canCalculate.value) return
  submitted.value = { ip: ipInput.value, cidr: cidr.value }
  router.replace({ query: { ip: ipInput.value, cidr: String(cidr.value) } })
}

function useExample(example: string): void {
  const parsed = parseCidrNotation(example)
  if (!parsed) return
  ipInput.value = parsed.ip
  cidr.value = parsed.cidr
  calculate()
}

const info = computed(() => calculateSubnet(submitted.value.ip, submitted.value.cidr))
const stale = computed(() => ipInput.value !== submitted.value.ip || cidr.value !== submitted.value.cidr)

const rows = computed<KeyValueRow[]>(() => {
  const r = info.value
  return [
    { label: 'IP Address', value: r.ip, tone: 'accent', hint: `Class ${r.ipClass} · ${r.addressType}` },
    { label: 'Subnet Mask', value: r.subnetMask },
    { label: 'CIDR', value: `/${r.cidr}` },
    { label: 'Network Address', value: r.networkAddress, tone: 'net' },
    { label: 'Broadcast Address', value: r.broadcastAddress, tone: 'host' },
    { label: 'First Host', value: r.firstHost },
    { label: 'Last Host', value: r.lastHost },
    { label: 'Total IP Addresses', value: r.totalAddresses.toLocaleString() },
    {
      label: 'Usable Hosts',
      value: r.usableHosts.toLocaleString(),
      tone: 'ok',
      hint: r.cidr === 31 ? t('subnetPage.hintP2p') : r.cidr === 32 ? t('subnetPage.hintHost') : `2^${r.hostBits} − 2`,
    },
    { label: 'Network Bits', value: String(r.networkBits), tone: 'net' },
    { label: 'Host Bits', value: String(r.hostBits), tone: 'host' },
    { label: 'Wildcard Mask', value: r.wildcardMask },
    { label: 'Binary IP', value: r.binaryIp },
    { label: 'Binary Mask', value: r.binaryMask },
  ]
})

const engineerRows = computed<[string, string][]>(() => {
  const r = info.value
  return [
    ['Network', `${r.networkAddress}/${r.cidr}`],
    ['First Host', r.firstHost],
    ['Last Host', r.lastHost],
    ['Broadcast', r.broadcastAddress],
    ['Mask', r.subnetMask],
    ['Wildcard', r.wildcardMask],
    ['Hosts', r.usableHosts.toLocaleString()],
  ]
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('subnetPage.title')"
      :description="t('subnetPage.desc')"
      :icon="Calculator"
    />

    <form class="card grid gap-4 p-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end" @submit.prevent="calculate">
      <IpInput v-model="ipInput" label="IP Address" :placeholder="t('subnetPage.ipPlaceholder')" @submit="calculate" />
      <CidrSelect v-model="cidr" />
      <button type="submit" class="btn btn-primary h-[38px]" :disabled="!canCalculate">{{ t('common.calculate') }}</button>
      <div class="flex flex-wrap items-center gap-2 text-xs text-muted sm:col-span-3">
        {{ t('common.examples') }}
        <button v-for="ex in examples" :key="ex" type="button" class="kbd hover:text-accent" @click="useExample(ex)">
          {{ ex }}
        </button>
        <span v-if="stale && canCalculate" class="ml-auto text-warn">{{ t('subnetPage.stale') }}</span>
      </div>
    </form>

    <!-- Engineer Mode: straight to the answer -->
    <template v-if="settings.mode === 'engineer'">
      <EngineerOutput :title="`ipcalc ${info.ip}/${info.cidr}`" :rows="engineerRows" />
      <div class="card p-4">
        <KeyValueList :rows="rows.slice(-2)" />
      </div>
    </template>

    <!-- Learning Mode: full result + how it was calculated -->
    <template v-else>
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="card p-4">
          <h2 class="mb-2 font-semibold">{{ t('subnetPage.result') }}</h2>
          <KeyValueList :rows="rows" />
        </section>

        <section class="space-y-6">
          <div class="card p-4">
            <h2 class="mb-1 font-semibold">{{ t('subnetPage.range') }}</h2>
            <SubnetRangeBar :info="info" />
          </div>
          <div class="card p-4">
            <h2 class="mb-3 font-semibold">{{ t('subnetPage.process') }}</h2>
            <SubnetBlocksList :ip="info.ip" :cidr="info.cidr" />
          </div>
        </section>
      </div>

      <section class="card space-y-4 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold">{{ t('subnetPage.binary') }}</h2>
          <BitLegend :network-bits="info.cidr" />
        </div>
        <BitGrid :value="ipToInt(info.ip)" :cidr="info.cidr" label="IP Address" />
        <BitGrid :value="cidrToMaskInt(info.cidr)" :cidr="info.cidr" label="Subnet Mask (AND)" />
        <BitGrid :value="ipToInt(info.networkAddress)" :cidr="info.cidr" label="= Network Address" />
        <BitGrid :value="ipToInt(info.broadcastAddress)" :cidr="info.cidr" :label="t('subnetPage.broadcastRow')" />
      </section>

      <LearnNote :title="t('subnetPage.noteTitle')"><RichText :text="t('subnetPage.note')" /></LearnNote>
    </template>
  </div>
</template>
