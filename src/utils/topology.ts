/**
 * Static configuration checks for the Network Topology Simulator.
 *
 * L2 model: switches join everything plugged into them. An access port (link.vlan set) puts the
 * device on that VLAN; a host's effective VLAN is the port VLAN, else its own NIC VLAN, else 1.
 * Two hosts share a broadcast domain when connected through switches with the same effective VLAN.
 */
import type { DeviceType, TopoDevice, TopoIssue, TopoLink } from '@/types/topology'
import { isValidMac, normalizeMac } from './mac'
import { calculateSubnet, ipToInt, isInSubnet, isValidIPv4, parseCidrNotation, validateGateway } from './network'

export const L3_TYPES: DeviceType[] = ['router', 'firewall']
export const HOST_TYPES: DeviceType[] = ['server', 'storage', 'client']

export function isHost(d: TopoDevice): boolean {
  return HOST_TYPES.includes(d.type)
}

/** All addresses ("ip/cidr") a device owns: primary + extra interfaces, valid ones only. */
export function deviceAddresses(d: TopoDevice): { ip: string; cidr: number }[] {
  const list: { ip: string; cidr: number }[] = []
  if (isValidIPv4(d.ip)) list.push({ ip: d.ip.trim(), cidr: d.cidr })
  for (const raw of d.interfaces) {
    const parsed = parseCidrNotation(raw)
    if (parsed) list.push(parsed)
  }
  return list
}

function neighbours(id: string, links: TopoLink[]): { other: string; link: TopoLink }[] {
  return links.flatMap((l) => (l.a === id ? [{ other: l.b, link: l }] : l.b === id ? [{ other: l.a, link: l }] : []))
}

/** VLAN a device participates in on a given link (port VLAN wins over NIC VLAN). */
function effectiveVlan(device: TopoDevice, link: TopoLink): number {
  return link.vlan ?? device.vlan ?? 1
}

/**
 * Broadcast domain membership: for every non-switch device, the set of other non-switch devices
 * reachable through switches on the same VLAN. Routers / firewalls attached on a trunk port
 * (no access VLAN) are considered present on every VLAN of that switch fabric.
 */
export function broadcastDomains(devices: TopoDevice[], links: TopoLink[]): Map<string, Set<string>> {
  const byId = new Map(devices.map((d) => [d.id, d]))
  const isSwitch = (id: string) => byId.get(id)?.type === 'switch'

  // Each non-switch device attachment: (device, switch, vlan | 'trunk').
  const attachments: { device: string; fabric: string; vlan: number | 'trunk' }[] = []
  const fabricOf = new Map<string, string>()
  // Group switches into fabrics (connected components of switch-to-switch links).
  for (const d of devices.filter((x) => x.type === 'switch')) {
    if (fabricOf.has(d.id)) continue
    const stack = [d.id]
    while (stack.length) {
      const cur = stack.pop()!
      if (fabricOf.has(cur)) continue
      fabricOf.set(cur, d.id)
      for (const n of neighbours(cur, links)) if (isSwitch(n.other) && !fabricOf.has(n.other)) stack.push(n.other)
    }
  }
  for (const link of links) {
    for (const [sw, dev] of [
      [link.a, link.b],
      [link.b, link.a],
    ] as const) {
      const device = byId.get(dev)
      if (!isSwitch(sw) || !device || device.type === 'switch') continue
      const trunk = L3_TYPES.includes(device.type) && link.vlan === null
      attachments.push({ device: dev, fabric: fabricOf.get(sw)!, vlan: trunk ? 'trunk' : effectiveVlan(device, link) })
    }
  }

  const domains = new Map<string, Set<string>>()
  for (const d of devices) if (d.type !== 'switch') domains.set(d.id, new Set())
  for (const x of attachments) {
    for (const y of attachments) {
      if (x.device === y.device || x.fabric !== y.fabric) continue
      if (x.vlan === 'trunk' || y.vlan === 'trunk' || x.vlan === y.vlan) domains.get(x.device)!.add(y.device)
    }
  }
  // Directly cabled non-switch devices also share a segment.
  for (const link of links) {
    const a = byId.get(link.a)
    const b = byId.get(link.b)
    if (a && b && a.type !== 'switch' && b.type !== 'switch') {
      domains.get(a.id)!.add(b.id)
      domains.get(b.id)!.add(a.id)
    }
  }
  return domains
}

