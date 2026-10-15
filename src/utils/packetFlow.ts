/**
 * Builds the step-by-step journey of one packet from a source host to a destination, the way a
 * real IPv4 stack decides it: local subnet → ARP for the destination; otherwise → ARP for the
 * default gateway, router lookup, NAT when a private source goes to a public destination.
 *
 * Steps carry a `code` plus `params`; the UI turns them into localized text.
 */
import type { GatewayIssueCode } from '@/types/network'
import { BROADCAST_MAC, macFromIp } from './mac'
import { calculateSubnet, intToOctets, ipToInt, isInSubnet, validateGateway } from './network'

export type PacketNode = 'src' | 'switch' | 'dst' | 'router' | 'internet' | 'remote'
export type PacketScenario = 'local' | 'routed' | 'internet' | 'error'

export type PacketStepCode =
  | 'start'
  | 'check-local'
  | 'check-remote'
  | 'arp-request'
  | 'arp-flood'
  | 'arp-reply'
  | 'send-local'
  | 'switch-forward'
  | 'deliver'
  | 'arp-gateway'
  | 'arp-gateway-flood'
  | 'arp-gateway-reply'
  | 'send-gateway'
  | 'switch-to-router'
  | 'router-lookup'
  | 'router-forward'
  | 'nat'
  | 'to-internet'
  | 'deliver-remote'
  | 'gateway-invalid'

export interface PacketFrame {
  kind: 'ARP Request' | 'ARP Reply' | 'IPv4'
  srcMac: string
  dstMac: string
  srcIp: string
  dstIp: string
  ttl?: number
}

export interface PacketStep {
  code: PacketStepCode
  from: PacketNode
  to: PacketNode
  status: 'info' | 'ok' | 'error'
  params: Record<string, string>
  frame?: PacketFrame
}

export interface PacketFlowInput {
  srcIp: string
  srcCidr: number
  gateway: string
  dstIp: string
  /** Public address the router NATs private sources to. */
  natIp?: string
}

export interface PacketFlow {
  scenario: PacketScenario
  nodes: PacketNode[]
  steps: PacketStep[]
}

export const DEFAULT_NAT_IP = '203.0.113.10'
const INITIAL_TTL = 64

function isPublic(ip: string): boolean {
  return calculateSubnet(ip, 32).addressType === 'Public'
}

/** MAC of the router's outside interface: 02:01 + the gateway octets, so it differs from the inside MAC. */
function routerEgressMac(gateway: string): string {
  return ['02', '01', ...intToOctets(ipToInt(gateway)).map((o) => o.toString(16).padStart(2, '0'))].join(':')
}

