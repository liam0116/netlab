<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import SequenceDiagram from './SequenceDiagram.vue'
import type { SequenceMessage } from '@/types/tutorial'
import { useHandshakeState } from '@/composables/useHandshakeState'
import { buildTcpSession, TCP_SERVICES, type TcpService } from '@/utils/tcp'

/** step = number of segments shown (3 = handshake complete). The service can be switched live. */
const props = defineProps<{ step: number }>()
const { t } = useI18n()

const services = Object.keys(TCP_SERVICES) as TcpService[]
const labels: Record<TcpService, string> = { http: 'HTTP 80', https: 'HTTPS 443', ssh: 'SSH 22', mysql: 'MySQL 3306' }
const { service, clientIsn, serverIsn, regenerate } = useHandshakeState()
const clientPort = 51544

const segments = computed(() => buildTcpSession(service.value, clientIsn.value, serverIsn.value))
const messages = computed<SequenceMessage[]>(() =>
  segments.value.map((s) => ({
    from: s.from === 'client' ? 0 : 1,
    to: s.from === 'client' ? 1 : 0,
    label: `${s.flags}  seq=${s.seq}${s.ack !== undefined ? ` ack=${s.ack}` : ''}${s.len ? ` len=${s.len}` : ''}`,
    detail: s.payload,
    tone: s.flags.includes('SYN') ? 'host' : s.payload ? 'accent' : 'ok',
  })),
)
const actors = computed(() => [
  `${t('visuals.handshake.client')} :${clientPort}`,
  `${t('visuals.handshake.server')} :${TCP_SERVICES[service.value].port}`,
])
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      <span class="text-muted">{{ t('visuals.handshake.service') }}</span>
      <button
        v-for="s in services"
        :key="s"
        class="rounded-md border px-2 py-1 font-mono transition-colors"
        :class="service === s ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg'"
        @click="service = s"
      >
        {{ labels[s] }}
      </button>
      <button class="ml-auto rounded p-1 text-muted hover:text-accent" :title="t('visuals.handshake.regenerate')" @click="regenerate">
        <RefreshCw class="size-3.5" />
      </button>
    </div>
    <SequenceDiagram :actors="actors" :messages="messages" :step="props.step" />
    <Transition name="fade">
      <div
        v-if="props.step >= 3"
        class="rounded-md border border-ok/40 bg-ok-soft px-3 py-1.5 text-center font-mono text-xs font-semibold text-ok"
      >
        ✓ {{ t('visuals.handshake.established') }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active {
  transition: opacity 0.3s;
}
.fade-enter-from {
  opacity: 0;
}
</style>
