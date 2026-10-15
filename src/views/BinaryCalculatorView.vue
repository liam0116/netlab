<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Binary } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/common/PageHeader.vue'
import StepControls from '@/components/common/StepControls.vue'
import LearnNote from '@/components/common/LearnNote.vue'
import RichText from '@/components/common/RichText.vue'
import IpInput from '@/components/common/IpInput.vue'
import CopyButton from '@/components/common/CopyButton.vue'
import BinaryOctetAnimator from '@/components/network/BinaryOctetAnimator.vue'
import BinarySumView from '@/components/network/BinarySumView.vue'
import BitGrid from '@/components/network/BitGrid.vue'
import { useStepPlayer } from '@/composables/useStepPlayer'
import { useSettingsStore } from '@/stores/settings'
import { binaryToDecimal, ipToInt, isValidIPv4, toBinaryOctet, toBinaryString, validateBinaryOctet } from '@/utils/network'

const settings = useSettingsStore()
const { t } = useI18n()

// --- Decimal → Binary --------------------------------------------------------
const decimalInput = ref('192')
const decimalError = computed(() => {
  const v = decimalInput.value.trim()
  if (!/^\d{1,3}$/.test(v)) return t('validation.decimalOctet')
  return Number(v) > 255 ? t('validation.decimalMax') : null
})
const decimalValue = ref(192)
watch(decimalInput, () => {
  if (!decimalError.value) decimalValue.value = Number(decimalInput.value)
})

// Steps 0..9: 0 = idle, 1..8 = one bit per step, 9 = final result.
const totalSteps = ref(10)
const player = useStepPlayer(totalSteps, 900)
watch(decimalValue, () => (settings.mode === 'engineer' ? player.finish() : player.reset()))
watch(
  () => settings.mode,
  (mode) => (mode === 'engineer' ? player.finish() : player.reset()),
  { immediate: true },
)

// --- Binary → Decimal --------------------------------------------------------
const binaryInput = ref('11000000')
const binaryError = computed(() => validateBinaryOctet(binaryInput.value))
const lastValidBinary = ref('11000000')
watch(binaryInput, () => {
  if (!binaryError.value) lastValidBinary.value = binaryInput.value
})
const binaryResult = computed(() => binaryToDecimal(lastValidBinary.value))

// --- Full IPv4 → Binary --------------------------------------------------------
const ipInput = ref('192.168.1.10')
const ipValid = computed(() => isValidIPv4(ipInput.value))
const lastValidIp = ref('192.168.1.10')
watch(ipInput, () => {
  if (ipValid.value) lastValidIp.value = ipInput.value
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('binaryPage.title')"
      :description="t('binaryPage.desc')"
      :icon="Binary"
    />

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Decimal → Binary -->
      <section class="card space-y-4 p-4">
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label for="dec-in" class="label">{{ t('binaryPage.decToBin') }}</label>
            <input
              id="dec-in"
              v-model.trim="decimalInput"
              class="field text-lg"
              :class="{ 'field-invalid': decimalError }"
              inputmode="numeric"
              maxlength="3"
              placeholder="192"
            />
          </div>
          <div class="pb-2 font-mono text-lg">
            = <span class="text-net">{{ toBinaryOctet(decimalValue) }}</span>
          </div>
        </div>
        <p v-if="decimalError" class="-mt-2 text-xs text-err">{{ decimalError }}</p>

        <BinaryOctetAnimator :value="decimalValue" :step="player.current.value" />

        <StepControls
          v-if="settings.mode === 'learning'"
          :current="player.current.value"
          :total="10"
          :playing="player.playing.value"
          can-play
          @prev="player.prev"
          @next="player.next"
          @toggle="player.toggle"
          @reset="player.reset"
        />
      </section>

      <!-- Binary → Decimal -->
      <section class="card space-y-4 p-4">
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label for="bin-in" class="label">{{ t('binaryPage.binToDec') }}</label>
            <input
              id="bin-in"
              v-model.trim="binaryInput"
              class="field text-lg tracking-widest"
              :class="{ 'field-invalid': binaryError }"
              maxlength="9"
              placeholder="11000000"
            />
          </div>
          <div class="pb-2 font-mono text-lg">
            = <span class="text-accent">{{ binaryResult.value }}</span>
          </div>
        </div>
        <p v-if="binaryError" class="-mt-2 text-xs text-err">{{ t(binaryError.key) }}</p>
        <BinarySumView :binary="lastValidBinary" />
        <LearnNote><RichText :text="t('binaryPage.noteBinToDec')" /></LearnNote>
      </section>
    </div>

    <!-- IPv4 → Binary -->
    <section class="card space-y-4 p-4">
      <div class="grid gap-4 sm:grid-cols-[18rem_1fr] sm:items-end">
        <IpInput v-model="ipInput" :label="t('binaryPage.ipToBin')" />
        <div class="flex flex-wrap items-center gap-2 pb-1 font-mono text-sm">
          <span class="break-all">{{ toBinaryString(ipToInt(lastValidIp)) }}</span>
          <CopyButton :text="toBinaryString(ipToInt(lastValidIp))" />
        </div>
      </div>
      <BitGrid :value="ipToInt(lastValidIp)" />
      <LearnNote><RichText :text="t('binaryPage.noteIp')" /></LearnNote>
    </section>
  </div>
</template>
