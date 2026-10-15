import { describe, expect, it } from 'vitest'
import zhTW from './locales/zh-TW'
import en from './locales/en'

/** Every literal raidPage.* key used by the RAID components must exist in both languages. */
const sources = import.meta.glob<string>(['../components/learn/*.vue', '../views/RaidView.vue', '../views/DeviceGuideView.vue'], { query: '?raw', import: 'default', eager: true })
const keys = new Set(Object.values(sources).flatMap((src) => [...src.matchAll(/t\('((?:raidPage|devicePage)\.[\w.]+)'/g)].map((m) => m[1]!)))
const lookup = (messages: unknown, key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages)

describe('RAID / device guide translation keys', () => {
  it('finds the keys used in the components', () => expect(keys.size).toBeGreaterThan(40))
  for (const [name, messages] of [['zh-TW', zhTW], ['en', en]] as const) {
    it(`${name}: every key exists`, () => {
      const missing = [...keys].filter((k) => typeof lookup(messages, k) !== 'string')
      expect(missing).toEqual([])
    })
  }
})
