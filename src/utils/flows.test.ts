import { describe, expect, it } from 'vitest'
import { checkFlows, classifyAddress, firewallRows, layoutServices, parsePorts } from './flows'
import { checkFlowchart, layoutFlowchart } from './flowchart'
import type { Flowchart, ServiceFlow, ServiceNode } from '@/types/project'

const nodes: ServiceNode[] = [
  { id: 'u', name: 'Users', kind: 'client', zone: 'Office', addresses: '10.1.0.0/16' },
  { id: 'lb', name: 'LB', kind: 'lb', zone: 'DMZ', addresses: '10.10.20.10' },
  { id: 'app', name: 'App', kind: 'app', zone: 'Server', addresses: '10.10.20.21, 10.10.20.22' },
  { id: 'db', name: 'DB', kind: 'db', zone: 'Server', addresses: 'db01.corp' },
]
const flow = (id: string, from: string, to: string, ports: string, protocol: ServiceFlow['protocol'] = 'TCP'): ServiceFlow => ({ id, from, to, protocol, ports, purpose: id })

describe('flows', () => {
  it('parses ports', () => {
    expect(parsePorts('443')).toEqual([{ from: 443, to: 443 }])
    expect(parsePorts('80, 443,8000-8100')).toEqual([{ from: 80, to: 80 }, { from: 443, to: 443 }, { from: 8000, to: 8100 }])
    expect(parsePorts('')).toEqual([])
    for (const bad of ['0', '70000', '90-80', 'http', '1-2-3']) expect(parsePorts(bad), bad).toBeNull()
  })

  it('classifies addresses', () => {
    expect(classifyAddress('10.0.0.1')).toBe('ip')
    expect(classifyAddress('fd00::1')).toBe('ip')
    expect(classifyAddress('10.0.0.0/8')).toBe('cidr')
    expect(classifyAddress('db01.corp')).toBe('hostname')
    expect(classifyAddress('10.0.0.999')).toBeNull()
    expect(classifyAddress('bad host')).toBeNull()
  })

  it('a correct design has no issues', () => {
    expect(checkFlows(nodes, [flow('f1', 'u', 'lb', '443'), flow('f2', 'lb', 'app', '8080'), flow('f3', 'app', 'db', '3306')])).toEqual([])
  })

  it('flags bad ports, unknown nodes, duplicates, bad addresses, missing addresses', () => {
    const extra: ServiceNode[] = [...nodes, { id: 'x', name: 'X', kind: 'other', zone: '', addresses: '' }, { id: 'bad', name: 'Bad', kind: 'other', zone: '', addresses: '10.0.0.999' }]
    const codes = checkFlows(extra, [
      flow('a', 'u', 'lb', 'https'),
      flow('b', 'u', 'lb', ''),
      flow('c', 'u', 'ghost', '443'),
      flow('d', 'lb', 'app', '8080'),
      flow('e', 'lb', 'app', '8080'),
      flow('f', 'x', 'app', '22'),
      flow('g', 'app', 'app', '9000'),
      flow('h', 'u', 'lb', '', 'ICMP'),
    ]).map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['invalid-ports', 'missing-ports', 'unknown-node', 'duplicate-flow', 'no-address', 'self-flow', 'invalid-address']))
    expect(codes.filter((c) => c === 'missing-ports')).toHaveLength(1) // ICMP needs no ports
  })

  it('builds the firewall matrix', () => {
    const flows = [flow('f1', 'u', 'lb', '443'), flow('f2', 'app', 'db', '3306'), flow('f3', 'u', 'app', '', 'ICMP')]
    expect(firewallRows(nodes, flows)[1]).toEqual(['2', 'App', '10.10.20.21 10.10.20.22', 'DB', 'db01.corp', 'TCP', '3306', 'f2'])
    expect(firewallRows(nodes, flows)[2]![6]).toBe('-')
  })

  it('lays out zones as columns', () => {
    const l = layoutServices(nodes)
    expect(l.zones.map((z) => z.name)).toEqual(['Office', 'DMZ', 'Server'])
    expect(l.nodes.get('app')!.x).toBe(l.nodes.get('db')!.x)
    expect(l.nodes.get('db')!.y).toBeGreaterThan(l.nodes.get('app')!.y)
  })
})

