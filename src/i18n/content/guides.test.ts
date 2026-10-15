import { describe, expect, it } from 'vitest'
import { RACK_TEMPLATES } from '@/utils/rack'
import { RAID_LEVELS } from '@/utils/raid'
import { deviceGuide, raidContent } from './index'
import { DEVICE_GROUPS } from '@/data/deviceGroups'

describe('beginner guides', () => {
  for (const locale of ['zh-TW', 'en'] as const) {
    it(`${locale}: every rack template has a device explanation`, () => {
      expect(Object.keys(deviceGuide[locale].devices).sort()).toEqual(Object.keys(RACK_TEMPLATES).sort())
      for (const d of Object.values(deviceGuide[locale].devices)) {
        expect(d.what && d.use && d.placement && d.cabling).toBeTruthy()
      }
    })

    it(`${locale}: every RAID level is explained`, () => {
      expect(Object.keys(raidContent[locale].levels).map(Number).sort((a, b) => a - b)).toEqual(RAID_LEVELS)
      expect(raidContent[locale].places.length).toBeGreaterThanOrEqual(6)
    })
  }

  it('the device guide lists every template exactly once', () => {
    const ids = DEVICE_GROUPS.flatMap((g) => g.ids)
    expect(ids.slice().sort()).toEqual(Object.keys(RACK_TEMPLATES).sort())
  })

  it('both languages describe the same RAID places and choices', () => {
    expect(raidContent.en.places).toHaveLength(raidContent['zh-TW'].places.length)
    expect(raidContent.en.choose).toHaveLength(raidContent['zh-TW'].choose.length)
    expect(raidContent.en.workflow).toHaveLength(raidContent['zh-TW'].workflow.length)
  })
})
