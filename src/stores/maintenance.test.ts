import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useMaintenanceStore } from './maintenance'
import { useProjectStore } from './project'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
})

beforeEach(() => {
  memory.clear()
  setActivePinia(createPinia())
})

const line = (id: string, kind: 'move' | 'remove', fromHost: string) =>
  ({ id, kind, part: 'dimm', fromHost, fromSlots: 'A1', toHost: kind === 'move' ? 'esx09' : '', toSlots: kind === 'move' ? 'A1' : '', spec: '', serial: '', done: false, notes: '' }) as const

describe('maintenance store', () => {
  it('edits work orders apart from the project: add, reorder, remove, persist', async () => {
    const m = useMaintenanceStore()
    const p = useProjectStore()
    const job = m.addJob('DIMM')
    job.customer = 'ACME'
    m.addPartOp(job.id, (id) => line(id, 'move', 'esx01'))
    m.addPartOp(job.id, (id) => line(id, 'remove', 'esx02'))
    m.movePartOp(job.id, 1, -1)
    expect(m.jobs[0]!.ops.map((o) => o.kind)).toEqual(['remove', 'move'])
    m.movePartOp(job.id, 1, 1) // already last: no change
    expect(m.knownHosts()).toEqual(['esx01', 'esx02', 'esx09'])
    // A new order for the same customer keeps the customer.
    expect(m.addJob('Next', job).customer).toBe('ACME')
    // Clearing the project leaves work orders alone.
    p.newProject()
    expect(p.unsaved).toBe(false)
    expect(m.jobs).toHaveLength(2)
    await nextTick()
    expect(JSON.parse(memory.get('netlab.maintenance')!)).toHaveLength(2)
    expect(memory.get('netlab.project') ?? '').not.toContain('maintenance')
    m.removePartOp(job.id, m.jobs[0]!.ops[0]!.id)
    m.removeJob(job.id)
    expect(m.jobs.map((j) => j.title)).toEqual(['Next'])
  })

  it('moves v1.3.0 work orders out of the saved project once', () => {
    memory.set('netlab.project', JSON.stringify({ meta: {}, maintenance: [{ id: 'job1', title: 'Old', ops: [] }] }))
    expect(useMaintenanceStore().jobs.map((j) => j.title)).toEqual(['Old'])
    expect(JSON.parse(memory.get('netlab.maintenance')!)).toHaveLength(1)
    // From now on its own storage wins, even if the project still had the old field.
    memory.set('netlab.maintenance', '[]')
    setActivePinia(createPinia())
    expect(useMaintenanceStore().jobs).toEqual([])
  })

  it('imports with fresh ids, exports, and adds the sample', () => {
    const m = useMaintenanceStore()
    const sample = m.addSample('zh-TW')
    const file = m.exportJobs([sample.id])
    const r = m.importFile(file)
    expect(r.ok).toBe(true)
    expect(m.jobs).toHaveLength(2)
    expect(m.jobs[1]!.id).not.toBe(sample.id)
    expect(m.jobs[1]!.ops.map((o) => o.fromHost)).toEqual(sample.ops.map((o) => o.fromHost))
    expect(m.importFile('{"app":"x"}')).toEqual({ ok: false, error: 'not-netlab' })
  })
})
