import { describe, expect, it } from 'vitest'
import { planNetwork, planToCsv, planToJson, planToTopology, planToTsv, rangeToBlocks, requiredAddresses, type PlanOptions, type PlanRequirement } from './planner'
import { checkTopology } from './topology'

const req = (name: string, hosts: number, vlan: number | null = null): PlanRequirement => ({ id: name, name, vlan, hosts })
const vlsm: PlanOptions = { base: '10.10.0.0/16', strategy: 'vlsm', gateway: 'first', growthPercent: 0, reserveGateway: true }
const octet: PlanOptions = { ...vlsm, strategy: 'vlan-octet' }

describe('requiredAddresses', () => {
  it('adds growth and the gateway', () => {
    expect(requiredAddresses(20, 0, true)).toBe(21)
    expect(requiredAddresses(20, 0, false)).toBe(20)
    expect(requiredAddresses(100, 25, true)).toBe(126)
    expect(requiredAddresses(10, 15, false)).toBe(12)
  })
})

describe('planNetwork: VLAN-aligned (spec section 九)', () => {
  it('Management VLAN 10 with 20 hosts → 10.10.10.0/27, gateway .1, usable .2–.30, broadcast .31', () => {
    const r = planNetwork([req('Management', 20, 10), req('Server', 50, 20), req('Storage', 30, 30)], octet)
    expect(r.ok).toBe(true)
    const [mgmt, server, storage] = r.subnets
    expect(mgmt).toMatchObject({
      name: 'Management',
      vlan: 10,
      network: '10.10.10.0',
      cidr: 27,
      subnetMask: '255.255.255.224',
      gateway: '10.10.10.1',
      firstIp: '10.10.10.2',
      lastIp: '10.10.10.30',
      broadcast: '10.10.10.31',
      totalHosts: 30,
      availableHosts: 29,
    })
    expect(server).toMatchObject({ network: '10.10.20.0', cidr: 26, gateway: '10.10.20.1' })
    expect(storage).toMatchObject({ network: '10.10.30.0', cidr: 26 }) // 30 hosts + gateway = 31 > 30
  })

  it('rejects what the octet layout cannot hold', () => {
    const r = planNetwork([req('A', 20), req('B', 20, 300), req('C', 400, 40)], octet)
    expect(r.issues.map((i) => i.code)).toEqual(['missing-vlan', 'vlan-octet-range', 'octet-too-many-hosts'])
    expect(planNetwork([req('A', 20, 10)], { ...octet, base: '10.10.10.0/24' }).issues[0]?.code).toBe('octet-base-too-small')
  })

  it('works with a /8 base', () => {
    expect(planNetwork([req('A', 10, 5)], { ...octet, base: '10.0.0.0/8' }).subnets[0]?.network).toBe('10.0.5.0')
  })
})

describe('planNetwork: VLSM (spec section 十)', () => {
  const spec = [req('Management', 20), req('Server', 100), req('Storage', 50), req('VM', 200), req('Backup', 20)]

  it('allocates largest first from 10.10.0.0/16', () => {
    const r = planNetwork(spec, vlsm)
    expect(r.ok).toBe(true)
    expect(r.subnets.map((s) => `${s.name} ${s.network}/${s.cidr}`)).toEqual([
      'VM 10.10.0.0/24',
      'Server 10.10.1.0/25',
      'Storage 10.10.1.128/26',
      'Management 10.10.1.192/27',
      'Backup 10.10.1.224/27',
    ])
    expect(r.subnets[0]).toMatchObject({ gateway: '10.10.0.1', firstIp: '10.10.0.2', lastIp: '10.10.0.254', broadcast: '10.10.0.255', totalHosts: 254, availableHosts: 253, spare: 53 })
    expect(r.usedAddresses).toBe(512)
    expect(r.utilization).toBe(0.8)
  })

  it('every subnet is aligned, inside the base, and non-overlapping', () => {
    const r = planNetwork([req('a', 3), req('b', 1000), req('c', 60), req('d', 7), req('e', 250), req('f', 13)], { ...vlsm, base: '172.16.0.0/20' })
    expect(r.ok).toBe(true)
    const ranges = r.subnets.map((s) => {
      const start = s.network.split('.').reduce((a, o) => a * 256 + Number(o), 0)
      expect(start % s.totalAddresses, s.name).toBe(0)
      return [start, start + s.totalAddresses - 1] as const
    })
    for (let i = 1; i < ranges.length; i++) expect(ranges[i]![0]).toBeGreaterThan(ranges[i - 1]![1])
    for (const s of r.subnets) expect(s.availableHosts).toBeGreaterThanOrEqual(s.requestedHosts)
  })

  it('lists the remaining space as aligned free blocks', () => {
    const r = planNetwork(spec, vlsm)
    expect(r.free.map((f) => `${f.network}/${f.cidr}`)).toEqual([
      '10.10.2.0/23',
      '10.10.4.0/22',
      '10.10.8.0/21',
      '10.10.16.0/20',
      '10.10.32.0/19',
      '10.10.64.0/18',
      '10.10.128.0/17',
    ])
    expect(r.free.reduce((s, f) => s + f.totalAddresses, 0) + r.usedAddresses).toBe(65536)
  })

  it('reports requirements that do not fit and keeps the rest', () => {
    const r = planNetwork([req('Big', 200), req('Small', 20), req('Huge', 300)], { ...vlsm, base: '192.168.1.0/24' })
    expect(r.ok).toBe(false)
    // Huge (/23) is larger than the base; Big (200 + gateway → /24) fills it, so Small no longer fits.
    expect(r.issues.filter((i) => i.code === 'does-not-fit').map((i) => i.requirementId)).toEqual(['Huge', 'Small'])
    expect(r.subnets.map((s) => s.name)).toEqual(['Big'])
  })

  it('gateway at the last usable address', () => {
    const s = planNetwork([req('A', 20)], { ...vlsm, gateway: 'last', base: '10.0.0.0/24' }).subnets[0]!
    expect(s).toMatchObject({ gateway: '10.0.0.30', firstIp: '10.0.0.1', lastIp: '10.0.0.29' })
  })

  it('growth reserve pushes subnets up a size', () => {
    expect(planNetwork([req('A', 25)], { ...vlsm, growthPercent: 0 }).subnets[0]!.cidr).toBe(27)
    expect(planNetwork([req('A', 25)], { ...vlsm, growthPercent: 30 }).subnets[0]!.cidr).toBe(26)
  })
})

