import { computed } from 'vue'
import { chapterDefs } from '@/data/tutorials'
import { tutorialContent } from '@/i18n/content'
import { DEFAULT_LOCALE, type AppLocale } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import type { TutorialChapter } from '@/types/tutorial'

/** Merges chapter structure (visuals, quizzes) with text for the given locale. */
export function buildChapters(locale: AppLocale): TutorialChapter[] {
  const texts = tutorialContent[locale]
  const fallback = tutorialContent[DEFAULT_LOCALE]
  return chapterDefs.map((def) => {
    const text = texts[def.id] ?? fallback[def.id]
    if (!text) throw new Error(`Missing tutorial text for chapter "${def.id}"`)
    return {
      id: def.id,
      number: def.number,
      phase: def.phase,
      title: text.title,
      summary: text.summary,
      steps: text.steps.map((step, i) => ({ ...step, visual: def.visuals[i] })),
      quiz: def.quiz,
    }
  })
}

export function useTutorials() {
  const settings = useSettingsStore()
  const chapters = computed(() => buildChapters(settings.locale))
  const findChapter = (id: string) => chapters.value.find((c) => c.id === id)
  return { chapters, findChapter }
}
