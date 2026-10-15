import type { AddressPurpose, RackItem } from '@/types/project'
import { intToIp, ipToInt, isInSubnet, isValidIPv4 } from './network'
import type { PlannedSubnet } from './planner'

/** One address configured on a rack device. */
export interface IpUse {
  itemId: string
  name: string
  /** Primary IP, BMC IP, or one of the further addresses (then `purpose` says which). */
  field: 'ip' | 'mgmtIp' | 'extra'
  purpose: AddressPurpose | null
  /** Unique per address, for list keys. */
  key: string
  address: string
  /** Why this address cannot be used as configured. */
  issue: 'network' | 'broadcast' | 'gateway' | 'duplicate' | null
  /** The device holds the subnet's gateway address (a firewall / router / L3 switch acting as gateway). */
  isGateway: boolean
}

/** Devices that may legitimately own a subnet's gateway address. */
const GATEWAY_TYPES = new Set(['firewall', 'router', 'switch'])

export interface SubnetUsage {
  subnet: PlannedSubnet
  uses: IpUse[]
  /** Lowest host address that is neither the gateway nor taken by a device; null when the subnet is full. */
  nextFree: string | null
}

export interface IpPlanUsage {
  subnets: SubnetUsage[]
  /** Valid IPv4 addresses on devices that sit in no planned subnet. */
  outside: IpUse[]
  /** Values that are not IPv4 addresses at all. */
  invalid: IpUse[]
  /** Count of addresses with an issue, across all lists. */
  problems: number
}

/** Ties the project's IP plan to the rack devices: who uses which subnet, conflicts, and the next free address. */
export function ipPlanUsage(subnets: PlannedSubnet[], items: RackItem[]): IpPlanUsage {
  const all: (IpUse & { type: string })[] = []
  for (const item of items) {
    const name = item.hostname || item.name
    for (const field of ['ip', 'mgmtIp'] as const) {
      const address = item[field].trim()
      if (address) all.push({ itemId: item.id, name, field, purpose: null, key: `${item.id}-${field}`, address, issue: null, isGateway: false, type: item.type })
    }
    for (const a of item.addresses) {
      const address = a.address.trim()
      if (address) all.push({ itemId: item.id, name, field: 'extra', purpose: a.purpose, key: `${item.id}-${a.id}`, address, issue: null, isGateway: false, type: item.type })
    }
  }

  const seen = new Map<string, number>()
  for (const u of all) if (isValidIPv4(u.address)) seen.set(u.address, (seen.get(u.address) ?? 0) + 1)
  for (const u of all) if ((seen.get(u.address) ?? 0) > 1) u.issue = 'duplicate'

  const usage: SubnetUsage[] = subnets.map((subnet) => ({ subnet, uses: [], nextFree: null }))
  const outside: IpUse[] = []
  const invalid: IpUse[] = []
  for (const u of all) {
    if (!isValidIPv4(u.address)) {
      invalid.push(u)
      continue
    }
    const ip = ipToInt(u.address)
    const home = usage.find((s) => isInSubnet(ip, ipToInt(s.subnet.network), s.subnet.cidr))
    if (!home) {
      outside.push(u)
      continue
    }
    if (u.address === home.subnet.gateway) u.isGateway = true
    if (!u.issue) {
      if (u.address === home.subnet.network) u.issue = 'network'
      else if (u.address === home.subnet.broadcast) u.issue = 'broadcast'
      // A server on the gateway address steals it; the firewall / router that routes the VLAN is expected there.
      else if (u.isGateway && !(u.field === 'ip' && GATEWAY_TYPES.has(u.type))) u.issue = 'gateway'
    }
    home.uses.push(u)
  }

  for (const s of usage) {
    s.uses.sort((a, b) => ipToInt(a.address) - ipToInt(b.address))
    s.nextFree = nextFree(s.subnet, new Set(s.uses.map((u) => u.address)))
  }

  for (const u of all) delete (u as Partial<typeof u>).type
  return {
    subnets: usage,
    outside,
    invalid,
    problems: all.filter((u) => u.issue).length + outside.length + invalid.length,
  }
}

function nextFree(subnet: PlannedSubnet, taken: Set<string>): string | null {
  if (!isValidIPv4(subnet.firstIp) || !isValidIPv4(subnet.lastIp)) return null
  const last = ipToInt(subnet.lastIp)
  // Large subnets: the first few thousand addresses are plenty to find a gap on a real project.
  const stop = Math.min(last, ipToInt(subnet.firstIp) + 65_536)
  for (let n = ipToInt(subnet.firstIp); n <= stop; n++) {
    const ip = intToIp(n >>> 0)
    if (ip !== subnet.gateway && !taken.has(ip)) return ip
  }
  return null
}
