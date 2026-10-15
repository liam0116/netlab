import { describe, expect, it } from 'vitest'
import { buildPacketFlow, DEFAULT_NAT_IP } from './packetFlow'
import { BROADCAST_MAC, macFromIp } from './mac'

describe('buildPacketFlow', () => {
  it('same subnet: ARP for the destination, then deliver through the switch (spec example 1)', () => {
    const flow = buildPacketFlow({ srcIp: '192.168.1.10', srcCidr: 24, gateway: '192.168.1.1', dstIp: '192.168.1.20' })
    expect(flow.scenario).toBe('local')
    expect(flow.nodes).toEqual(['src', 'switch', 'dst'])
    expect(flow.steps.map((s) => s.code)).toEqual([
      'start',
      'check-local',
      'arp-request',
      'arp-flood',
      'arp-reply',
      'send-local',
      'switch-forward',
      'deliver',
    ])
    const arp = flow.steps.find((s) => s.code === 'arp-request')!
    expect(arp.frame).toMatchObject({ kind: 'ARP Request', dstMac: BROADCAST_MAC, dstIp: '192.168.1.20' })
    const send = flow.steps.find((s) => s.code === 'send-local')!
    expect(send.frame?.dstMac).toBe(macFromIp('192.168.1.20'))
    expect(flow.steps.at(-1)?.status).toBe('ok')
  })

  it('Internet: ARP for the gateway, router, NAT, Internet (spec example 2)', () => {
    const flow = buildPacketFlow({ srcIp: '192.168.1.10', srcCidr: 24, gateway: '192.168.1.1', dstIp: '8.8.8.8' })
    expect(flow.scenario).toBe('internet')
    expect(flow.steps.map((s) => s.code)).toEqual([
      'start',
      'check-remote',
      'arp-gateway',
      'arp-gateway-flood',
      'arp-gateway-reply',
      'send-gateway',
      'switch-to-router',
      'router-lookup',
      'nat',
      'to-internet',
      'deliver-remote',
    ])
    // The frame to the gateway carries the gateway's MAC but the final destination IP.
    const send = flow.steps.find((s) => s.code === 'send-gateway')!.frame!
    expect(send.dstMac).toBe(macFromIp('192.168.1.1'))
    expect(send.dstIp).toBe('8.8.8.8')
    expect(flow.steps.find((s) => s.code === 'router-lookup')!.frame!.ttl).toBe(63)
    expect(flow.steps.find((s) => s.code === 'nat')!.params).toEqual({ before: '192.168.1.10', after: DEFAULT_NAT_IP })
    expect(flow.steps.find((s) => s.code === 'to-internet')!.frame!.srcIp).toBe(DEFAULT_NAT_IP)
  })

  it('private remote subnet: routed without NAT', () => {
    const flow = buildPacketFlow({ srcIp: '10.0.1.10', srcCidr: 24, gateway: '10.0.1.1', dstIp: '10.0.2.20' })
    expect(flow.scenario).toBe('routed')
    expect(flow.steps.some((s) => s.code === 'nat')).toBe(false)
    expect(flow.steps.at(-1)).toMatchObject({ code: 'deliver-remote', to: 'remote', status: 'ok' })
  })

  it('public source: no NAT', () => {
    const flow = buildPacketFlow({ srcIp: '198.51.100.10', srcCidr: 24, gateway: '198.51.100.1', dstIp: '8.8.8.8' })
    expect(flow.steps.some((s) => s.code === 'nat')).toBe(false)
    expect(flow.steps.find((s) => s.code === 'to-internet')!.frame!.srcIp).toBe('198.51.100.10')
  })

  it('stops with an error when the gateway is not usable', () => {
    const flow = buildPacketFlow({ srcIp: '192.168.10.50', srcCidr: 24, gateway: '192.168.20.1', dstIp: '8.8.8.8' })
    expect(flow.scenario).toBe('error')
    expect(flow.steps.at(-1)).toMatchObject({ code: 'gateway-invalid', status: 'error', params: { issue: 'outside-subnet' } })
  })

  it('uses the source mask to decide locality', () => {
    expect(buildPacketFlow({ srcIp: '192.168.50.130', srcCidr: 27, gateway: '192.168.50.129', dstIp: '192.168.50.170' }).scenario).toBe('routed')
    expect(buildPacketFlow({ srcIp: '192.168.50.130', srcCidr: 24, gateway: '192.168.50.1', dstIp: '192.168.50.170' }).scenario).toBe('local')
  })
})
