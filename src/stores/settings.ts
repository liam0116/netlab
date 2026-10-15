import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { detectLocale, i18n, isAppLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'

export type Theme = 'dark' | 'light'
export type WorkMode = 'learning' | 'engineer'

const THEME_KEY = 'netlab.theme'
const MODE_KEY = 'netlab.mode'
const LOCALE_KEY = 'netlab.locale'

function readStorage<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value as T) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

function initialLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (isAppLocale(stored)) return stored
  } catch {
    // fall through to browser detection
  }
  return detectLocale(typeof navigator === 'undefined' ? [] : navigator.languages)
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable (private mode); preference just won't persist
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<Theme>(readStorage(THEME_KEY, ['dark', 'light'] as const, 'dark'))
  const mode = ref<WorkMode>(readStorage(MODE_KEY, ['learning', 'engineer'] as const, 'learning'))
  /** Presentation mode: hides navigation and learning hints for showing pages to a customer. */
  const presentation = ref(false)

  watch(
    theme,
    (value) => {
      document.documentElement.classList.toggle('dark', value === 'dark')
      writeStorage(THEME_KEY, value)
    },
    { immediate: true },
  )
  watch(mode, (value) => writeStorage(MODE_KEY, value))

  const locale = ref<AppLocale>(initialLocale())
  watch(
    locale,
    (value) => {
      i18n.global.locale.value = value
      document.documentElement.lang = value
      writeStorage(LOCALE_KEY, value)
    },
    { immediate: true },
  )

  function setLocale(value: AppLocale): void {
    if (SUPPORTED_LOCALES.some((l) => l.code === value)) locale.value = value
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function togglePresentation(): void {
    presentation.value = !presentation.value
  }

  function setMode(value: WorkMode): void {
    mode.value = value
  }

  return { theme, mode, locale, presentation, toggleTheme, togglePresentation, setMode, setLocale }
})
