<script setup lang="ts">
import { computed, ref } from 'vue'
import { Router } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/common/PageHeader.vue'
import IpInput from '@/components/common/IpInput.vue'
import CidrSelect from '@/components/common/CidrSelect.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import LearnNote from '@/components/common/LearnNote.vue'
import KeyValueList from '@/components/common/KeyValueList.vue'
import RichText from '@/components/common/RichText.vue'
import DeviceLinkDiagram from '@/components/network/DeviceLinkDiagram.vue'
import SubnetRangeBar from '@/components/network/SubnetRangeBar.vue'
import { useSettingsStore } from '@/stores/settings'
import type { KeyValueRow } from '@/types/app'
import type { GatewayValidationResult } from '@/types/network'
import { isValidIPv4, validateGateway } from '@/utils/network'

interface GatewayForm {
  ip: string
  cidr: number
  gateway: string
}

const settings = useSettingsStore()
const { t } = useI18n()

const form = ref<GatewayForm>({ ip: '10.20.30.150', cidr: 26, gateway: '10.20.30.129' })

const examples: { labelKey: string; value: GatewayForm }[] = [
  { labelKey: 'gatewayPage.exOk', value: { ip: '10.20.30.150', cidr: 26, gateway: '10.20.30.129' } },
  { labelKey: 'gatewayPage.exOutside', value: { ip: '192.168.10.50', cidr: 24, gateway: '192.168.20.1' } },
  { labelKey: 'gatewayPage.exNetwork', value: { ip: '10.20.30.150', cidr: 26, gateway: '10.20.30.128' } },
  { labelKey: 'gatewayPage.exMask', value: { ip: '10.20.30.10', cidr: 28, gateway: '10.20.30.254' } },
]

const canCheck = computed(() => isValidIPv4(form.value.ip) && isValidIPv4(form.value.gateway))

function compute(): GatewayValidationResult {
  return validateGateway(form.value.ip, form.value.cidr, form.value.gateway)
}

const result = ref<GatewayValidationResult>(compute())

function check(): void {
  if (canCheck.value) result.value = compute()
}

function useExample(ex: GatewayForm): void {
  form.value = { ...ex }
  check()
}

const outside = computed(() => result.value.issues.some((i) => i.code === 'outside-subnet'))

const rows = computed<KeyValueRow[]>(() => [
  {
    label: 'Server Network',
    value: `${result.value.server.networkAddress}/${result.value.server.cidr}`,
    tone: 'net',
  },
  {
    label: 'Gateway Network',
    value: `${result.value.gatewayNetwork}/${result.value.server.cidr}`,
    tone: outside.value ? 'err' : 'net',
    hint: t('gatewayPage.gatewayNetworkHint'),
  },
  { label: t('gatewayPage.usableRange'), value: `${result.value.server.firstHost} - ${result.value.server.lastHost}` },
  { label: 'Broadcast', value: result.value.server.broadcastAddress, tone: 'host' },
])
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('gatewayPage.title')"
      :description="t('gatewayPage.desc')"
      :icon="Router"
    />

    <form class="card space-y-4 p-4" @submit.prevent="check">
      <div class="grid gap-4 sm:grid-cols-3">
        <IpInput v-model="form.ip" label="Server IP" @submit="check" />
        <CidrSelect v-model="form.cidr" label="Mask" />
        <IpInput v-model="form.gateway" label="Gateway" placeholder="10.20.30.129" @submit="check" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="submit" class="btn btn-primary" :disabled="!canCheck">{{ t('common.validate') }}</button>
        <span class="ml-2 text-xs text-muted">{{ t('common.examples') }}</span>
        <button
          v-for="ex in examples"
          :key="ex.labelKey"
          type="button"
          class="kbd text-xs hover:text-accent"
          @click="useExample(ex.value)"
        >
          {{ t(ex.labelKey) }}
        </button>
      </div>
    </form>

    <StatusBanner v-if="result.valid" variant="ok" :title="t('gatewayPage.okTitle')">
      {{ t('gatewayPage.okText', { gateway: result.gatewayIp, network: `${result.server.networkAddress}/${result.server.cidr}` }) }}
    </StatusBanner>
    <StatusBanner
      v-else
      variant="err"
      :title="outside ? t('gatewayPage.outsideTitle') : t('gatewayPage.unusableTitle')"
    >
      <ul class="list-disc space-y-1 pl-4">
        <li v-for="issue in result.issues" :key="issue.code">{{ t(`gatewayPage.issues.${issue.code}`, issue.params) }}</li>
      </ul>
    </StatusBanner>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="card p-4">
        <KeyValueList :rows="rows" />
      </section>
      <section class="card p-4">
        <DeviceLinkDiagram
          :a="{ name: 'Server', ip: result.server.ip, sub: `/${result.server.cidr}` }"
          :b="{ name: 'Internet', ip: '0.0.0.0/0' }"
          :via="result.valid ? 'router' : 'blocked'"
          :via-label="`GW ${result.gatewayIp}`"
        />
      </section>
    </div>

    <template v-if="settings.mode === 'learning'">
      <section class="card p-4">
        <h2 class="mb-1 font-semibold">{{ t('gatewayPage.rangeTitle') }}</h2>
        <SubnetRangeBar :info="result.server" :gateway="result.gatewayIp" />
      </section>
      <LearnNote :title="t('gatewayPage.noteTitle')"><RichText :text="t('gatewayPage.note')" /></LearnNote>
    </template>
  </div>
</template>
