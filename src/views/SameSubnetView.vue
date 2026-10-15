<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeftRight, GitCompareArrows } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/common/PageHeader.vue'
import IpInput from '@/components/common/IpInput.vue'
import CidrSelect from '@/components/common/CidrSelect.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import LearnNote from '@/components/common/LearnNote.vue'
import BitGrid from '@/components/network/BitGrid.vue'
import DeviceLinkDiagram from '@/components/network/DeviceLinkDiagram.vue'
import { useSettingsStore } from '@/stores/settings'
import type { SameSubnetResult } from '@/types/network'
import { checkSameSubnet, ipToInt, isValidIPv4 } from '@/utils/network'

interface DeviceForm {
  ip: string
  cidr: number
}

const settings = useSettingsStore()
const { t } = useI18n()

const a = ref<DeviceForm>({ ip: '192.168.1.10', cidr: 24 })
const b = ref<DeviceForm>({ ip: '192.168.1.20', cidr: 24 })

const examples: { labelKey: string; a: DeviceForm; b: DeviceForm }[] = [
  { labelKey: 'samePage.exSame', a: { ip: '192.168.1.10', cidr: 24 }, b: { ip: '192.168.1.20', cidr: 24 } },
  { labelKey: 'samePage.exDiff', a: { ip: '192.168.1.10', cidr: 24 }, b: { ip: '192.168.2.10', cidr: 24 } },
  { labelKey: 'samePage.exBoundary', a: { ip: '192.168.50.150', cidr: 27 }, b: { ip: '192.168.50.161', cidr: 27 } },
  { labelKey: 'samePage.exMismatch', a: { ip: '10.0.0.10', cidr: 24 }, b: { ip: '10.0.0.200', cidr: 25 } },
]

const canCheck = computed(() => isValidIPv4(a.value.ip) && isValidIPv4(b.value.ip))

function compute(): SameSubnetResult {
  return checkSameSubnet(a.value.ip, a.value.cidr, b.value.ip, b.value.cidr)
}

const result = ref<SameSubnetResult>(compute())

function check(): void {
  if (canCheck.value) result.value = compute()
}

function useExample(ex: (typeof examples)[number]): void {
  a.value = { ...ex.a }
  b.value = { ...ex.b }
  check()
}

function swap(): void {
  ;[a.value, b.value] = [b.value, a.value]
  check()
}

const via = computed(() => (result.value.same ? 'switch' : 'router'))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('samePage.title')"
      :description="t('samePage.desc')"
      :icon="GitCompareArrows"
    />

    <form class="card space-y-4 p-4" @submit.prevent="check">
      <div class="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <fieldset class="space-y-3 rounded-md border border-net/30 p-3">
          <legend class="px-1 text-sm font-semibold text-net">Device A</legend>
          <IpInput v-model="a.ip" label="IP" @submit="check" />
          <CidrSelect v-model="a.cidr" />
        </fieldset>
        <button type="button" class="btn mx-auto px-2" :title="t('common.swap')" @click="swap">
          <ArrowLeftRight class="size-4" />
        </button>
        <fieldset class="space-y-3 rounded-md border border-host/30 p-3">
          <legend class="px-1 text-sm font-semibold text-host">Device B</legend>
          <IpInput v-model="b.ip" label="IP" placeholder="192.168.1.20" @submit="check" />
          <CidrSelect v-model="b.cidr" />
        </fieldset>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="submit" class="btn btn-primary" :disabled="!canCheck">{{ t('common.check') }}</button>
        <span class="ml-2 text-xs text-muted">{{ t('common.examples') }}</span>
        <button v-for="ex in examples" :key="ex.labelKey" type="button" class="kbd text-xs hover:text-accent" @click="useExample(ex)">
          {{ t(ex.labelKey) }}
        </button>
      </div>
    </form>

    <StatusBanner v-if="result.same" variant="ok" :title="t('samePage.sameTitle')">
      {{ t('samePage.sameText') }}
    </StatusBanner>
    <StatusBanner v-else-if="result.maskMismatch" variant="warn" :title="t('samePage.mismatchTitle')">
      {{ t('samePage.mismatchText', { a: result.a.cidr, b: result.b.cidr }) }}
      <template v-if="result.aSeesBLocal !== result.bSeesALocal">
        {{
          t('samePage.asymmetric', {
            local: result.aSeesBLocal ? 'Device A' : 'Device B',
            remote: result.aSeesBLocal ? 'Device B' : 'Device A',
          })
        }}
      </template>
      <template v-else>{{ t('samePage.sameMaskAdvice') }}</template>
    </StatusBanner>
    <StatusBanner v-else variant="err" :title="t('samePage.diffTitle')">
      {{ t('samePage.diffText') }}
    </StatusBanner>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="card p-4">
        <h2 class="mb-3 font-semibold">{{ t('samePage.networks') }}</h2>
        <dl class="space-y-3 font-mono text-sm">
          <div>
            <dt class="font-sans text-xs text-muted">Device A Network</dt>
            <dd class="text-lg text-net">{{ result.a.networkAddress }}/{{ result.a.cidr }}</dd>
          </div>
          <div>
            <dt class="font-sans text-xs text-muted">Device B Network</dt>
            <dd class="text-lg text-host">{{ result.b.networkAddress }}/{{ result.b.cidr }}</dd>
          </div>
        </dl>
      </section>
      <section class="card p-4">
        <DeviceLinkDiagram
          :a="{ name: 'Device A', ip: result.a.ip, sub: `${result.a.networkAddress}/${result.a.cidr}` }"
          :b="{ name: 'Device B', ip: result.b.ip, sub: `${result.b.networkAddress}/${result.b.cidr}` }"
          :via="via"
        />
      </section>
    </div>

    <template v-if="settings.mode === 'learning'">
      <section class="card space-y-4 p-4">
        <h2 class="font-semibold">{{ t('samePage.compare') }}</h2>
        <BitGrid :value="ipToInt(result.a.networkAddress)" :cidr="result.a.cidr" label="Device A Network" dim-host />
        <BitGrid :value="ipToInt(result.b.networkAddress)" :cidr="result.b.cidr" label="Device B Network" dim-host />
      </section>
      <LearnNote :title="t('samePage.noteTitle')">{{ t('samePage.note') }}</LearnNote>
    </template>
  </div>
</template>
