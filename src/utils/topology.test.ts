import { describe, expect, it } from 'vitest'
import { broadcastDomains, checkTopology } from './topology'
import type { DeviceType, TopoDevice, TopoLink } from '@/types/topology'

function dev(id: string, type: DeviceType, extra: Partial<TopoDevice> = {}): TopoDevice {
  return { id, type, name: id, ip: '', cidr: 24, gateway: '', vlan: null, mac: '', interfaces: [], x: 0, y: 0, ...extra }
}
function link(a: string, b: string, vlan: number | null = null): TopoLink {
  return { id: `${a}-${b}`, a, b, vlan }
}
const codes = (devices: TopoDevice[], links: TopoLink[]) => checkTopology(devices, links).map((i) => i.code)

describe('checkTopology', () => {
  const fw = dev('fw', 'firewall', { ip: '10.10.20.1' })
  const sw = dev('sw', 'switch')

  it('a correct network has no issues', () => {
    const a = dev('a', 'server', { ip: '10.10.20.50', gateway: '10.10.20.1', vlan: 20 })
    const b = dev('b', 'server', { ip: '10.10.20.51', gateway: '10.10.20.1', vlan: 20 })
    expect(checkTopology([fw, sw, a, b], [link('fw', 'sw'), link('sw', 'a', 20), link('sw', 'b', 20)])).toEqual([])
  })

  it('VLAN mismatch: server on VLAN 20 plugged into a VLAN 30 port (spec example)', () => {
    const a = dev('a', 'server', { ip: '10.10.20.50', gateway: '10.10.20.1', vlan: 20 })
    const issues = checkTopology([fw, sw, a], [link('fw', 'sw'), link('sw', 'a', 30)])
    expect(issues[0]).toMatchObject({ level: 'error', code: 'vlan-mismatch', params: { deviceVlan: '20', portVlan: '30' } })
  })

  it('flags invalid fields', () => {
    const a = dev('a', 'server', { ip: '10.0.0.300', gateway: 'x', mac: 'zz', vlan: 5000, interfaces: ['1.2.3.4'] })
    expect(codes([a], [])).toEqual(
      expect.arrayContaining(['invalid-ip', 'invalid-gateway', 'invalid-mac', 'invalid-vlan', 'invalid-interface', 'not-connected']),
    )
  })

  it('flags duplicate IPs (including router interfaces) and MACs', () => {
    const a = dev('a', 'server', { ip: '10.0.0.5', mac: '02:00:00:00:00:01' })
    const b = dev('b', 'server', { ip: '10.0.0.5', mac: '02-00-00-00-00-01' })
    const r = dev('r', 'router', { ip: '10.0.1.1', interfaces: ['10.0.0.5/24'] })
    const issues = checkTopology([a, b, r], [])
    expect(issues.find((i) => i.code === 'duplicate-ip')?.deviceIds.sort()).toEqual(['a', 'b', 'r'])
    expect(issues.some((i) => i.code === 'duplicate-mac')).toBe(true)
  })

  it('gateway problems: missing, outside subnet, not found, not adjacent', () => {
    const noGw = dev('a', 'server', { ip: '10.10.20.50' })
    expect(codes([noGw, sw, fw], [link('sw', 'a'), link('sw', 'fw')])).toContain('missing-gateway')

    const outside = dev('a', 'server', { ip: '192.168.10.50', gateway: '192.168.20.1' })
    expect(checkTopology([outside, sw], [link('sw', 'a')])[0]).toMatchObject({
      code: 'gateway-outside-subnet',
      params: { network: '192.168.10.0/24' },
    })

    const notFound = dev('a', 'server', { ip: '10.10.20.50', gateway: '10.10.20.254' })
    expect(codes([notFound, sw, fw], [link('sw', 'a'), link('sw', 'fw')])).toContain('gateway-not-found')

    // Gateway exists but the server's port is in another VLAN than the firewall's access port.
    const isolated = dev('a', 'server', { ip: '10.10.20.50', gateway: '10.10.20.1', vlan: 30 })
    expect(codes([isolated, sw, fw], [link('sw', 'a', 30), link('sw', 'fw', 20)])).toContain('gateway-not-adjacent')
  })

  it('router on a trunk port reaches every VLAN of the fabric', () => {
    const r = dev('r', 'router', { ip: '10.0.10.1', interfaces: ['10.0.20.1/24'] })
    const core = dev('core', 'switch')
    const access = dev('acc', 'switch')
    const a = dev('a', 'server', { ip: '10.0.10.5', gateway: '10.0.10.1', vlan: 10 })
    const b = dev('b', 'server', { ip: '10.0.20.5', gateway: '10.0.20.1', vlan: 20 })
    const links = [link('r', 'core'), link('core', 'acc'), link('acc', 'a', 10), link('acc', 'b', 20)]
    expect(checkTopology([r, core, access, a, b], links)).toEqual([])
    const domains = broadcastDomains([r, core, access, a, b], links)
    expect([...domains.get('a')!]).toEqual(['r'])
    expect([...domains.get('r')!].sort()).toEqual(['a', 'b'])
  })

  it('warns about different subnets in the same broadcast domain', () => {
    const a = dev('a', 'client', { ip: '10.0.0.5', gateway: '10.0.0.1' })
    const b = dev('b', 'client', { ip: '10.0.1.5', gateway: '10.0.1.1' })
    const issues = checkTopology([sw, a, b], [link('sw', 'a', 10), link('sw', 'b', 10)])
    expect(issues.filter((i) => i.code === 'subnet-mismatch-in-vlan')).toHaveLength(1)
  })

  it('sorts errors before warnings before info', () => {
    const a = dev('a', 'server', { ip: 'bad' })
    const b = dev('b', 'server', { ip: '10.0.0.9' })
    const levels = checkTopology([a, b], []).map((i) => i.level)
    expect(levels).toEqual([...levels].sort((x, y) => ['error', 'warning', 'info'].indexOf(x) - ['error', 'warning', 'info'].indexOf(y)))
  })
})

describe('example topology', () => {
  it('shows the spec VLAN mismatch on Server A and nothing about the correctly patched servers', async () => {
    const { exampleTopology } = await import('@/stores/topology')
    const { devices, links } = exampleTopology()
    const issues = checkTopology(devices, links)
    const mismatch = issues.filter((i) => i.code === 'vlan-mismatch')
    expect(mismatch).toHaveLength(1)
    expect(mismatch[0]).toMatchObject({ deviceIds: ['server-1'], params: { deviceVlan: '20', portVlan: '30' } })
    expect(issues.some((i) => i.deviceIds.includes('server-2'))).toBe(false)
    expect(issues.some((i) => i.code === 'gateway-not-adjacent' || i.code === 'gateway-not-found')).toBe(false)
  })
})
