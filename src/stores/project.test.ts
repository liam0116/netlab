import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useProjectStore } from './project'
import { useProjectPlanStore, useToolPlannerStore } from './planner'

// Tests run in Node: give the stores an in-memory localStorage so persistence is exercised too.
const memory = new Map<string, string>()
const memoryStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
}
vi.stubGlobal('localStorage', memoryStorage)

beforeEach(() => {
  memory.clear()
  setActivePinia(createPinia())
})

describe('project store', () => {
  it('loads the demo into every store and snapshots it back', () => {
    const p = useProjectStore()
    p.loadDemo('en')
    expect(p.racks).toHaveLength(1)
    expect(useProjectPlanStore().project).toBe('vSphere platform')
    expect(p.cableIssues).toEqual([])
    const snap = p.snapshot()
    p.newProject()
    expect(p.racks).toHaveLength(0)
    p.load(snap)
    expect(p.snapshot()).toEqual(snap)
  })

  it('browser library: save, open, track unsaved changes, update the opened entry even after a rename', async () => {
    const p = useProjectStore()
    p.newProject()
    expect(p.unsaved).toBe(false)
    p.meta.customer = 'Customer A'
    p.meta.project = 'Project 1'
    expect(p.unsaved).toBe(true)
    expect(p.openLibraryId).toBeNull()

    expect(p.saveToLibrary()).toEqual({ ok: true })
    expect(p.library).toHaveLength(1)
    const id = p.library[0]!.id
    expect(p.openLibraryId).toBe(id)
    expect(p.unsaved).toBe(false)

    p.addRack()
    expect(p.unsaved).toBe(true)
    p.meta.project = 'Project 1 (renamed)'
    p.saveToLibrary()
    expect(p.library).toHaveLength(1)
    expect(p.library[0]).toMatchObject({ id, name: 'Project 1 (renamed)' })
    expect(p.unsaved).toBe(false)

    p.loadDemo('en')
    expect(p.openLibraryId).toBeNull()
    expect(p.unsaved).toBe(true)
    p.saveToLibrary()
    expect(p.library).toHaveLength(2)

    expect(p.openFromLibrary(id)).toEqual({ ok: true })
    expect(p.meta.project).toBe('Project 1 (renamed)')
    expect(p.racks).toHaveLength(1)
    expect(p.openLibraryId).toBe(id)
    expect(p.unsaved).toBe(false)

    // Survives a page reload (stores persist in watchers, which run before the next render).
    await nextTick()
    setActivePinia(createPinia())
    const reloaded = useProjectStore()
    expect(reloaded.openLibraryId).toBe(id)
    expect(reloaded.unsaved).toBe(false)

    reloaded.removeFromLibrary(id)
    expect(reloaded.openLibraryId).toBeNull()
    expect(reloaded.unsaved).toBe(true)
  })

  it('Tools → IP Planner is separate from the project plan until it is applied', () => {
    const p = useProjectStore()
    p.loadDemo('en')
    const before = p.subnets.map((s) => `${s.network}/${s.cidr}`)
    const tool = useToolPlannerStore()
    tool.apply({ project: 'Scratch', options: { base: '192.168.0.0/16', strategy: 'vlsm', gateway: 'first', growthPercent: 0, reserveGateway: true }, requirements: [{ id: 'x', name: 'Test', vlan: 99, hosts: 10 }] })
    expect(p.subnets.map((s) => `${s.network}/${s.cidr}`)).toEqual(before)
    // Loading another project does not touch the calculator either.
    p.newProject()
    expect(tool.requirements.map((r) => r.name)).toEqual(['Test'])
    // Explicit apply copies the plan (not a shared reference).
    useProjectPlanStore().apply(tool.snapshot())
    expect(p.subnets.map((s) => s.name)).toEqual(['Test'])
    tool.requirements[0]!.name = 'Changed later'
    expect(p.subnets.map((s) => s.name)).toEqual(['Test'])
  })

  it('creates a 3 × 4 room of racks in one go, after the rows already in use', () => {
    const p = useProjectStore()
    p.loadDemo('en') // R01 in row A
    const created = p.addRackGrid({ rows: 3, cols: 4, heightU: 42, pduCapacityW: 8000, voltage: 230, maxWeightKg: 1500 }, (row, col) => `Row ${row}, rack ${col}`)
    expect(created).toHaveLength(12)
    expect(created.map((r) => r.name)).toEqual(['B01', 'B02', 'B03', 'B04', 'C01', 'C02', 'C03', 'C04', 'D01', 'D02', 'D03', 'D04'])
    expect(created[0]).toMatchObject({ location: 'Row B, rack 1', row: 1, col: 1, pduCapacityW: 8000, maxWeightKg: 1500 })
    expect(p.racks).toHaveLength(13)
    // A single new rack goes next to the last one in the last row.
    expect(p.addRack()).toMatchObject({ row: 3, col: 5 })
    // Positions survive the project file.
    const file = p.exportFile()
    p.newProject()
    expect(p.addRack()).toMatchObject({ row: 0, col: 1 })
    p.importFile(file)
    expect(p.racks.find((r) => r.name === 'C03')).toMatchObject({ row: 2, col: 3 })
  })

  it('exports and imports a file; rejects garbage', () => {
    const p = useProjectStore()
    p.loadDemo('zh-TW')
    const file = p.exportFile()
    p.newProject()
    expect(p.importFile(file)).toBeNull()
    expect(p.meta.project).toBe('vSphere 虛擬化平台建置')
    expect(p.importFile('{"app":"x"}')).toBe('not-netlab')
  })

  it('places devices at the lowest free U and cascades deletes', () => {
    const p = useProjectStore()
    const rack = p.addRack()
    const a = p.addItem(rack.id, 'server-2u')!
    const b = p.addItem(rack.id, 'switch-25g')!
    expect([a.uPosition, b.uPosition]).toEqual([1, 3])
    p.addCable({ aItemId: a.id, aPort: 'ens1f0', bItemId: b.id, bPort: 'Eth1/1' })
    expect(p.cables[0]!.label).toBe('C-001')
    p.removeItem(b.id)
    expect(p.cables).toHaveLength(0)
    p.removeRack(rack.id)
    expect(p.rackItems).toHaveLength(0)
  })

  it('edits ports: rename follows into cables and addresses, delete removes the cable', () => {
    const p = useProjectStore()
    p.newProject()
    const rack = p.addRack()
    const srv = p.addItem(rack.id, 'server-1u')!
    const sw = p.addItem(rack.id, 'switch-25g')!
    p.addCable({ aItemId: srv.id, aPort: 'ens1f0', bItemId: sw.id, bPort: 'Eth1/1' })
    p.addAddress(srv.id, 'storage')
    const addr = p.rackItems.find((i) => i.id === srv.id)!.addresses[0]!
    p.updateAddress(srv.id, addr.id, { iface: 'ens1f0', address: '10.10.30.11' })

    p.addPort(srv.id)
    expect(p.rackItems.find((i) => i.id === srv.id)!.ports.map((x) => x.name)).toEqual(['BMC', 'ens1f0', 'ens1f1', 'ens1f2'])

    p.updatePort(srv.id, 1, { name: 'eno1', mac: 'aa:bb:cc:dd:ee:01' })
    expect(p.cables[0]!.aPort).toBe('eno1')
    expect(p.rackItems.find((i) => i.id === srv.id)!.addresses[0]!.iface).toBe('eno1')
    expect(p.cableIssues).toEqual([])

    p.removePort(srv.id, 1)
    expect(p.cables).toHaveLength(0)
    p.removeAddress(srv.id, addr.id)
    expect(p.rackItems.find((i) => i.id === srv.id)!.addresses).toEqual([])
  })
})
