import { describe, expect, it } from 'vitest'
import { deriveServerConfig, deriveSwitchConfig, findSubnet, portChannelIds, toCiscoLike, toEtcHosts, toHuawei, toIpmitool, toNetplan, toNmcli, type ConfigSource } from './configgen'
import { planNetwork } from './planner'
import { RACK_TEMPLATES } from './rack'
import type { Cable, RackItem } from '@/types/project'

function dev(id: string, template: string, extra: Partial<RackItem> = {}): RackItem {
  const t = RACK_TEMPLATES[template]!
  return { id, rackId: 'r', name: id, model: t.model, type: t.type, uHeight: t.uHeight, uPosition: 1, powerW: t.powerW, weightKg: t.weightKg, psus: t.psus, hostname: id, ip: '', mgmtIp: '', addresses: [], serial: '', assetTag: '', os: '', notes: '', ports: t.ports, ...extra }
}
let n = 0
const cable = (a: string, ap: string, b: string, bp: string, extra: Partial<Cable> = {}): Cable => ({
  id: `c${++n}`, label: `C-${n}`, aItemId: a, aPort: ap, bItemId: b, bPort: bp, type: 'DAC', lengthM: 3, mode: 'trunk', vlan: null, allowedVlans: '20', bond: 'bond0', notes: '', ...extra,
})

const plan = planNetwork(
  [
    { id: 'm', name: 'Management', vlan: 10, hosts: 20 },
    { id: 's', name: 'Server', vlan: 20, hosts: 50 },
  ],
  { base: '10.10.0.0/16', strategy: 'vlan-octet', gateway: 'first', growthPercent: 0, reserveGateway: true },
)
const src: ConfigSource = {
  subnets: plan.subnets,
  rackItems: [dev('srv01', 'server-1u', { ip: '10.10.20.11', mgmtIp: '10.10.10.21' }), dev('sw01', 'switch-25g'), dev('sw02', 'switch-25g'), dev('oob', 'mgmt-switch')],
  cables: [
    cable('srv01', 'ens1f0', 'sw01', 'Eth1/1'),
    cable('srv01', 'ens1f1', 'sw02', 'Eth1/1'),
    cable('srv01', 'BMC', 'oob', 'Gi1/0/1', { mode: 'access', vlan: 10, allowedVlans: '', bond: '', type: 'Cat6' }),
  ],
}
const opts = { mtu: 9000, dns: ['10.10.10.53'], search: ['corp.local'] }

