import { describe, expect, it } from 'vitest'
import { ARCHITECTURES, bom, defaultOptions, nodeLimits, planArchitecture, validOptions, type ArchitectureKind, type PlanInput } from './architecture'
import { checkRack, itemTop } from './rack'
import { gridRackName } from './floor'
import type { Rack, RackItem } from '@/types/project'

function input(existingRacks: Rack[] = [], existingItems: RackItem[] = [], row = 0): PlanInput {
  let n = 0
  return { existingRacks, existingItems, row, newId: (p) => `${p}-${++n}`, location: (r, c) => `Row ${r} / ${c}`, rackName: gridRackName }
}

const names = (items: RackItem[], rack: Rack) =>
  items
    .filter((i) => i.rackId === rack.id)
    .sort((a, b) => b.uPosition - a.uPosition)
    .map((i) => `${i.uPosition}:${i.name}`)

describe('architecture templates', () => {
  it('three-tier: ToR + FC fabric on top, SAN array and shelf at the bottom, hosts with FC HBAs in between', () => {
    const r = planArchitecture('three-tier', defaultOptions('three-tier'), input())
    expect(r.ok).toBe(true)
    expect(r.racks.map((x) => x.name)).toEqual(['A01'])
    expect(names(r.items, r.racks[0]!)).toEqual([
      '42:patch01',
      '41:oob-sw01',
      '40:leaf01',
      '39:leaf02',
      '38:fc-sw01',
      '37:fc-sw02',
      '8:esx04',
      '7:esx03',
      '6:esx02',
      '5:esx01',
      '3:shelf01',
      '1:san01',
    ])
    const host = r.items.find((i) => i.name === 'esx01')!
    expect(host.ports.map((p) => p.name)).toContain('hba0')
    expect(bom(r.items, r.roles).map((l) => `${l.role}×${l.count}`)).toEqual(['compute×4', 'array×1', 'shelf×1', 'tor×2', 'fc×2', 'oob×1', 'patch×1'])
  })

  it('HCI: only nodes and Ethernet, no external storage or FC', () => {
    const r = planArchitecture('hci', defaultOptions('hci'), input())
    const roles = bom(r.items, r.roles).map((l) => `${l.role}×${l.count}`)
    expect(roles).toEqual(['hci×4', 'tor×2', 'oob×1', 'patch×1'])
    expect(r.items.find((i) => i.name === 'hci01')!.uPosition).toBe(1)
  })

  it('dHCI: compute nodes without FC plus an iSCSI array', () => {
    const r = planArchitecture('dhci', defaultOptions('dhci'), input())
    expect(bom(r.items, r.roles).map((l) => `${l.role}×${l.count}`)).toEqual(['compute×3', 'array×1', 'shelf×1', 'tor×2', 'oob×1', 'patch×1'])
    expect(r.items.find((i) => i.name === 'cmp01')!.ports.some((p) => p.name.startsWith('hba'))).toBe(false)
  })

  it('two-node: exactly two HCI nodes', () => {
    const r = planArchitecture('two-node', defaultOptions('two-node'), input())
    expect(bom(r.items, r.roles).map((l) => `${l.role}×${l.count}`)).toEqual(['hci×2', 'tor×2', 'oob×1', 'patch×1'])
    expect(validOptions('two-node', { ...defaultOptions('two-node'), nodes: 3 })).toBe(false)
  })

  it('Ceph: storage nodes on 100G switches', () => {
    const r = planArchitecture('ceph', defaultOptions('ceph'), input())
    expect(bom(r.items, r.roles).map((l) => `${l.role}×${l.count}`)).toEqual(['storage-node×4', 'tor×2', 'oob×1', 'patch×1'])
    expect(r.items.find((i) => i.name === 'leaf01')!.model).toContain('100G')
    expect(validOptions('ceph', { ...defaultOptions('ceph'), nodes: 2 })).toBe(false)
  })

  it('AI: GPU servers at the bottom, InfiniBand fabric on top, one GPU server per rack at 22 kW', () => {
    const r = planArchitecture('ai', defaultOptions('ai'), input())
    expect(r.ok).toBe(true)
    expect(bom(r.items, r.roles).map((l) => `${l.role}×${l.count}`)).toEqual(['gpu×2', 'storage-node×2', 'tor×4', 'fabric×2', 'oob×2', 'patch×2'])
    expect(r.racks).toHaveLength(2)
    expect(r.items.find((i) => i.name === 'gpu01')).toMatchObject({ uPosition: 1, rackId: r.racks[0]!.id })
    expect(r.items.find((i) => i.name === 'gpu02')).toMatchObject({ uPosition: 1, rackId: r.racks[1]!.id })
    // The default 7 kW PDU cannot carry a 10 kW GPU server at all.
    expect(planArchitecture('ai', { ...defaultOptions('ai'), pduCapacityW: 7000 }, input()).error).toBe('node-too-big')
  })

  it('validates counts per architecture', () => {
    for (const kind of ARCHITECTURES) {
      expect(validOptions(kind, defaultOptions(kind)), kind).toBe(true)
      expect(validOptions(kind, { ...defaultOptions(kind), nodes: nodeLimits(kind).min - 1 }), kind).toBe(false)
    }
    expect(validOptions('three-tier', { ...defaultOptions('three-tier'), storage: 7 })).toBe(false)
    // Rack settings: no 0U racks, 0 W PDUs, 0 V feeds or 0 kg limits, and no fractional U.
    for (const bad of [{ heightU: 0 }, { heightU: -1 }, { heightU: 42.5 }, { heightU: 61 }, { pduCapacityW: 0 }, { voltage: 0 }, { maxWeightKg: 0 }, { nodes: Number.NaN }]) {
      expect(validOptions('hci', { ...defaultOptions('hci'), ...bad }), JSON.stringify(bad)).toBe(false)
    }
    expect(validOptions('hci', { ...defaultOptions('hci'), storage: 99 })).toBe(true) // HCI has no second quantity
  })

  for (const kind of ARCHITECTURES) {
    it(`${kind}: every generated rack passes the rack checks`, () => {
      const r = planArchitecture(kind, { ...defaultOptions(kind), nodes: Math.min(24, nodeLimits(kind).max) }, input())
      expect(r.ok).toBe(true)
      for (const rack of r.racks) {
        expect(checkRack(rack, r.items), rack.name).toEqual([])
        for (const it of r.items.filter((i) => i.rackId === rack.id)) expect(itemTop(it)).toBeLessThanOrEqual(rack.heightU)
      }
    })
  }

  it('opens the next rack when one PDU feed could not carry the load, with its own ToR switches', () => {
    const r = planArchitecture('hci', { ...defaultOptions('hci'), nodes: 12 }, input())
    // 7000 W per feed: switches ~0.8 kW, so 6 nodes × 900 W per rack.
    expect(r.racks.map((x) => x.name)).toEqual(['A01', 'A02'])
    expect(r.racks.map((x) => x.col)).toEqual([1, 2])
    const inRack = (rack: Rack) => r.items.filter((i) => i.rackId === rack.id)
    expect(inRack(r.racks[0]!).filter((i) => i.name.startsWith('hci'))).toHaveLength(6)
    expect(inRack(r.racks[1]!).map((i) => i.name)).toEqual(expect.arrayContaining(['leaf03', 'leaf04', 'oob-sw02', 'hci07', 'hci12']))
    // FC switches only exist in three-tier.
    expect(r.items.some((i) => i.name.startsWith('fc-sw'))).toBe(false)
  })

  it('does not reuse names that are already in the project', () => {
    const existing = planArchitecture('hci', defaultOptions('hci'), input())
    const r = planArchitecture('hci', defaultOptions('hci'), input(existing.racks, existing.items, 1))
    expect(r.racks[0]!.name).toBe('B01')
    expect(r.items.map((i) => i.name)).toEqual(expect.arrayContaining(['hci05', 'leaf03', 'patch02']))
    const all = [...existing.items, ...r.items].map((i) => i.name)
    expect(new Set(all).size).toBe(all.length)
  })

  it('reports a device that cannot fit even an empty rack', () => {
    const kinds: ArchitectureKind[] = ['three-tier', 'hci']
    for (const kind of kinds) {
      const r = planArchitecture(kind, { ...defaultOptions(kind), pduCapacityW: 1000 }, input())
      expect(r).toMatchObject({ ok: false, error: 'node-too-big', racks: [], items: [] })
    }
  })
})