export function checkTopology(devices: TopoDevice[], links: TopoLink[]): TopoIssue[] {
  const issues: TopoIssue[] = []
  const byId = new Map(devices.map((d) => [d.id, d]))

  // --- Field validation ---------------------------------------------------
  for (const d of devices) {
    if (d.ip.trim() && !isValidIPv4(d.ip)) issues.push({ level: 'error', code: 'invalid-ip', deviceIds: [d.id], params: { name: d.name, value: d.ip } })
    if (d.gateway.trim() && !isValidIPv4(d.gateway))
      issues.push({ level: 'error', code: 'invalid-gateway', deviceIds: [d.id], params: { name: d.name, value: d.gateway } })
    if (d.mac.trim() && !isValidMac(d.mac)) issues.push({ level: 'error', code: 'invalid-mac', deviceIds: [d.id], params: { name: d.name, value: d.mac } })
    if (d.vlan !== null && !(Number.isInteger(d.vlan) && d.vlan >= 1 && d.vlan <= 4094))
      issues.push({ level: 'error', code: 'invalid-vlan', deviceIds: [d.id], params: { name: d.name, value: String(d.vlan) } })
    for (const raw of d.interfaces) {
      if (raw.trim() && !parseCidrNotation(raw))
        issues.push({ level: 'error', code: 'invalid-interface', deviceIds: [d.id], params: { name: d.name, value: raw } })
    }
  }
  for (const l of links) {
    if (l.vlan !== null && !(Number.isInteger(l.vlan) && l.vlan >= 1 && l.vlan <= 4094)) {
      issues.push({ level: 'error', code: 'invalid-vlan', deviceIds: [l.a, l.b], linkId: l.id, params: { name: linkName(l), value: String(l.vlan) } })
    }
  }

  // --- Duplicates ---------------------------------------------------------
  const ipOwners = new Map<string, string[]>()
  for (const d of devices) {
    for (const addr of deviceAddresses(d)) ipOwners.set(addr.ip, [...(ipOwners.get(addr.ip) ?? []), d.id])
  }
  for (const [ip, owners] of ipOwners) {
    const unique = [...new Set(owners)]
    if (unique.length > 1)
      issues.push({ level: 'error', code: 'duplicate-ip', deviceIds: unique, params: { value: ip, names: names(unique) } })
  }
  const macOwners = new Map<string, string[]>()
  for (const d of devices) {
    const mac = normalizeMac(d.mac)
    if (mac) macOwners.set(mac, [...(macOwners.get(mac) ?? []), d.id])
  }
  for (const [mac, owners] of macOwners) {
    if (owners.length > 1) issues.push({ level: 'error', code: 'duplicate-mac', deviceIds: owners, params: { value: mac, names: names(owners) } })
  }

  // --- VLAN mismatch on access ports -------------------------------------------
  for (const l of links) {
    const a = byId.get(l.a)
    const b = byId.get(l.b)
    if (!a || !b || l.vlan === null) continue
    const host = a.type === 'switch' ? b : b.type === 'switch' ? a : null
    if (host && host.type !== 'switch' && host.vlan !== null && host.vlan !== l.vlan) {
      issues.push({
        level: 'error',
        code: 'vlan-mismatch',
        deviceIds: [host.id],
        linkId: l.id,
        params: { name: host.name, deviceVlan: String(host.vlan), portVlan: String(l.vlan) },
      })
    }
  }

  // --- Gateway checks -------------------------------------------------------
  const domains = broadcastDomains(devices, links)
  for (const d of devices.filter(isHost)) {
    if (!isValidIPv4(d.ip)) continue
    if (!d.gateway.trim()) {
      issues.push({ level: 'warning', code: 'missing-gateway', deviceIds: [d.id], params: { name: d.name } })
      continue
    }
    if (!isValidIPv4(d.gateway)) continue
    const gw = validateGateway(d.ip, d.cidr, d.gateway)
    if (!gw.valid) {
      issues.push({
        level: 'error',
        code: 'gateway-outside-subnet',
        deviceIds: [d.id],
        params: {
          name: d.name,
          gateway: d.gateway,
          network: `${gw.server.networkAddress}/${d.cidr}`,
          issue: gw.issues[0]?.code ?? 'outside-subnet',
        },
      })
      continue
    }
    const owner = devices.find((x) => x.id !== d.id && deviceAddresses(x).some((a) => a.ip === d.gateway.trim()))
    if (!owner) {
      issues.push({ level: 'warning', code: 'gateway-not-found', deviceIds: [d.id], params: { name: d.name, gateway: d.gateway } })
    } else if (!domains.get(d.id)?.has(owner.id)) {
      issues.push({
        level: 'error',
        code: 'gateway-not-adjacent',
        deviceIds: [d.id, owner.id],
        params: { name: d.name, gateway: d.gateway, owner: owner.name },
      })
    }
  }

  // --- Same broadcast domain, different subnets ------------------------------
  const reported = new Set<string>()
  for (const d of devices.filter(isHost)) {
    if (!isValidIPv4(d.ip)) continue
    for (const otherId of domains.get(d.id) ?? []) {
      const o = byId.get(otherId)
      if (!o || !isHost(o) || !isValidIPv4(o.ip)) continue
      const key = [d.id, o.id].sort().join('|')
      if (reported.has(key)) continue
      const same = d.cidr === o.cidr && isInSubnet(ipToInt(o.ip), ipToInt(d.ip), d.cidr)
      if (!same) {
        reported.add(key)
        issues.push({
          level: 'warning',
          code: 'subnet-mismatch-in-vlan',
          deviceIds: [d.id, o.id],
          params: {
            a: d.name,
            b: o.name,
            netA: `${calculateSubnet(d.ip, d.cidr).networkAddress}/${d.cidr}`,
            netB: `${calculateSubnet(o.ip, o.cidr).networkAddress}/${o.cidr}`,
          },
        })
      }
    }
  }

  // --- Unconnected devices -------------------------------------------------
  for (const d of devices) {
    if (!links.some((l) => l.a === d.id || l.b === d.id))
      issues.push({ level: 'info', code: 'not-connected', deviceIds: [d.id], params: { name: d.name } })
  }

  const order = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => order[a.level] - order[b.level])

  function names(ids: string[]): string {
    return ids.map((id) => byId.get(id)?.name ?? id).join(', ')
  }
  function linkName(l: TopoLink): string {
    return `${byId.get(l.a)?.name ?? l.a} ↔ ${byId.get(l.b)?.name ?? l.b}`
  }
}