describe('server config', () => {
  const cfg = deriveServerConfig(src, 'srv01', opts)!

  it('builds a LACP bond over the data ports with a VLAN sub-interface on a trunk', () => {
    expect(cfg.warnings).toEqual([])
    expect(cfg.interfaces.map((i) => `${i.kind}:${i.name}`)).toEqual(['ethernet:ens1f0', 'ethernet:ens1f1', 'bond:bond0', 'vlan:bond0.20'])
    expect(cfg.interfaces.at(-1)).toMatchObject({ parent: 'bond0', vlanId: 20, address: '10.10.20.11/26', gateway: '10.10.20.1' })
  })

  it('puts the IP straight on the bond when the switch ports are access ports', () => {
    const access: ConfigSource = { ...src, cables: src.cables.map((c) => (c.bond ? { ...c, mode: 'access' as const, vlan: 20, allowedVlans: '' } : c)) }
    const c = deriveServerConfig(access, 'srv01', opts)!
    expect(c.interfaces.find((i) => i.name === 'bond0')).toMatchObject({ address: '10.10.20.11/26', gateway: '10.10.20.1' })
    expect(c.interfaces.some((i) => i.kind === 'vlan')).toBe(false)
  })

  it('warns when data is missing', () => {
    expect(deriveServerConfig({ ...src, cables: [] }, 'srv01', opts)!.warnings).toContain('no-data-ports')
    const noSubnet = { ...src, rackItems: src.rackItems.map((i) => (i.id === 'srv01' ? { ...i, ip: '192.168.9.9' } : i)) }
    expect(deriveServerConfig(noSubnet, 'srv01', opts)!.warnings).toContain('no-subnet')
    expect(deriveServerConfig(src, 'nope', opts)).toBeNull()
  })

  it('renders netplan', () => {
    const y = toNetplan(cfg)
    expect(y).toContain('  bonds:\n    bond0:\n      interfaces: [ens1f0, ens1f1]')
    expect(y).toContain('        mode: 802.3ad')
    expect(y).toContain('    bond0.20:\n      id: 20\n      link: bond0\n      mtu: 9000\n      addresses: [10.10.20.11/26]\n      routes:\n        - to: default\n          via: 10.10.20.1')
    expect(y).toContain('addresses: [10.10.10.53]')
    expect(y).not.toMatch(/\t/)
  })

  it('renders nmcli', () => {
    const s = toNmcli(cfg)
    expect(s).toContain('nmcli con add type bond con-name bond0 ifname bond0 bond.options "mode=802.3ad,miimon=100,lacp_rate=fast,xmit_hash_policy=layer3+4" ipv4.method disabled')
    expect(s).toContain('nmcli con add type ethernet con-name bond0-ens1f0 ifname ens1f0 master bond0 slave-type bond 802-3-ethernet.mtu 9000')
    expect(s).toContain('nmcli con add type vlan con-name bond0.20 ifname bond0.20 dev bond0 id 20 ipv4.method manual ipv4.addresses 10.10.20.11/26 ipv4.gateway 10.10.20.1 ipv4.dns "10.10.10.53"')
    expect(s.split('\n').filter((l) => l.startsWith('nmcli con up'))).toEqual(['nmcli con up bond0', 'nmcli con up bond0.20'])
  })

  it('renders /etc/hosts and ipmitool', () => {
    expect(toEtcHosts(src.rackItems)).toContain('10.10.20.11     srv01')
    expect(toEtcHosts(src.rackItems)).toContain('10.10.10.21     srv01-bmc')
    expect(toIpmitool(src, 'srv01')).toContain('ipmitool lan set 1 netmask 255.255.255.224\nipmitool lan set 1 defgw ipaddr 10.10.10.1')
    expect(toIpmitool(src, 'sw01')).toBeNull()
  })
})

describe('switch config', () => {
  it('numbers port-channels per host bond, identical on both MLAG members', () => {
    expect([...portChannelIds(src)]).toEqual([['srv01::bond0', 10]])
    const a = deriveSwitchConfig(src, 'sw01', 9216)!
    const b = deriveSwitchConfig(src, 'sw02', 9216)!
    expect(a.portChannels).toEqual([{ id: 10, description: 'srv01 bond0', mode: 'trunk', vlan: null, allowed: [20], mlag: true }])
    expect(b.portChannels[0]?.id).toBe(10)
    expect(a.vlans).toEqual([{ id: 20, name: 'Server' }])
    expect(a.ports).toEqual([{ name: 'Eth1/1', description: 'srv01 ens1f0', mode: 'trunk', vlan: null, allowed: [20], channelGroup: 10 }])
  })

  it('renders Cisco/Arista and Huawei', () => {
    const cfg = deriveSwitchConfig(src, 'sw01', 9216)!
    const c = toCiscoLike(cfg)
    expect(c).toContain('vlan 20\n  name Server')
    expect(c).toContain('interface Port-Channel10\n  description srv01 bond0\n  switchport mode trunk\n  switchport trunk allowed vlan 20\n  mlag 10')
    expect(c).toContain('interface Eth1/1\n  description srv01 ens1f0\n  mtu 9216\n  channel-group 10 mode active\n  no shutdown')
    const h = toHuawei(cfg)
    expect(h).toContain('vlan batch 20')
    expect(h).toContain('interface Eth-Trunk10\n description srv01 bond0\n mode lacp\n port link-type trunk\n port trunk allow-pass vlan 20')
    expect(h).toContain(' eth-trunk 10')
  })

  it('access ports for the management switch', () => {
    const oob = deriveSwitchConfig(src, 'oob', 1500)!
    expect(oob.ports[0]).toMatchObject({ name: 'Gi1/0/1', mode: 'access', vlan: 10, channelGroup: null })
    expect(toCiscoLike(oob)).toContain('interface Gi1/0/1\n  description srv01 BMC\n  switchport mode access\n  switchport access vlan 10')
    expect(toCiscoLike(oob)).not.toContain('mtu')
  })

  it('finds the subnet that holds an IP', () => {
    expect(findSubnet(plan.subnets, '10.10.10.21')?.name).toBe('Management')
    expect(findSubnet(plan.subnets, '1.2.3.4')).toBeUndefined()
  })
})

