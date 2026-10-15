import { describe, expect, it } from 'vitest'
import { demoProject } from '@/data/demoProject'
import type { RackItem } from '@/types/project'
import { ipPlanUsage } from './ipPlan'
import { planNetwork } from './planner'

const plan = planNetwork(
  [
    { id: 'mgmt', name: 'Management', vlan: 10, hosts: 20 },
    { id: 'srv', name: 'Server', vlan: 20, hosts: 50 },
  ],
  { base: '10.10.0.0/16', strategy: 'vlan-octet', gateway: 'first', growthPercent: 0, reserveGateway: true },
)

const item = (id: string, ip: string, mgmtIp = '', type: RackItem['type'] = 'server'): RackItem => ({
  id,
  rackId: 'r1',
  name: id,
  model: '',
  type,
  uHeight: 1,
  uPosition: 1,
  powerW: 0,
  weightKg: 0,
  psus: 2,
  hostname: '',
  ip,
  mgmtIp,
  addresses: [],
  serial: '',
  assetTag: '',
  os: '',
  notes: '',
  ports: [],
})

describe('ipPlanUsage', () => {
  it('groups device addresses by subnet and suggests the next free address', () => {
    const u = ipPlanUsage(plan.subnets, [item('gpu01', '10.10.20.11', '10.10.10.21'), item('gpu02', '10.10.20.12', '10.10.10.22')])
    const srv = u.subnets.find((s) => s.subnet.name === 'Server')!
    expect(srv.uses.map((x) => `${x.name}:${x.address}`)).toEqual(['gpu01:10.10.20.11', 'gpu02:10.10.20.12'])
    // .1 is the gateway, so the first host address is .2
    expect(srv.nextFree).toBe('10.10.20.2')
    const mgmt = u.subnets.find((s) => s.subnet.name === 'Management')!
    expect(mgmt.uses.map((x) => x.field)).toEqual(['mgmtIp', 'mgmtIp'])
    expect(u.problems).toBe(0)
  })

  it('skips taken addresses when suggesting the next one', () => {
    const u = ipPlanUsage(plan.subnets, [item('a', '10.10.20.2'), item('b', '10.10.20.3')])
    expect(u.subnets.find((s) => s.subnet.name === 'Server')!.nextFree).toBe('10.10.20.4')
  })

  it('flags duplicates, reserved addresses, addresses outside the plan and typos', () => {
    const u = ipPlanUsage(plan.subnets, [
      item('dup1', '10.10.20.50'),
      item('dup2', '10.10.20.50'),
      item('gw', '10.10.20.1'),
      item('fw01', '10.10.10.1', '', 'firewall'),
      item('net', '10.10.20.0'),
      item('bc', '10.10.20.63'),
      item('away', '192.168.1.10'),
      item('typo', '10.10.20.300'),
    ])
    const issues = Object.fromEntries(u.subnets.flatMap((s) => s.uses).map((x) => [x.name, x.issue]))
    expect(issues).toEqual({ dup1: 'duplicate', dup2: 'duplicate', gw: 'gateway', fw01: null, net: 'network', bc: 'broadcast' })
    expect(u.outside.map((x) => x.name)).toEqual(['away'])
    expect(u.invalid.map((x) => x.name)).toEqual(['typo'])
    expect(u.problems).toBe(7)
    // A firewall routing the VLAN is expected on the gateway address.
    const fw = u.subnets.flatMap((s) => s.uses).find((x) => x.name === 'fw01')!
    expect(fw).toMatchObject({ isGateway: true, issue: null })
    expect(Object.keys(fw)).not.toContain('type')
  })

  it('the demo project has every address inside its plan with no conflicts', () => {
    const p = demoProject('zh-TW')
    const u = ipPlanUsage(planNetwork(p.planner.requirements, p.planner.options).subnets, p.rackItems)
    expect(u.problems).toBe(0)
    expect(u.subnets.reduce((n, s) => n + s.uses.length, 0)).toBeGreaterThan(5)
  })

  it('checks extra addresses too, including clashes with another device', () => {
    const a = { ...item('a', '10.10.20.11'), addresses: [{ id: 'x1', purpose: 'vmotion' as const, iface: '', vlan: null, address: '10.10.20.12' }] }
    const b = item('b', '10.10.20.12')
    const usage = ipPlanUsage(plan.subnets, [a, b])
    const extra = usage.subnets[1]!.uses.find((u) => u.field === 'extra')!
    expect(extra).toMatchObject({ purpose: 'vmotion', address: '10.10.20.12', issue: 'duplicate', key: 'a-x1' })
    expect(usage.subnets[1]!.nextFree).toBe('10.10.20.2')
  })
})
