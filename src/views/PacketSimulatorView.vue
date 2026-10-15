<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Send } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import IpInput from '@/components/common/IpInput.vue'
import CidrSelect from '@/components/common/CidrSelect.vue'
import StepControls from '@/components/common/StepControls.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import LearnNote from '@/components/common/LearnNote.vue'
import RichText from '@/components/common/RichText.vue'
import PacketDiagram from '@/components/lab/PacketDiagram.vue'
import { useStepPlayer } from '@/composables/useStepPlayer'
import { useSettingsStore } from '@/stores/settings'
import { BROADCAST_MAC } from '@/utils/mac'
import { isValidIPv4 } from '@/utils/network'
import { buildPacketFlow, type PacketFlowInput, type PacketNode, type PacketStep } from '@/utils/packetFlow'

const settings = useSettingsStore()
const { t } = useI18n()

interface Form {
  srcIp: string
  srcCidr: number
  gateway: string
  dstIp: string
}

const presets: { key: string; value: Form }[] = [
  { key: 'local', value: { srcIp: '192.168.1.10', srcCidr: 24, gateway: '192.168.1.1', dstIp: '192.168.1.20' } },
  { key: 'internet', value: { srcIp: '192.168.1.10', srcCidr: 24, gateway: '192.168.1.1', dstIp: '8.8.8.8' } },
  { key: 'routed', value: { srcIp: '10.0.1.10', srcCidr: 24, gateway: '10.0.1.1', dstIp: '10.0.2.20' } },
  { key: 'badGateway', value: { srcIp: '192.168.10.50', srcCidr: 24, gateway: '192.168.20.1', dstIp: '8.8.8.8' } },
]

const form = ref<Form>({ ...presets[1]!.value })
const input = ref<PacketFlowInput>({ ...form.value })
const valid = computed(() => [form.value.srcIp, form.value.gateway, form.value.dstIp].every(isValidIPv4))

const flow = computed(() => buildPacketFlow(input.value))
const player = useStepPlayer(computed(() => flow.value.steps.length), 1800)
const step = computed(() => flow.value.steps[player.current.value]!)

function simulate(): void {
  if (!valid.value) return
  input.value = { ...form.value }
  player.reset()
}
function usePreset(value: Form): void {
  form.value = { ...value }
  simulate()
}

const labels = computed<Record<PacketNode, { name: string; sub?: string }>>(() => ({
  src: { name: t('packetPage.nodes.src'), sub: `${input.value.srcIp}/${input.value.srcCidr}` },
  switch: { name: t('packetPage.nodes.switch') },
  dst: { name: t('packetPage.nodes.dst'), sub: input.value.dstIp },
  router: { name: t('packetPage.nodes.router'), sub: input.value.gateway },
  internet: { name: t('packetPage.nodes.internet') },
  remote: { name: t('packetPage.nodes.remote'), sub: input.value.dstIp },
}))

