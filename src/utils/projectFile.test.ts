import { describe, expect, it } from 'vitest'
import { emptyProject, parseProjectFile, serializeProject } from './projectFile'
import { RACK_TEMPLATES } from './rack'
import type { ProjectData } from '@/types/project'

function sample(): ProjectData {
  const p = emptyProject()
  p.meta = { ...p.meta, customer: 'ACME', project: 'DGX', logo: 'data:image/png;base64,iVBORw0KGgo=' }
  p.racks = [{ id: 'r1', name: 'R1', location: 'Row A', heightU: 42, pduCapacityW: 7000, voltage: 220, maxWeightKg: 1200, row: 0, col: 1 }]
  const t = RACK_TEMPLATES['server-1u']!
  p.rackItems = [{ id: 'i1', rackId: 'r1', name: 'srv01', model: t.model, type: 'server', uHeight: 1, uPosition: 10, powerW: 450, weightKg: 18, psus: 2, hostname: 'srv01', ip: '10.10.20.11', mgmtIp: '10.10.10.21', addresses: [], serial: 'SN1', assetTag: '', os: '', notes: '', ports: t.ports }]
  p.cables = [{ id: 'c1', label: 'C-001', aItemId: 'i1', aPort: 'ens1f0', bItemId: 'i2', bPort: 'Eth1/1', type: 'DAC', lengthM: 2, mode: 'access', vlan: 20, allowedVlans: '', bond: 'bond0', notes: '' }]
  p.services = [{ id: 's1', name: 'App', kind: 'app', zone: 'Server', addresses: '10.10.20.11' }, { id: 's2', name: 'Users', kind: 'client', zone: 'Office', addresses: '10.1.0.0/16' }]
  p.flows = [{ id: 'f1', from: 's2', to: 's1', protocol: 'TCP', ports: '443', purpose: 'web' }]
  p.flowcharts = [{ id: 'fc1', title: 'Install', scope: 'ERP-AP01\nesx01', nodes: [{ id: 'n1', type: 'start', text: 'Start', next: null, yes: null, no: null }] }]
  return p
}

describe('project file', () => {
  it('round-trips', () => {
    const p = sample()
    p.rackItems[0] = { ...p.rackItems[0]!, os: 'ESXi 8.0 U3', assetTag: 'ACME-001', notes: 'Rail kit in box 3', addresses: [{ id: 'a1', purpose: 'vmotion', iface: 'bond0', vlan: 40, address: '10.10.40.11' }], ports: [{ name: 'BMC', speed: 1, mac: 'aa:bb:cc:dd:ee:ff' }] }
    const parsed = parseProjectFile(serializeProject(p))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data).toEqual(p)
  })

  it('reads files from before the flowchart scope and drops v1.3.0 work orders', () => {
    const file = JSON.parse(serializeProject(sample()))
    file.maintenance = [{ id: 'job1', title: 'DIMM', ops: [] }]
    delete file.flowcharts[0].scope
    const old = parseProjectFile(JSON.stringify(file))
    expect(old.ok && old.data.flowcharts[0]!.scope).toBe('')
    expect(old.ok && 'maintenance' in old.data).toBe(false)
  })

  it('rejects files that are not netlab projects', () => {
    expect(parseProjectFile('nope')).toEqual({ ok: false, error: 'not-json' })
    expect(parseProjectFile('{"app":"other"}')).toEqual({ ok: false, error: 'not-netlab' })
    expect(parseProjectFile('{"app":"netlab","formatVersion":9}')).toEqual({ ok: false, error: 'unsupported-version' })
    expect(parseProjectFile('x'.repeat(6 * 1024 * 1024))).toEqual({ ok: false, error: 'too-large' })
  })

  it('cleans up extra addresses and ports from untrusted files', () => {
    const file = JSON.parse(serializeProject(sample()))
    file.rackItems[0].addresses = [{ id: 'a1', purpose: 'evil', vlan: 9999, iface: 'x'.repeat(100), address: '10.0.0.1' }, { purpose: 'storage' }, 'junk']
    file.rackItems[0].ports = [{ name: 'eth0', speed: 25, mac: 42 }]
    const r = parseProjectFile(JSON.stringify(file))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.rackItems[0]!.addresses).toEqual([{ id: 'a1', purpose: 'other', iface: 'x'.repeat(40), vlan: null, address: '10.0.0.1' }])
    expect(r.data.rackItems[0]!.ports).toEqual([{ name: 'eth0', speed: 25 }])
  })

  it('sanitizes hostile or malformed content', () => {
    const evil = JSON.parse(serializeProject(sample()))
    evil.meta.logo = 'javascript:alert(1)'
    evil.meta.customer = 'x'.repeat(10000)
    evil.meta.extra = 'dropped'
    evil.rackItems[0].uHeight = 999
    evil.rackItems[0].type = '<script>'
    evil.rackItems.push({ id: '../../etc', rackId: 'r1' }, 'not-an-object', { id: 'ok2', rackId: 'r1', powerW: 'lots' })
    evil.cables[0].vlan = 99999
    evil.flows.push({ id: 'f2', from: 's1', to: 's2', protocol: 'SCTP' })
    const r = parseProjectFile(JSON.stringify(evil))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.meta.logo).toBeNull()
    expect(r.data.meta.customer).toHaveLength(200)
    expect('extra' in r.data.meta).toBe(false)
    expect(r.data.rackItems.map((i) => i.id)).toEqual(['i1', 'ok2'])
    expect(r.data.rackItems[0]).toMatchObject({ uHeight: 20, type: 'other' })
    expect(r.data.rackItems[1]).toMatchObject({ powerW: 0, uHeight: 1, ports: [] })
    expect(r.data.cables[0]!.vlan).toBeNull()
    expect(r.data.flows[1]!.protocol).toBe('TCP')
  })
})

describe('legacy files', () => {
  it('opens files that still contain acceptance results from v1.1', () => {
    const file = JSON.parse(serializeProject(sample()))
    file.checks = [{ id: 'chk1', kind: 'ping', target: '10.10.20.1', port: null, mtu: null, label: 'gw', group: 'gateways' }]
    file.lastRun = { startedAt: 't0', finishedAt: 't1', results: [] }
    const r = parseProjectFile(JSON.stringify(file))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toEqual(sample())
    expect('checks' in r.data).toBe(false)
  })

  it('places racks from files made before the floor plan side by side in row A', () => {
    const p = emptyProject()
    const file = JSON.parse(serializeProject(p))
    file.racks = [
      { id: 'r1', name: 'R01', heightU: 42 },
      { id: 'r2', name: 'R02', heightU: 42 },
    ]
    const old = parseProjectFile(JSON.stringify(file))
    expect(old.ok && old.data.racks.map((r) => [r.name, r.row, r.col])).toEqual([
      ['R01', 0, 1],
      ['R02', 0, 2],
    ])
    // A file that says "not on the floor plan" keeps that.
    file.racks[1].row = null
    file.racks[1].col = null
    const current = parseProjectFile(JSON.stringify(file))
    expect(current.ok && current.data.racks.map((r) => r.row)).toEqual([null, null])
  })
})
