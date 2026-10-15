import { createI18n } from 'vue-i18n'
import zhTW, { type MessageSchema } from './locales/zh-TW'
import en from './locales/en'

export const SUPPORTED_LOCALES = [
  { code: 'zh-TW', label: '繁體中文', short: '繁中' },
  { code: 'en', label: 'English', short: 'EN' },
] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]['code']

export const DEFAULT_LOCALE: AppLocale = 'zh-TW'

export function isAppLocale(value: unknown): value is AppLocale {
  return SUPPORTED_LOCALES.some((l) => l.code === value)
}

/** Picks a starting locale from the browser: any Chinese → 繁中, otherwise English. */
export function detectLocale(languages: readonly string[]): AppLocale {
  for (const lang of languages) {
    const lower = lang.toLowerCase()
    if (lower.startsWith('zh')) return 'zh-TW'
    if (lower.startsWith('en')) return 'en'
  }
  return DEFAULT_LOCALE
}

/** Locale-agnostic translate function, so pure modules (quiz generators) can produce text. */
export type Translate = (key: string, params?: Record<string, unknown>) => string

export const i18n = createI18n<[MessageSchema], AppLocale, false>({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { 'zh-TW': zhTW, en },
})

export const translate: Translate = (key, params) => i18n.global.t(key, params ?? {})