function stepTitle(s: PacketStep): string {
  return t(`packetPage.steps.${s.code}.title`, s.params)
}
function stepText(s: PacketStep): string {
  const text = t(`packetPage.steps.${s.code}.text`, s.params)
  return s.code === 'gateway-invalid' ? `${text} ${t(`gatewayPage.issues.${s.params.issue}`, { address: s.params.gateway ?? '' })}` : text
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('packetPage.title')" :description="t('packetPage.desc')" :icon="Send" />

    <form class="card space-y-4 p-4" @submit.prevent="simulate">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <IpInput v-model="form.srcIp" :label="t('packetPage.srcIp')" @submit="simulate" />
        <CidrSelect v-model="form.srcCidr" />
        <IpInput v-model="form.gateway" :label="t('packetPage.gateway')" @submit="simulate" />
        <IpInput v-model="form.dstIp" :label="t('packetPage.dstIp')" placeholder="8.8.8.8" @submit="simulate" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="submit" class="btn btn-primary" :disabled="!valid">{{ t('packetPage.simulate') }}</button>
        <span class="ml-2 text-xs text-muted">{{ t('common.examples') }}</span>
        <button v-for="p in presets" :key="p.key" type="button" class="kbd text-xs hover:text-accent" @click="usePreset(p.value)">
          {{ t(`packetPage.presets.${p.key}`) }}
        </button>
      </div>
    </form>

    <StatusBanner
      :variant="flow.scenario === 'error' ? 'err' : flow.scenario === 'local' ? 'ok' : 'info'"
      :title="t(`packetPage.scenario.${flow.scenario}`)"
    />

    <section class="card overflow-hidden">
      <div class="border-b border-line p-4">
        <StepControls
          :current="player.current.value"
          :total="flow.steps.length"
          :playing="player.playing.value"
          can-play
          @prev="player.prev"
          @next="player.next"
          @toggle="player.toggle"
          @reset="player.reset"
        />
      </div>
      <div class="overflow-x-auto px-2 pt-4">
        <div class="min-w-[640px]">
          <PacketDiagram :flow="flow" :step="player.current.value" :labels="labels" />
        </div>
      </div>

      <div class="grid gap-6 border-t border-line p-4 lg:grid-cols-2">
        <div :key="player.current.value" class="anim-fade space-y-2">
            <h2
              class="text-lg font-semibold"
              :class="step.status === 'error' ? 'text-err' : step.status === 'ok' ? 'text-ok' : ''"
            >
              <span class="mr-1 font-mono text-sm text-muted">{{ player.current.value + 1 }}.</span>
              {{ stepTitle(step) }}
            </h2>
            <p v-if="settings.mode === 'learning'" class="text-sm leading-relaxed text-fg/85">
              <RichText :text="stepText(step)" />
            </p>
        </div>

        <div v-if="step.frame">
          <h3 class="label">{{ t('packetPage.frame') }}</h3>
          <table class="w-full font-mono text-xs">
            <tbody class="divide-y divide-line">
              <tr>
                <td class="py-1.5 pr-3 font-sans text-muted">{{ t('packetPage.frameKind') }}</td>
                <td :class="step.frame.kind.startsWith('ARP') ? 'text-host' : 'text-accent'">{{ step.frame.kind }}</td>
              </tr>
              <tr>
                <td class="py-1.5 pr-3 font-sans text-muted">{{ t('packetPage.srcMac') }}</td>
                <td>{{ step.frame.srcMac }}</td>
              </tr>
              <tr>
                <td class="py-1.5 pr-3 font-sans text-muted">{{ t('packetPage.dstMac') }}</td>
                <td :class="step.frame.dstMac === BROADCAST_MAC ? 'text-host' : ''">
                  {{ step.frame.dstMac }}
                  <span v-if="step.frame.dstMac === BROADCAST_MAC" class="font-sans">({{ t('packetPage.broadcast') }})</span>
                </td>
              </tr>
              <tr>
                <td class="py-1.5 pr-3 font-sans text-muted">{{ t('packetPage.srcIpCol') }}</td>
                <td>{{ step.frame.srcIp }}</td>
              </tr>
              <tr>
                <td class="py-1.5 pr-3 font-sans text-muted">{{ t('packetPage.dstIpCol') }}</td>
                <td>{{ step.frame.dstIp }}</td>
              </tr>
              <tr v-if="step.frame.ttl !== undefined">
                <td class="py-1.5 pr-3 font-sans text-muted">TTL</td>
                <td>{{ step.frame.ttl }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="card p-4">
      <h2 class="mb-3 font-semibold">{{ t('packetPage.timeline') }}</h2>
      <ol class="space-y-1">
        <li v-for="(s, i) in flow.steps" :key="i">
          <button
            class="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-surface-2"
            :class="[
              i === player.current.value ? 'bg-accent-soft text-accent' : '',
              s.status === 'error' ? 'text-err' : s.status === 'ok' ? 'text-ok' : '',
            ]"
            @click="player.goTo(i)"
          >
            <span class="w-6 shrink-0 font-mono text-xs text-muted">{{ i + 1 }}</span>
            <span>{{ stepTitle(s) }}</span>
          </button>
        </li>
      </ol>
    </section>

    <LearnNote :title="t('packetPage.noteTitle')">{{ t('packetPage.note') }}</LearnNote>
  </div>
</template>

