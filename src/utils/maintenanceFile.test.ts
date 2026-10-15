import { describe, expect, it } from 'vitest'
import { demoMaintenanceJob } from '@/data/demoMaintenance'
import { analyzeJob } from './maintenance'
import { parseMaintenanceFile, serializeJobs } from './maintenanceFile'

describe('work-order file', () => {
  it('round-trips the sample, which passes every check', () => {
    for (const locale of ['zh-TW', 'en'] as const) {
      const job = demoMaintenanceJob(locale)
      expect(parseMaintenanceFile(serializeJobs([job]))).toEqual({ ok: true, jobs: [job] })
      const a = analyzeJob(job)
      expect(a.issues).toEqual([])
      expect(a.hosts.map((h) => [h.host, h.in - h.out, h.deltaGb])).toEqual([
        ['esx01', -2, -64],
        ['esx04', 4, 128],
        ['esx02', -2, -64],
        ['esx03', 0, 0],
      ])
    }
  })

  it('cleans up untrusted lines', () => {
    const file = JSON.parse(serializeJobs([demoMaintenanceJob('en')]))
    file.jobs[0].ops.push({ id: 'op9', kind: 'explode', part: 'laser', done: 'yes', fromSlots: 42 }, { kind: 'move' })
    file.jobs[0].date = 'tomorrow'
    delete file.jobs[0].customer
    Object.assign(file.jobs[0], { startTime: '09:30', endTime: '25:99', fieldNotes: 'ok', actual: { esx04: '16 / 512 GB', esx01: 12 } })
    const r = parseMaintenanceFile(JSON.stringify(file))
    if (!r.ok) throw new Error(r.error)
    expect([r.jobs[0]!.startTime, r.jobs[0]!.endTime, r.jobs[0]!.fieldNotes]).toEqual(['09:30', '', 'ok'])
    expect(r.jobs[0]!.actual).toEqual({ esx04: '16 / 512 GB' })
    expect(r.jobs[0]!.date).toBe('')
    expect(r.jobs[0]!.customer).toBe('')
    expect(r.jobs[0]!.ops).toHaveLength(4)
    expect(r.jobs[0]!.ops[3]).toEqual({ id: 'op9', kind: 'move', part: 'other', fromHost: '', fromSlots: '', toHost: '', toSlots: '', spec: '', serial: '', done: false, notes: '' })
  })

  it('reads work orders out of a v1.3.0 project file, and rejects other files', () => {
    const job = demoMaintenanceJob('en')
    // v1.3.0 orders had no on-site record fields.
    const { startTime: _s, endTime: _e, fieldNotes: _f, actual: _a, ...old } = job
    const project = JSON.stringify({ app: 'netlab', formatVersion: 1, meta: {}, maintenance: [old] })
    expect(parseMaintenanceFile(project)).toEqual({ ok: true, jobs: [job] })
    expect(parseMaintenanceFile(JSON.stringify({ app: 'netlab', formatVersion: 1, racks: [] }))).toEqual({ ok: false, error: 'no-jobs' })
    expect(parseMaintenanceFile('nope')).toEqual({ ok: false, error: 'not-json' })
    expect(parseMaintenanceFile('{"app":"other"}')).toEqual({ ok: false, error: 'not-netlab' })
    expect(parseMaintenanceFile('{"app":"netlab-maintenance","formatVersion":2}')).toEqual({ ok: false, error: 'unsupported-version' })
  })
})
