import { describe, expect, it } from 'vitest'
import { checkRack, firstFreeU, occupancy, RACK_TEMPLATES, rackTotals } from './rack'
import type { Rack, RackItem } from '@/types/project'

const rack: Rack = { id: 'r1', name: 'R1', location: '', heightU: 42, pduCapacityW: 5000, voltage: 220, maxWeightKg: 1000, row: null, col: null }
let n = 0
function item(uPosition: number, uHeight: number, extra: Partial<RackItem> = {}): RackItem {
  n++
  return { id: `i${n}`, rackId: 'r1', name: `Dev ${n}`, model: '', type: 'server', uHeight, uPosition, powerW: 500, weightKg: 20, psus: 2, hostname: '', ip: '', mgmtIp: '', addresses: [], serial: '', assetTag: '', os: '', notes: '', ports: [], ...extra }
}

describe('placement', () => {
  it('finds the lowest free slot that fits', () => {
    const items = [item(1, 2), item(4, 1)]
    expect(firstFreeU(rack, items, 1)).toBe(3)
    expect(firstFreeU(rack, items, 2)).toBe(5)
    expect(firstFreeU({ ...rack, heightU: 3 }, [item(1, 3)], 1)).toBeNull()
  })

  it('maps occupancy only for this rack', () => {
    const occ = occupancy(rack, [item(10, 2), { ...item(10, 1), rackId: 'other' }])
    expect([...occ.keys()]).toEqual([10, 11])
  })
})

describe('totals', () => {
  it('splits dual-PSU load across feeds and computes failover', () => {
    const items = [item(1, 1, { powerW: 1000 }), item(2, 1, { powerW: 400, psus: 1 })]
    const t = rackTotals(rack, items)
    expect(t).toMatchObject({ powerW: 1400, feedA: 900, feedB: 500, failoverA: 1400, failoverB: 1000, usedU: 2, freeU: 40, weightKg: 40 })
    expect(t.amps).toBeCloseTo(1400 / 220)
    expect(t.btuPerHour).toBeCloseTo(1400 * 3.412)
  })
})

describe('checkRack', () => {
  it('a clean rack has no issues', () => {
    expect(checkRack(rack, [item(1, 2), item(3, 1)])).toEqual([])
  })

  it('flags overlap once per pair and out-of-bounds', () => {
    const a = item(10, 2)
    const b = item(11, 2)
    const c = item(42, 2)
    const issues = checkRack(rack, [a, b, c])
    expect(issues.filter((i) => i.code === 'overlap')).toHaveLength(1)
    expect(issues.find((i) => i.code === 'out-of-bounds')?.itemIds).toEqual([c.id])
  })

  it('power: feed overload is an error, failover overload a warning', () => {
    const big = [item(1, 8, { powerW: 10200, psus: 6 })]
    expect(checkRack(rack, big).map((i) => i.code)).toContain('feed-overload')
    const onlyFailover = [item(1, 2, { powerW: 3000 }), item(3, 2, { powerW: 3000 })]
    const codes = checkRack(rack, onlyFailover).map((i) => i.code)
    expect(codes).toEqual(['failover-overload'])
  })

  it('weight, single PSU and duplicate names', () => {
    const codes = checkRack({ ...rack, maxWeightKg: 30 }, [item(1, 1, { psus: 1, name: 'web' }), item(2, 1, { name: 'WEB' })]).map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['overweight', 'single-psu', 'duplicate-name']))
    // Blank panels and patch panels never warn about PSUs.
    expect(checkRack(rack, [item(1, 1, { type: 'blank', psus: 0, powerW: 0 })])).toEqual([])
  })
})

describe('templates', () => {
  it('are internally consistent', () => {
    for (const [key, t] of Object.entries(RACK_TEMPLATES)) {
      expect(t.uHeight, key).toBeGreaterThan(0)
      expect(new Set(t.ports.map((p) => p.name)).size, key).toBe(t.ports.length)
    }
    expect(RACK_TEMPLATES['switch-25g']!.ports).toHaveLength(56)
  })
})
