import { describe, expect, it } from 'vitest'
import { powerFigures, requiredGbps, splitDuration, storageCapacity, toBytes, transferSeconds, upsFits, upsRuntimeMinutes } from './calculators'

describe('transfer time', () => {
  it('50 TB over 25 Gbps at 100 % takes 4.44 hours', () => {
    expect(transferSeconds(toBytes(50, 'TB'), 25, 1)).toBeCloseTo(16000)
    expect(splitDuration(16000)).toEqual({ days: 0, hours: 4, minutes: 26, seconds: 40 })
  })

  it('efficiency slows it down; required bandwidth is the inverse', () => {
    const s = transferSeconds(toBytes(1, 'TiB'), 10, 0.7)!
    expect(s).toBeCloseTo((2 ** 40 * 8) / 7e9)
    expect(requiredGbps(toBytes(1, 'TiB'), s, 0.7)).toBeCloseTo(10)
    expect(transferSeconds(1, 0, 1)).toBeNull()
    expect(transferSeconds(1, 10, 1.5)).toBeNull()
  })

  it('splits long durations into days', () => {
    expect(splitDuration(90061)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 })
  })
})

describe('storage capacity', () => {
  it('RAID levels', () => {
    expect(storageCapacity({ scheme: 'raid5', disks: 8, diskTB: 4 })).toMatchObject({ valid: true, rawTB: 32, usableTB: 28, faultTolerance: 1, efficiency: 0.875 })
    expect(storageCapacity({ scheme: 'raid6', disks: 8, diskTB: 4 })).toMatchObject({ usableTB: 24, faultTolerance: 2 })
    expect(storageCapacity({ scheme: 'raid10', disks: 8, diskTB: 4 })).toMatchObject({ usableTB: 16, efficiency: 0.5 })
    expect(storageCapacity({ scheme: 'raid1', disks: 2, diskTB: 4 })).toMatchObject({ usableTB: 4, faultTolerance: 1 })
    expect(storageCapacity({ scheme: 'raid0', disks: 3, diskTB: 2 })).toMatchObject({ usableTB: 6, faultTolerance: 0 })
  })

  it('rejects too few or odd disks', () => {
    expect(storageCapacity({ scheme: 'raid6', disks: 3, diskTB: 4 })).toMatchObject({ valid: false, reason: 'min-disks', minDisks: 4 })
    expect(storageCapacity({ scheme: 'raid10', disks: 5, diskTB: 4 })).toMatchObject({ valid: false, reason: 'even-disks' })
    expect(storageCapacity({ scheme: 'raid5', disks: 0, diskTB: 4 })).toMatchObject({ valid: false, reason: 'bad-params' })
  })

  it('replication and erasure coding', () => {
    expect(storageCapacity({ scheme: 'replica', disks: 12, diskTB: 8, replicas: 3 })).toMatchObject({ usableTB: 32, faultTolerance: 2 })
    expect(storageCapacity({ scheme: 'ec', disks: 12, diskTB: 8, k: 4, m: 2 })).toMatchObject({ usableTB: 64, faultTolerance: 2, minDisks: 6 })
    expect(storageCapacity({ scheme: 'ec', disks: 5, diskTB: 8, k: 4, m: 2 }).valid).toBe(false)
  })

  it('reports TiB as well (a "4 TB" drive is 3.64 TiB)', () => {
    expect(storageCapacity({ scheme: 'raid0', disks: 1, diskTB: 4 }).usableTiB).toBeCloseTo(3.638, 2)
  })
})

describe('power', () => {
  it('amps, VA and heat', () => {
    expect(powerFigures(2200, 220, 1)).toEqual({ amps: 10, va: 2200, btuPerHour: 2200 * 3.412, kwhPerDay: 52.8 })
    expect(powerFigures(2000, 220, 0.8)!.va).toBe(2500)
    expect(powerFigures(1, 0, 1)).toBeNull()
  })

  it('UPS runtime and sizing', () => {
    expect(upsRuntimeMinutes(1000, 1000, 0.9)).toBeCloseTo(54)
    expect(upsRuntimeMinutes(0, 1000)).toBeNull()
    expect(upsFits(2500, 2800, 3000, 2700)).toBe(true)
    expect(upsFits(2800, 3000, 3000, 2700)).toBe(false)
  })
})

describe('svg export tokens', () => {
  it('replaces CSS variables with the print palette and leaves unknown ones', async () => {
    const { resolveTokens, PRINT_TOKENS } = await import('./svgExport')
    expect(resolveTokens('fill: var(--surface); stroke: var(--net)')).toBe(`fill: ${PRINT_TOKENS.surface}; stroke: ${PRINT_TOKENS.net}`)
    expect(resolveTokens('var(--unknown)')).toBe('var(--unknown)')
  })
})
