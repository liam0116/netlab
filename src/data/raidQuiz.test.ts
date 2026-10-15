import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import zhTW from '@/i18n/locales/zh-TW'
import { raidQuiz } from './raidQuiz'

const i18n = createI18n({ legacy: false, locale: 'zh-TW', messages: { 'zh-TW': zhTW } })
const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params ?? {})

describe('RAID quiz', () => {
  it('always has 4 different options, one of them correct, and no missing text', () => {
    for (let run = 0; run < 200; run++) {
      for (const factory of raidQuiz) {
        const q = factory(t)
        expect(q.options).toHaveLength(4)
        expect(new Set(q.options).size).toBe(4)
        expect(q.answer).toBeGreaterThanOrEqual(0)
        // An unresolved key would show up as "raidPage.…" or "quizStatic.…".
        for (const s of [q.prompt, q.explanation, ...q.options]) expect(s).not.toMatch(/raidPage\.|quizStatic\./)
      }
    }
  })
})
