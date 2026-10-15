import { describe, expect, it } from 'vitest'
import type { MaintenanceJob, PartOp } from '@/types/project'
import { analyzeJob, jobHosts, jobToFlowchart, parseSlots, specGb } from './maintenance'
import { checkFlowchart } from './flowchart'

const op = (o: Partial<PartOp>): PartOp => ({ id: `op${Math.random()}`, kind: 'move', part: 'dimm', fromHost: '', fromSlots: '', toHost: '', toSlots: '', spec: '', serial: '', done: false, notes: '', ...o })
const job = (ops: PartOp[]): MaintenanceJob => ({ id: 'j', title: 'DIMM', customer: '', site: '', engineer: '', ticket: '', date: '2026-10-15', notes: '', ops, startTime: '', endTime: '', fieldNotes: '', actual: {} })

describe('parseSlots', () => {
  it('splits lists and expands ranges', () => {
    expect(parseSlots('a1, A2、b3')).toEqual(['A1', 'A2', 'B3'])
    expect(parseSlots('A1-A4')).toEqual(['A1', 'A2', 'A3', 'A4'])
    expect(parseSlots('B5-6')).toEqual(['B5', 'B6'])
    expect(parseSlots('1~3 DIMM_A7')).toEqual(['1', '2', '3', 'DIMM_A7'])
    expect(parseSlots('A1-B2')).toEqual(['A1-B2'])
    expect(parseSlots('Bay 3, bay 4')).toEqual(['BAY3', 'BAY4'])
    expect(parseSlots('Slot 1-3 A1 B2')).toEqual(['SLOT1', 'SLOT2', 'SLOT3', 'A1', 'B2'])
    expect(parseSlots('  ')).toEqual([])
  })

  it('reads module sizes', () => {
    expect(specGb('32GB DDR5-4800 RDIMM')).toBe(32)
    expect(specGb('1.92TB SSD')).toBe(1920)
    expect(specGb('RDIMM')).toBeNull()
  })
})

describe('analyzeJob', () => {
  it('moves modules between machines and counts the change per machine', () => {
    const a = analyzeJob(
      job([
        op({ fromHost: 'esx01', fromSlots: 'B1, B2', toHost: 'esx04', toSlots: 'A3-A4', spec: '32GB RDIMM' }),
        op({ fromHost: 'esx02', fromSlots: 'B1,B2', toHost: 'ESX04', toSlots: 'B3,B4', spec: '32GB RDIMM' }),
      ]),
    )
    expect(a.issues).toEqual([])
    expect(a.hosts.map((h) => [h.host, h.out, h.in, h.deltaGb])).toEqual([
      ['esx01', 2, 0, -64],
      ['esx04', 0, 4, 128],
      ['esx02', 2, 0, -64],
    ])
    expect(a.hosts[1]!.slots.map((s) => [s.slot, s.events[0]!.peer])).toEqual([
      ['A3', 'esx01 B1'],
      ['A4', 'esx01 B2'],
      ['B3', 'esx02 B1'],
      ['B4', 'esx02 B2'],
    ])
  })

  it('swaps left / right inside one machine when the target machine is left empty', () => {
    const a = analyzeJob(job([op({ kind: 'swap', fromHost: 'esx03', fromSlots: 'A1', toSlots: 'B1' })]))
    expect(a.issues).toEqual([])
    expect(a.hosts).toHaveLength(1)
    expect(a.hosts[0]!.slots.map((s) => [s.slot, s.events[0]!.dir, s.events[0]!.peer])).toEqual([
      ['A1', 'swap', 'B1'],
      ['B1', 'swap', 'A1'],
    ])
    expect([a.hosts[0]!.out, a.hosts[0]!.in]).toEqual([0, 0])
  })

  it('reports missing fields and mismatched counts', () => {
    const codes = analyzeJob(
      job([
        op({ fromHost: 'esx01', fromSlots: 'A1,A2', toHost: 'esx02', toSlots: 'A1' }),
        op({ kind: 'install', toHost: '', toSlots: '' }),
        op({ kind: 'move', fromHost: 'esx01', fromSlots: 'A5', toHost: 'esx01', toSlots: 'a5' }),
      ]),
    ).issues.map((i) => [i.line, i.code])
    expect(codes).toEqual([
      [1, 'count-mismatch'],
      [2, 'no-to-host'],
      [2, 'no-to-slots'],
      [3, 'same-slot'],
    ])
  })

  it('flags a slot filled twice or emptied twice across lines', () => {
    const issues = analyzeJob(
      job([
        op({ fromHost: 'esx01', fromSlots: 'A1', toHost: 'esx02', toSlots: 'A1' }),
        op({ fromHost: 'esx03', fromSlots: 'A1', toHost: 'esx02', toSlots: 'A1' }),
        op({ kind: 'remove', fromHost: 'esx01', fromSlots: 'A1' }),
      ]),
    ).issues
    expect(issues.map((i) => [i.line, i.code, i.params.host, i.params.slot])).toEqual([
      [2, 'slot-occupied', 'esx02', 'A1'],
      [3, 'slot-empty', 'esx01', 'A1'],
    ])
    expect(issues.every((i) => i.level === 'warning')).toBe(true)
  })

  it('allows filling a slot again after it was emptied', () => {
    const issues = analyzeJob(
      job([
        op({ kind: 'remove', fromHost: 'esx01', fromSlots: 'A1' }),
        op({ kind: 'install', toHost: 'esx01', toSlots: 'A1', spec: '64GB' }),
      ]),
    ).issues
    expect(issues).toEqual([])
  })
})

describe('jobToFlowchart', () => {
  it('builds a valid chart: prepare, each machine down, each line, each machine up, verify loop', () => {
    const j = job([
      op({ fromHost: 'esx01', fromSlots: 'B1', toHost: 'esx02', toSlots: 'B1', spec: '32GB' }),
      op({ kind: 'swap', fromHost: 'esx02', fromSlots: 'A1', toSlots: 'B2' }),
    ])
    expect(jobHosts(j)).toEqual(['esx01', 'esx02'])
    const fc = jobToFlowchart(j, 'fc-x', {
      start: 'start',
      prepare: 'prepare',
      hostDown: (h) => `down ${h}`,
      op: (o) => `do ${o.fromSlots}`,
      hostUp: (h) => `up ${typeof h === 'string' ? h : `${h.host} ${h.in - h.out}`}`,
      check: 'ok?',
      fix: 'fix',
      end: 'end',
    })
    expect(checkFlowchart(fc)).toEqual([])
    expect(fc.nodes.map((n) => n.text)).toEqual(['start', 'prepare', 'down esx01', 'down esx02', 'do B1', 'do A1', 'up esx01 -1', 'up esx02 1', 'ok?', 'fix', 'end'])
    expect(fc.scope).toBe('esx01\nesx02')
  })
})
