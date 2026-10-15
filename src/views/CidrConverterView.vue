<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftRight } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/common/PageHeader.vue'
import StepControls from '@/components/common/StepControls.vue'
import LearnNote from '@/components/common/LearnNote.vue'
import KeyValueList from '@/components/common/KeyValueList.vue'
import RichText from '@/components/common/RichText.vue'
import MaskBitsAnimator from '@/components/network/MaskBitsAnimator.vue'
import { useStepPlayer } from '@/composables/useStepPlayer'
import { useSettingsStore } from '@/stores/settings'
import type { KeyValueRow } from '@/types/app'
import type { ValidationError } from '@/types/network'
import {
  buildCidrTable,
  cidrToMask,
  cidrToWildcard,
  getTotalAddresses,
  getUsableHosts,
  maskToCidr,
  parseCidr,
  validateMask,
} from '@/utils/network'

const settings = useSettingsStore()
const { t } = useI18n()

const input = ref('255.255.255.224')
const cidr = ref(27)

/** Accepts a dotted mask (255.255.255.224) or a prefix (/27, 27). */
const parsed = computed<{ cidr: number | null; error: ValidationError | null }>(() => {
  const value = input.value.trim()
  if (value.includes('.')) {
    const error = validateMask(value)
    return { cidr: error ? null : maskToCidr(value), error }
  }
  const prefix = parseCidr(value)
  return { cidr: prefix, error: prefix === null ? { key: 'validation.maskOrCidr' } : null }
})

watch(parsed, (p) => {
  if (p.cidr !== null) cidr.value = p.cidr
})

const player = useStepPlayer(ref(6), 1000)
function syncPlayer(): void {
  if (settings.mode === 'engineer') player.finish()
  else player.reset()
}
watch(cidr, syncPlayer)
watch(() => settings.mode, syncPlayer, { immediate: true })

const resultRows = computed<KeyValueRow[]>(() => [
  { label: 'CIDR', value: `/${cidr.value}`, tone: 'accent' },
  { label: 'Subnet Mask', value: cidrToMask(cidr.value), tone: 'net' },
  { label: 'Wildcard Mask', value: cidrToWildcard(cidr.value) },
  { label: 'Total Addresses', value: getTotalAddresses(cidr.value).toLocaleString() },
  { label: 'Usable Hosts', value: getUsableHosts(cidr.value).toLocaleString(), tone: 'ok' },
])

const table = buildCidrTable()

function selectRow(prefix: number): void {
  input.value = settings.mode === 'engineer' ? `/${prefix}` : cidrToMask(prefix)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('cidrPage.title')"
      :description="t('cidrPage.desc')"
      :icon="ArrowLeftRight"
    />

    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section class="card space-y-4 p-4">
        <div>
          <label for="cidr-in" class="label">{{ t('cidrPage.input') }}</label>
          <input
            id="cidr-in"
            v-model.trim="input"
            class="field text-lg"
            :class="{ 'field-invalid': parsed.error }"
            :placeholder="t('cidrPage.placeholder')"
            spellcheck="false"
            autocomplete="off"
          />
          <p v-if="parsed.error" class="mt-1 text-xs text-err">{{ t(parsed.error.key, parsed.error.params ?? {}) }}</p>
        </div>

        <MaskBitsAnimator :cidr="cidr" :step="player.current.value" />

        <StepControls
          v-if="settings.mode === 'learning'"
          :current="player.current.value"
          :total="6"
          :playing="player.playing.value"
          can-play
          @prev="player.prev"
          @next="player.next"
          @toggle="player.toggle"
          @reset="player.reset"
        />
      </section>

      <section class="space-y-4">
        <div class="card p-4">
          <KeyValueList :rows="resultRows" />
        </div>
        <LearnNote><RichText :text="t('cidrPage.note')" /></LearnNote>
      </section>
    </div>

    <section class="card overflow-hidden">
      <div class="border-b border-line px-4 py-3 font-semibold">{{ t('cidrPage.table') }}</div>
      <div class="max-h-[28rem] overflow-auto">
        <table class="w-full font-mono text-sm">
          <thead class="sticky top-0 bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">CIDR</th>
              <th class="px-4 py-2 font-medium">Subnet Mask</th>
              <th class="hidden px-4 py-2 font-medium sm:table-cell">Wildcard</th>
              <th class="px-4 py-2 text-right font-medium">Total</th>
              <th class="px-4 py-2 text-right font-medium">Usable</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in table"
              :key="row.cidr"
              class="cursor-pointer border-t border-line transition-colors hover:bg-surface-2"
              :class="row.cidr === cidr ? 'bg-accent-soft text-accent' : ''"
              @click="selectRow(row.cidr)"
            >
              <td class="px-4 py-1.5">/{{ row.cidr }}</td>
              <td class="px-4 py-1.5">{{ row.mask }}</td>
              <td class="hidden px-4 py-1.5 text-muted sm:table-cell">{{ row.wildcard }}</td>
              <td class="px-4 py-1.5 text-right">{{ row.totalAddresses.toLocaleString() }}</td>
              <td class="px-4 py-1.5 text-right">{{ row.usableHosts.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
