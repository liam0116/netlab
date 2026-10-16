<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck, CircleX, LifeBuoy, RotateCcw, ChevronLeft } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import IpInput from '@/components/common/IpInput.vue'
import RichText from '@/components/common/RichText.vue'
import TerminalBlock from '@/components/common/TerminalBlock.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import { fillGateway, TROUBLE_STEPS } from '@/data/troubleshooting'
import { troubleshootingTexts } from '@/i18n/content'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { t } = useI18n()

const gateway = ref('192.168.1.1')
/** One entry per answered step: true = normal. The wizard stops at the first `false`. */
const answers = ref<boolean[]>([])

const texts = computed(() => troubleshootingTexts[settings.locale])
const failedIndex = computed(() => answers.value.indexOf(false))
const finished = computed(() => failedIndex.value >= 0 || answers.value.length === TROUBLE_STEPS.length)
const current = computed(() => (finished.value ? null : TROUBLE_STEPS[answers.value.length]))
const diagnosisId = computed(() => (failedIndex.value >= 0 ? TROUBLE_STEPS[failedIndex.value]!.id : 'ok'))
const diagnosis = computed(() => texts.value.diagnoses[diagnosisId.value]!)

function answer(ok: boolean): void {
  answers.value = [...answers.value, ok]
}
function back(): void {
  answers.value = answers.value.slice(0, -1)
}
function restart(): void {
  answers.value = []
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('troublePage.title')" :description="t('troublePage.desc')" :icon="LifeBuoy" />

    <div class="card grid gap-4 p-4 sm:grid-cols-[1fr_16rem] sm:items-end">
      <div class="font-medium">{{ t('troublePage.scenario') }}</div>
      <IpInput v-model="gateway" :label="t('troublePage.gatewayLabel')" placeholder="192.168.1.1" />
    </div>

    <!-- Progress -->
    <ol class="grid grid-cols-3 gap-2 sm:grid-cols-6">
      <li
        v-for="(step, i) in TROUBLE_STEPS"
        :key="step.id"
        class="rounded-md border px-2 py-2 text-xs transition-colors"
        :class="
          answers[i] === true
            ? 'border-ok/50 bg-ok-soft text-ok'
            : answers[i] === false
              ? 'border-err/50 bg-err-soft text-err'
              : i === answers.length && !finished
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-muted'
        "
      >
        <div class="flex items-center gap-1 font-mono">
          <CircleCheck v-if="answers[i] === true" class="size-3.5" />
          <CircleX v-else-if="answers[i] === false" class="size-3.5" />
          <span v-else>{{ i + 1 }}.</span>
          <span class="truncate">{{ step.command.split(' ').slice(0, 2).join(' ') }}</span>
        </div>
      </li>
    </ol>

    <!-- Current step -->
      <section v-if="current" :key="current.id" class="anim-slide card space-y-4 p-5">
        <div class="text-xs text-muted">{{ t('troublePage.stepOf', { n: answers.length + 1, total: TROUBLE_STEPS.length }) }}</div>
        <h2 class="text-lg font-semibold">{{ texts.steps[current.id]!.question }}</h2>
        <p v-if="settings.mode === 'learning'" class="text-sm text-fg/85">
          <RichText :text="texts.steps[current.id]!.explain" />
        </p>

        <TerminalBlock :command="fillGateway(current.command, gateway)" />

        <div class="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <div class="space-y-1.5">
            <h3 class="text-xs font-semibold text-ok">{{ t('troublePage.expectNormal') }}</h3>
            <pre class="overflow-x-auto rounded-md border border-ok/40 bg-surface-2 p-3 font-mono text-xs leading-relaxed">{{ fillGateway(current.normalOutput, gateway) }}</pre>
            <p class="text-sm text-fg/85"><RichText :text="texts.steps[current.id]!.normal" /></p>
          </div>
          <div class="space-y-1.5">
            <h3 class="text-xs font-semibold text-err">{{ t('troublePage.expectAbnormal') }}</h3>
            <pre class="overflow-x-auto rounded-md border border-err/40 bg-surface-2 p-3 font-mono text-xs leading-relaxed">{{ fillGateway(current.abnormalOutput, gateway) }}</pre>
            <p class="text-sm text-fg/85"><RichText :text="texts.steps[current.id]!.abnormal" /></p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="btn border-ok/50 text-ok hover:border-ok hover:bg-ok-soft hover:text-ok" @click="answer(true)">
            {{ t('troublePage.ok') }}
          </button>
          <button class="btn border-err/50 text-err hover:border-err hover:bg-err-soft hover:text-err" @click="answer(false)">
            {{ t('troublePage.fail') }}
          </button>
          <button v-if="answers.length" class="btn ml-auto" @click="back">
            <ChevronLeft class="size-4" /> {{ t('troublePage.back') }}
          </button>
        </div>
      </section>

      <!-- Diagnosis -->
      <section v-else key="result" class="anim-slide space-y-4">
        <StatusBanner :variant="diagnosisId === 'ok' ? 'ok' : 'err'" :title="diagnosis.title">
          <template v-if="failedIndex >= 0">
            {{ t('troublePage.stoppedAt', { step: texts.steps[diagnosisId]!.question }) }}
          </template>
        </StatusBanner>
        <div class="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <div class="card p-4">
            <h3 class="mb-2 font-semibold">{{ t('troublePage.causes') }}</h3>
            <ul class="flex flex-wrap gap-2 text-sm">
              <li v-for="cause in diagnosis.causes" :key="cause" class="rounded-md border border-line bg-surface-2 px-2.5 py-1">
                <RichText :text="cause" />
              </li>
            </ul>
          </div>
          <div class="card p-4">
            <h3 class="mb-2 font-semibold">{{ t('troublePage.next') }}</h3>
            <ul class="list-disc space-y-1.5 pl-5 text-sm">
              <li v-for="item in diagnosis.next" :key="item"><RichText :text="item" /></li>
            </ul>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn" @click="back"><ChevronLeft class="size-4" /> {{ t('troublePage.back') }}</button>
          <button class="btn btn-primary" @click="restart"><RotateCcw class="size-4" /> {{ t('troublePage.restart') }}</button>
        </div>
      </section>
  </div>
</template>