describe('extra addresses', () => {
  const plan3 = planNetwork(
    [
      { id: 's', name: 'Server', vlan: 20, hosts: 50 },
      { id: 'v', name: 'vMotion', vlan: 40, hosts: 20 },
    ],
    { base: '10.10.0.0/16', strategy: 'vlan-octet', gateway: 'first', growthPercent: 0, reserveGateway: true },
  )
  const host = (addresses: RackItem['addresses']) => dev('esx01', 'server-1u', { ip: '10.10.20.11', addresses })
  const source = (h: RackItem): ConfigSource => ({
    subnets: plan3.subnets,
    rackItems: [h, dev('sw01', 'switch-25g'), dev('sw02', 'switch-25g')],
    cables: [cable('esx01', 'ens1f0', 'sw01', 'Eth1/1', { allowedVlans: '20,40' }), cable('esx01', 'ens1f1', 'sw02', 'Eth1/1', { allowedVlans: '20,40' })],
  })
  const opts = { mtu: 9000, dns: [], search: [] }

  it('puts a vMotion address on a VLAN of the bond, without a second default gateway', () => {
    const cfg = deriveServerConfig(source(host([{ id: 'a1', purpose: 'vmotion', iface: '', vlan: null, address: '10.10.40.11' }])), 'esx01', opts)!
    expect(cfg.warnings).toEqual([])
    expect(cfg.interfaces.filter((i) => i.kind === 'vlan').map((i) => `${i.name} ${i.address} ${i.gateway ?? '-'}`)).toEqual(['bond0.20 10.10.20.11/26 10.10.20.1', 'bond0.40 10.10.40.11/27 -'])
    expect(toNetplan(cfg)).toContain('bond0.40:')
    expect(toNmcli(cfg)).toContain('nmcli con add type vlan con-name bond0.40 ifname bond0.40 dev bond0 id 40 ipv4.method manual ipv4.addresses 10.10.40.11/27 ')
  })

  it('warns about uncabled interfaces and two addresses on the same VLAN', () => {
    const noIface = deriveServerConfig(source(host([{ id: 'a1', purpose: 'storage', iface: 'ens2f0', vlan: 30, address: '10.10.30.11' }])), 'esx01', opts)!
    expect(noIface.warnings).toContain('extra-no-iface')
    const clash = deriveServerConfig(source(host([{ id: 'a1', purpose: 'other', iface: 'bond0', vlan: 20, address: '10.10.20.99' }])), 'esx01', opts)!
    expect(clash.warnings).toContain('extra-conflict')
  })

  it('lists extra addresses in /etc/hosts by purpose', () => {
    const h = host([
      { id: 'a1', purpose: 'storage', iface: '', vlan: 30, address: '10.10.30.11' },
      { id: 'a2', purpose: 'storage', iface: '', vlan: 31, address: '10.10.31.11' },
      { id: 'a3', purpose: 'vmotion', iface: '', vlan: null, address: 'not-an-ip' },
    ])
    const hosts = toEtcHosts([h])
    expect(hosts).toContain('10.10.30.11     esx01-storage')
    expect(hosts).toContain('10.10.31.11     esx01-storage-2')
    expect(hosts).not.toContain('not-an-ip')
  })
})