describe('flowchart', () => {
  const fc: Flowchart = {
    id: 'f',
    title: 'Install',
    scope: '',
    nodes: [
      { id: 's', type: 'start', text: 'Start', next: 'a', yes: null, no: null },
      { id: 'a', type: 'step', text: 'Rack', next: 'd', yes: null, no: null },
      { id: 'd', type: 'decision', text: 'Link up?', next: null, yes: 'e', no: 'fix' },
      { id: 'fix', type: 'step', text: 'Fix cable', next: 'd', yes: null, no: null },
      { id: 'e', type: 'end', text: 'Done', next: null, yes: null, no: null },
    ],
  }

  it('validates a correct chart', () => {
    expect(checkFlowchart(fc)).toEqual([])
  })

  it('finds structural problems', () => {
    const broken: Flowchart = {
      ...fc,
      nodes: [
        { id: 's', type: 'step', text: 'No start', next: 'zz', yes: null, no: null },
        { id: 'd', type: 'decision', text: 'Q', next: null, yes: 's', no: null },
      ],
    }
    expect(checkFlowchart(broken).map((i) => i.code)).toEqual(expect.arrayContaining(['no-start', 'no-end', 'missing-branch', 'dangling']))
    const orphan = { ...fc, nodes: [...fc.nodes, { id: 'o', type: 'step' as const, text: 'Orphan', next: 'e', yes: null, no: null }] }
    expect(checkFlowchart(orphan).map((i) => i.code)).toEqual(['unreachable'])
  })

  it('ranks nodes top-down and routes the loop back around the side', () => {
    const l = layoutFlowchart(fc)
    const y = (id: string) => l.nodes.find((n) => n.node.id === id)!.y
    expect(y('s')).toBeLessThan(y('a'))
    expect(y('a')).toBeLessThan(y('d'))
    expect(y('d')).toBeLessThan(y('fix'))
    const loop = l.edges.find((e) => e.from === 'fix' && e.to === 'd')!
    expect(loop.back).toBe(true)
    expect(Math.max(...loop.points.map((p) => p.x))).toBeGreaterThan(Math.max(...l.nodes.map((n) => n.x + n.w / 2)))
    expect(l.edges.filter((e) => e.label)).toHaveLength(2)
    expect(l.height).toBeGreaterThan(y('fix'))
  })
})

describe('flowchart templates', () => {
  it('are complete in every language and structurally valid', async () => {
    const { FLOWCHART_TEMPLATES, flowchartFromTemplate, templateTextCoverage } = await import('@/i18n/content/flowcharts')
    for (const row of templateTextCoverage()) expect(row.missing, `${row.locale} ${row.template}`).toEqual([])
    for (const locale of ['zh-TW', 'en'] as const) {
      for (const t of FLOWCHART_TEMPLATES) {
        const fc = flowchartFromTemplate(locale, t, `fc-${t}`)
        expect(checkFlowchart(fc), `${locale} ${t}`).toEqual([])
        expect(layoutFlowchart(fc).nodes).toHaveLength(fc.nodes.length)
      }
    }
  })
})

describe('flowchart back edges', () => {
  it('never pass through another node', async () => {
    const { flowchartFromTemplate, FLOWCHART_TEMPLATES } = await import('@/i18n/content/flowcharts')
    for (const tpl of FLOWCHART_TEMPLATES) {
      const l = layoutFlowchart(flowchartFromTemplate('en', tpl, 'x'))
      for (const e of l.edges.filter((x) => x.back)) {
        for (let i = 0; i < e.points.length - 1; i++) {
          const p = e.points[i]!
          const q = e.points[i + 1]!
          for (const n of l.nodes.filter((n) => n.node.id !== e.from && n.node.id !== e.to)) {
            const left = n.x - n.w / 2
            const right = n.x + n.w / 2
            const top = n.y - n.h / 2
            const bottom = n.y + n.h / 2
            const crosses =
              p.y === q.y
                ? p.y > top && p.y < bottom && Math.max(p.x, q.x) > left && Math.min(p.x, q.x) < right
                : p.x > left && p.x < right && Math.max(p.y, q.y) > top && Math.min(p.y, q.y) < bottom
            expect(crosses, `${tpl} ${e.from}->${e.to} crosses ${n.node.id}`).toBe(false)
          }
        }
      }
    }
  })
})