export function buildPacketFlow(input: PacketFlowInput): PacketFlow {
  const { srcIp, srcCidr, gateway, dstIp } = input
  const natIp = input.natIp ?? DEFAULT_NAT_IP
  const src = calculateSubnet(srcIp, srcCidr)
  const srcMac = macFromIp(srcIp)
  const dstNetworkFromSrc = calculateSubnet(dstIp, srcCidr).networkAddress
  const local = isInSubnet(ipToInt(dstIp), ipToInt(srcIp), srcCidr)
  const subnetParams = {
    src: srcIp,
    dst: dstIp,
    mask: src.subnetMask,
    srcNet: `${src.networkAddress}/${srcCidr}`,
    dstNet: `${dstNetworkFromSrc}/${srcCidr}`,
  }

  const steps: PacketStep[] = [{ code: 'start', from: 'src', to: 'src', status: 'info', params: { src: srcIp, dst: dstIp } }]

  if (local) {
    const dstMac = macFromIp(dstIp)
    steps.push(
      { code: 'check-local', from: 'src', to: 'src', status: 'info', params: subnetParams },
      {
        code: 'arp-request',
        from: 'src',
        to: 'switch',
        status: 'info',
        params: { target: dstIp, sender: srcIp },
        frame: { kind: 'ARP Request', srcMac, dstMac: BROADCAST_MAC, srcIp, dstIp },
      },
      {
        code: 'arp-flood',
        from: 'switch',
        to: 'dst',
        status: 'info',
        params: { target: dstIp },
        frame: { kind: 'ARP Request', srcMac, dstMac: BROADCAST_MAC, srcIp, dstIp },
      },
      {
        code: 'arp-reply',
        from: 'dst',
        to: 'src',
        status: 'info',
        params: { target: dstIp, mac: dstMac },
        frame: { kind: 'ARP Reply', srcMac: dstMac, dstMac: srcMac, srcIp: dstIp, dstIp: srcIp },
      },
      {
        code: 'send-local',
        from: 'src',
        to: 'switch',
        status: 'info',
        params: { mac: dstMac },
        frame: { kind: 'IPv4', srcMac, dstMac, srcIp, dstIp, ttl: INITIAL_TTL },
      },
      {
        code: 'switch-forward',
        from: 'switch',
        to: 'dst',
        status: 'info',
        params: { mac: dstMac },
        frame: { kind: 'IPv4', srcMac, dstMac, srcIp, dstIp, ttl: INITIAL_TTL },
      },
      { code: 'deliver', from: 'dst', to: 'dst', status: 'ok', params: { dst: dstIp } },
    )
    return { scenario: 'local', nodes: ['src', 'switch', 'dst'], steps }
  }

  steps.push({ code: 'check-remote', from: 'src', to: 'src', status: 'info', params: { ...subnetParams, gateway } })

  const gw = validateGateway(srcIp, srcCidr, gateway)
  if (!gw.valid) {
    const issue = gw.issues.find((i) => i.level === 'error')
    steps.push({
      code: 'gateway-invalid',
      from: 'src',
      to: 'src',
      status: 'error',
      params: { gateway, issue: (issue?.code ?? 'outside-subnet') satisfies GatewayIssueCode, srcNet: subnetParams.srcNet },
    })
    return { scenario: 'error', nodes: ['src', 'switch', 'router'], steps }
  }

  const gwMac = macFromIp(gateway)
  const toInternet = isPublic(dstIp)
  const nat = toInternet && !isPublic(srcIp)
  const egressMac = routerEgressMac(gateway)

  steps.push(
    {
      code: 'arp-gateway',
      from: 'src',
      to: 'switch',
      status: 'info',
      params: { gateway, sender: srcIp },
      frame: { kind: 'ARP Request', srcMac, dstMac: BROADCAST_MAC, srcIp, dstIp: gateway },
    },
    {
      code: 'arp-gateway-flood',
      from: 'switch',
      to: 'router',
      status: 'info',
      params: { gateway },
      frame: { kind: 'ARP Request', srcMac, dstMac: BROADCAST_MAC, srcIp, dstIp: gateway },
    },
    {
      code: 'arp-gateway-reply',
      from: 'router',
      to: 'src',
      status: 'info',
      params: { gateway, mac: gwMac },
      frame: { kind: 'ARP Reply', srcMac: gwMac, dstMac: srcMac, srcIp: gateway, dstIp: srcIp },
    },
    {
      code: 'send-gateway',
      from: 'src',
      to: 'switch',
      status: 'info',
      params: { mac: gwMac, dst: dstIp },
      frame: { kind: 'IPv4', srcMac, dstMac: gwMac, srcIp, dstIp, ttl: INITIAL_TTL },
    },
    {
      code: 'switch-to-router',
      from: 'switch',
      to: 'router',
      status: 'info',
      params: { mac: gwMac },
      frame: { kind: 'IPv4', srcMac, dstMac: gwMac, srcIp, dstIp, ttl: INITIAL_TTL },
    },
    {
      code: 'router-lookup',
      from: 'router',
      to: 'router',
      status: 'info',
      params: { dst: dstIp, ttl: String(INITIAL_TTL - 1) },
      frame: { kind: 'IPv4', srcMac, dstMac: gwMac, srcIp, dstIp, ttl: INITIAL_TTL - 1 },
    },
  )

  if (!toInternet) {
    const dstMac = macFromIp(dstIp)
    steps.push(
      {
        code: 'router-forward',
        from: 'router',
        to: 'remote',
        status: 'info',
        params: { dst: dstIp, srcMac: egressMac, dstMac },
        frame: { kind: 'IPv4', srcMac: egressMac, dstMac, srcIp, dstIp, ttl: INITIAL_TTL - 1 },
      },
      { code: 'deliver-remote', from: 'remote', to: 'remote', status: 'ok', params: { dst: dstIp, src: srcIp } },
    )
    return { scenario: 'routed', nodes: ['src', 'switch', 'router', 'remote'], steps }
  }

  const outsideSrc = nat ? natIp : srcIp
  if (nat) {
    steps.push({
      code: 'nat',
      from: 'router',
      to: 'router',
      status: 'info',
      params: { before: srcIp, after: natIp },
      frame: { kind: 'IPv4', srcMac: egressMac, dstMac: '(ISP)', srcIp: natIp, dstIp, ttl: INITIAL_TTL - 1 },
    })
  }
  steps.push(
    {
      code: 'to-internet',
      from: 'router',
      to: 'internet',
      status: 'info',
      params: { src: outsideSrc, dst: dstIp },
      frame: { kind: 'IPv4', srcMac: egressMac, dstMac: '(ISP)', srcIp: outsideSrc, dstIp, ttl: INITIAL_TTL - 1 },
    },
    { code: 'deliver-remote', from: 'internet', to: 'remote', status: 'ok', params: { dst: dstIp, src: outsideSrc } },
  )
  return { scenario: 'internet', nodes: ['src', 'switch', 'router', 'internet', 'remote'], steps }
}
