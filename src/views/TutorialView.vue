<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, BookOpen, CircleCheck, Lock } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import StepControls from '@/components/common/StepControls.vue'
import RichText from '@/components/common/RichText.vue'
import TutorialVisual from '@/components/tutorial/TutorialVisual.vue'
import QuizCard from '@/components/tutorial/QuizCard.vue'
import { useTutorials } from '@/composables/useTutorials'
import { useStepPlayer } from '@/composables/useStepPlayer'
import { useProgressStore } from '@/stores/progress'

const route = useRoute()
const progress = useProgressStore()
const { t } = useI18n()
const { chapters, findChapter } = useTutorials()

const chapterId = computed(() => (typeof route.params.chapter === 'string' ? route.params.chapter : ''))
const chapter = computed(() => findChapter(chapterId.value))
const steps = computed(() => chapter.value?.steps ?? [])
const step = computed(() => steps.value[player.current.value])
const isLastStep = computed(() => player.current.value >= steps.value.length - 1)

const player = useStepPlayer(computed(() => steps.value.length), 3500)

const available = computed(() => chapters.value.filter((c) => c.steps.length > 0))
const neighbours = computed(() => {
  const i = available.value.findIndex((c) => c.id === chapterId.value)
  return { prev: available.value[i - 1], next: available.value[i + 1] }
})

function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (event.key === 'ArrowRight') player.next()
  if (event.key === 'ArrowLeft') player.prev()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- Chapter index -->
  <div v-if="!chapterId" class="space-y-6">
    <PageHeader
      :title="t('tutorial.title')"
      :description="t('tutorial.desc')"
      :icon="BookOpen"
    />
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <template v-for="c in chapters" :key="c.id">
        <RouterLink
          v-if="c.steps.length"
          :to="`/learn/${c.id}`"
          class="card group flex gap-3 p-4 transition-colors hover:border-accent"
        >
          <span class="font-mono text-sm text-accent">{{ String(c.number).padStart(2, '0') }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 font-medium">
              {{ c.title }}
              <CircleCheck v-if="progress.isComplete(c.id)" class="size-4 text-ok" />
            </div>
            <p class="mt-0.5 text-sm text-muted">{{ c.summary }}</p>
            <p class="mt-2 font-mono text-xs text-muted">{{ t('tutorial.stepsCount', { steps: c.steps.length, quiz: c.quiz.length }) }}</p>
          </div>
        </RouterLink>
        <div v-else class="card flex gap-3 p-4 opacity-50">
          <span class="font-mono text-sm text-muted">{{ String(c.number).padStart(2, '0') }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 font-medium">
              {{ c.title }} <Lock class="size-3.5 text-muted" />
              <span class="rounded border border-line px-1 font-mono text-[10px] text-muted">{{ t('common.phaseBadge', { phase: c.phase }) }}</span>
            </div>
            <p class="mt-0.5 text-sm text-muted">{{ c.summary }}</p>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Unknown or locked chapter -->
  <div v-else-if="!chapter || !step" class="py-20 text-center">
    <p class="text-muted">
      {{ chapter ? t('tutorial.lockedChapter', { title: chapter.title, phase: chapter.phase }) : t('tutorial.unknownChapter') }}
    </p>
    <RouterLink to="/learn" class="btn mt-4">{{ t('tutorial.backToList') }}</RouterLink>
  </div>

  <!-- Chapter -->
  <div v-else class="space-y-6">
    <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
      <RouterLink to="/learn" class="hover:text-accent">Learn</RouterLink>
      <span>/</span>
      <span class="font-mono text-accent">{{ String(chapter.number).padStart(2, '0') }}</span>
      <span class="text-fg">{{ chapter.title }}</span>
      <CircleCheck v-if="progress.isComplete(chapter.id)" class="size-4 text-ok" />
    </div>

    <section class="card overflow-hidden">
      <div class="border-b border-line p-4">
        <StepControls
          :current="player.current.value"
          :total="steps.length"
          :playing="player.playing.value"
          can-play
          @prev="player.prev"
          @next="player.next"
          @toggle="player.toggle"
          @reset="player.reset"
        />
      </div>

      <div :key="`${chapter.id}-${player.current.value}`" class="anim-slide grid gap-6 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:p-6">
          <div class="space-y-3">
            <h2 class="text-lg font-semibold">
              <span class="mr-1 font-mono text-sm text-muted">{{ player.current.value + 1 }}.</span>
              {{ step.title }}
            </h2>
            <p v-for="(paragraph, i) in step.body" :key="i" class="text-sm leading-relaxed text-fg/85">
              <RichText :text="paragraph" />
            </p>
            <div v-if="step.example" class="rounded-md border-l-2 border-accent bg-accent-soft/40 px-3 py-2 text-sm">
              <span class="font-medium text-accent">{{ t('tutorial.example') }}</span>
              <RichText :text="step.example" />
            </div>
          </div>
          <div class="flex min-h-48 items-center justify-center">
            <div class="w-full">
              <TutorialVisual v-if="step.visual" :visual="step.visual" />
            </div>
          </div>
      </div>
      <p class="border-t border-line px-4 py-2 text-xs text-muted">
        <RichText :text="t('common.keyboardHint')" />
      </p>
    </section>

    <Transition name="step">
      <QuizCard
        v-if="isLastStep"
        :key="chapter.id"
        :factories="chapter.quiz"
        @passed="progress.markComplete(chapter.id)"
      />
    </Transition>
    <p v-if="!isLastStep" class="text-center text-sm text-muted">{{ t('tutorial.quizAfter') }}</p>

    <div class="flex justify-between gap-3">
      <RouterLink v-if="neighbours.prev" :to="`/learn/${neighbours.prev.id}`" class="btn">
        ← {{ neighbours.prev.title }}
      </RouterLink>
      <span v-else />
      <RouterLink v-if="neighbours.next" :to="`/learn/${neighbours.next.id}`" class="btn">
        {{ neighbours.next.title }} <ArrowRight class="size-4" />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.step-enter-active,
.step-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.step-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.step-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
