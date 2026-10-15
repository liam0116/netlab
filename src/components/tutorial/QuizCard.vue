<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck, CircleX, RotateCcw } from 'lucide-vue-next'
import type { QuizFactory, QuizQuestion } from '@/types/tutorial'

const props = defineProps<{ factories: QuizFactory[] }>()
const emit = defineEmits<{ passed: [] }>()
const { t, locale } = useI18n()

const index = ref(0)
const correctCount = ref(0)
const selected = ref<number | null>(null)
const finished = ref(false)

function generate(i: number): QuizQuestion {
  const factory = props.factories[i]
  if (!factory) throw new Error(`No quiz factory at ${i}`)
  return factory((key, params) => t(key, params ?? {}))
}

const question = ref<QuizQuestion>(generate(0))
// Switching language regenerates the current question in the new language.
watch(locale, () => {
  selected.value = null
  question.value = generate(index.value)
})

const answered = computed(() => selected.value !== null)
const isCorrect = computed(() => selected.value === question.value.answer)

function choose(option: number): void {
  if (answered.value) return
  selected.value = option
  if (option === question.value.answer) correctCount.value++
}

function next(): void {
  if (index.value >= props.factories.length - 1) {
    finished.value = true
    if (correctCount.value === props.factories.length) emit('passed')
    return
  }
  index.value++
  selected.value = null
  question.value = generate(index.value)
}

function restart(): void {
  index.value = 0
  correctCount.value = 0
  selected.value = null
  finished.value = false
  question.value = generate(0)
}

function optionClass(i: number): string {
  if (!answered.value) return 'border-line hover:border-accent hover:text-accent'
  if (i === question.value.answer) return 'border-ok bg-ok-soft text-ok'
  if (i === selected.value) return 'border-err bg-err-soft text-err'
  return 'border-line opacity-50'
}
</script>

<template>
  <div class="card p-4">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="font-semibold">{{ t('quiz.title') }}</h3>
      <span class="font-mono text-xs text-muted">
        {{ finished ? t('quiz.done') : `Q${index + 1} / ${factories.length}` }} · ✓ {{ correctCount }}
      </span>
    </div>

    <div v-if="finished" class="space-y-3 text-center">
      <div class="text-3xl font-bold" :class="correctCount === factories.length ? 'text-ok' : 'text-warn'">
        {{ correctCount }} / {{ factories.length }}
      </div>
      <p class="text-sm text-muted">
        {{ correctCount === factories.length ? t('quiz.allCorrect') : t('quiz.tryAgain') }}
      </p>
      <button class="btn" @click="restart"><RotateCcw class="size-4" /> {{ t('quiz.retry') }}</button>
    </div>

    <template v-else>
      <p class="mb-3 font-mono text-sm whitespace-pre-line">{{ question.prompt }}</p>
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          v-for="(opt, i) in question.options"
          :key="`${index}-${i}`"
          class="rounded-md border px-3 py-2 text-left font-mono text-sm transition-colors"
          :class="optionClass(i)"
          :disabled="answered"
          @click="choose(i)"
        >
          {{ opt }}
        </button>
      </div>
      <Transition name="fade">
        <div v-if="answered" class="mt-3 flex flex-wrap items-start gap-3">
          <div class="flex flex-1 gap-2 text-sm">
            <CircleCheck v-if="isCorrect" class="size-5 shrink-0 text-ok" />
            <CircleX v-else class="size-5 shrink-0 text-err" />
            <span>{{ question.explanation }}</span>
          </div>
          <button class="btn btn-primary" @click="next">
            {{ index >= factories.length - 1 ? t('quiz.seeResult') : t('quiz.nextQuestion') }}
          </button>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.fade-enter-active {
  transition: opacity 0.2s;
}
.fade-enter-from {
  opacity: 0;
}
</style>