describe('planNetwork validation', () => {
  it('flags bad input', () => {
    expect(planNetwork([], { ...vlsm, base: 'nope' }).issues[0]?.code).toBe('invalid-base')
    expect(planNetwork([], vlsm).issues.map((i) => i.code)).toEqual(['no-requirements'])
    const r = planNetwork([req('A', 0), req('B', 10, 5000), req('C', 10, 20), req('D', 10, 20), req('C', 5)], vlsm)
    expect(r.issues.map((i) => i.code)).toEqual(['invalid-hosts', 'invalid-vlan', 'duplicate-vlan', 'duplicate-name'])
  })

  it('normalizes a base that is not on its network boundary', () => {
    const r = planNetwork([req('A', 10)], { ...vlsm, base: '10.10.5.7/16' })
    expect(r.issues[0]).toMatchObject({ level: 'warning', code: 'base-normalized', params: { network: '10.10.0.0/16' } })
    expect(r.ok).toBe(true)
    expect(r.subnets[0]?.network).toBe('10.10.0.0')
  })
})

describe('rangeToBlocks', () => {
  it('covers a range with the fewest aligned blocks', () => {
    const ip = (s: string) => s.split('.').reduce((a, o) => a * 256 + Number(o), 0)
    expect(rangeToBlocks(ip('10.0.0.32'), ip('10.0.0.255')).map((b) => `${b.network}/${b.cidr}`)).toEqual([
      '10.0.0.32/27',
      '10.0.0.64/26',
      '10.0.0.128/25',
    ])
    expect(rangeToBlocks(0, 2 ** 32 - 1)).toEqual([{ network: '0.0.0.0', cidr: 0, totalAddresses: 2 ** 32 }])
  })
})

describe('export', () => {
  const r = planNetwork([req('Management', 20, 10), req('Server', 50, 20)], octet)

  it('CSV has the spec columns, CRLF lines, and escapes dangerous cells', () => {
    const csv = planToCsv(r.subnets)
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe('Name,VLAN,Hosts Needed,Network,CIDR,Subnet Mask,Gateway,First IP,Last IP,Broadcast,Total Hosts,Available Hosts')
    expect(lines[1]).toBe('Management,10,20,10.10.10.0,/27,255.255.255.224,10.10.10.1,10.10.10.2,10.10.10.30,10.10.10.31,30,29')
    const tricky = planNetwork([req('=HYPERLINK("x"),a', 5)], vlsm).subnets
    expect(planToCsv(tricky).split('\r\n')[1]).toMatch(/^"'=HYPERLINK\(""x""\),a",/)
  })

  it('TSV pastes into spreadsheets; JSON round-trips', () => {
    expect(planToTsv(r.subnets).split('\n')[1]?.split('\t')).toHaveLength(12)
    const json = JSON.parse(planToJson('DGX Spark Lab', octet, r))
    expect(json).toMatchObject({ project: 'DGX Spark Lab', base: '10.10.0.0/16', strategy: 'vlan-octet' })
    expect(json.subnets[0]).toMatchObject({ name: 'Management', network: '10.10.10.0', cidr: 27, gateway: '10.10.10.1' })
  })

  it('builds a Network Simulator topology with no configuration issues', () => {
    const plan = planNetwork([req('Management', 20, 10), req('Server', 50, 20), req('Storage', 30, 30)], octet)
    const topo = planToTopology('DGX Spark Lab', plan.subnets)
    expect(topo.devices).toHaveLength(5)
    expect(topo.devices[0]).toMatchObject({ type: 'router', ip: '10.10.10.1', interfaces: ['10.10.20.1/26', '10.10.30.1/26'] })
    expect(checkTopology(topo.devices, topo.links)).toEqual([])
  })
})
