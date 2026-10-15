import { describe, expect, it } from 'vitest'
import { cableLabels, cableRows, checkCabling, freePorts, nextCableLabel, parseVlanList } from './cabling'
import { RACK_TEMPLATES } from './rack'
import type { Cable, RackItem } from '@/types/project'
import { toCsv } from './csv'

function dev(id: string, template: string, name = id): RackItem {
  const t = RACK_TEMPLATES[template]!
  return { id, rackId: 'r', name, model: t.model, type: t.type, uHeight: t.uHeight, uPosition: 1, powerW: t.powerW, weightKg: t.weightKg, psus: t.psus, hostname: name, ip: '', mgmtIp: '', addresses: [], serial: '', assetTag: '', os: '', notes: '', ports: t.ports }
}
let k = 0
function cable(a: string, ap: string, b: string, bp: string, extra: Partial<Cable> = {}): Cable {
  k++
  return { id: `c${k}`, label: `C-${k}`, aItemId: a, aPort: ap, bItemId: b, bPort: bp, type: 'DAC', lengthM: 3, mode: 'access', vlan: 20, allowedVlans: '', bond: '', notes: '', ...extra }
}
const items = [dev('srv', 'server-1u', 'srv01'), dev('sw1', 'switch-25g', 'sw01'), dev('sw2', 'switch-25g', 'sw02'), dev('mgmt', 'mgmt-switch')]
const codes = (cs: Cable[]) => checkCabling(items, cs).map((i) => i.code)

describe('checkCabling', () => {
  it('a correct MLAG bond has no issues', () => {
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { bond: 'bond0' }), cable('srv', 'ens1f1', 'sw2', 'Eth1/1', { bond: 'bond0' }), cable('srv', 'BMC', 'mgmt', 'Gi1/0/1', { type: 'Cat6', vlan: 10 })])).toEqual([])
  })

  it('flags reused ports, unknown ports, self loops and missing devices', () => {
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1'), cable('srv', 'ens1f1', 'sw1', 'Eth1/1')])).toContain('port-reused')
    expect(codes([cable('srv', 'eth9', 'sw1', 'Eth1/2')])).toContain('unknown-port')
    expect(codes([cable('sw1', 'Eth1/3', 'sw1', 'Eth1/3')])).toContain('self-loop')
    expect(codes([cable('ghost', 'x', 'sw1', 'Eth1/4')])).toEqual(['missing-device'])
  })

  it('flags speed mismatch and cable types that cannot carry the speed or length', () => {
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/49')])).toContain('speed-mismatch') // 25G ↔ 100G
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { type: 'Cat6' })])).toContain('type-speed')
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { lengthM: 7 })])).toContain('too-long')
    const cat = checkCabling(items, [cable('srv', 'BMC', 'mgmt', 'Gi1/0/2', { type: 'Cat6', lengthM: 120 })])
    expect(cat[0]).toMatchObject({ code: 'too-long', level: 'error' })
  })

  it('bond problems: single member, single switch, mismatched VLANs', () => {
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { bond: 'bond0' })])).toEqual(['bond-single-member'])
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { bond: 'bond0' }), cable('srv', 'ens1f1', 'sw1', 'Eth1/2', { bond: 'bond0' })])).toEqual(['bond-single-switch'])
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { bond: 'bond0' }), cable('srv', 'ens1f1', 'sw2', 'Eth1/1', { bond: 'bond0', vlan: 30 })])).toEqual(['bond-mismatch'])
  })

  it('validates VLANs and labels', () => {
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { mode: 'trunk', allowedVlans: '10,abc' })])).toContain('invalid-vlan')
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { vlan: 5000 })])).toContain('invalid-vlan')
    expect(codes([cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { label: 'X' }), cable('srv', 'ens1f1', 'sw2', 'Eth1/1', { label: 'X' })])).toContain('duplicate-label')
  })
})

describe('helpers', () => {
  it('parses VLAN lists with ranges', () => {
    expect(parseVlanList('10, 20-22,30')).toEqual([10, 20, 21, 22, 30])
    expect(parseVlanList('')).toEqual([])
    expect(parseVlanList('0')).toBeNull()
    expect(parseVlanList('30-20')).toBeNull()
  })

  it('labels, free ports, rows and CSV', () => {
    const cs = [cable('srv', 'ens1f0', 'sw1', 'Eth1/1', { label: 'C-001' })]
    expect(nextCableLabel(cs)).toBe('C-002')
    expect(freePorts(items[0]!, cs)).toEqual(['BMC', 'ens1f1'])
    expect(freePorts(items[0]!, cs, cs[0]!.id)).toEqual(['BMC', 'ens1f0', 'ens1f1'])
    expect(cableRows(items, cs)[0]).toEqual(['C-001', 'srv01', 'ens1f0', 'sw01', 'Eth1/1', 'DAC', '3', 'access', '20', '', '', ''])
    expect(cableLabels(items, cs)).toEqual(['C-001  srv01 ens1f0 → sw01 Eth1/1', 'C-001  sw01 Eth1/1 → srv01 ens1f0'])
    expect(toCsv(['a', 'b'], [['=1+1', 'x,y']])).toBe("a,b\r\n'=1+1,\"x,y\"\r\n")
  })
})
