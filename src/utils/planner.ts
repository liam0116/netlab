/**
 * IP address planning: turns "VLAN X needs N hosts" into concrete subnets.
 *
 * Strategies
 *  - vlsm:       pack subnets into the base network, largest requirement first (each block lands on
 *                a boundary of its own size because larger blocks are placed before smaller ones)
 *  - vlan-octet: the VLAN ID becomes the third octet, e.g. VLAN 10 in 10.10.0.0/16 → 10.10.10.0/27
 *
 * All arithmetic is uint32 / bitwise via utils/network.ts.
 */
import type { TopoDevice, TopoLink } from '@/types/topology'
import { macFromIp } from './mac'
import { toCsv } from './csv'
import {
  calculateSubnet,
  cidrToMaskInt,
  getTotalAddresses,
  getUsableHosts,
  hostsToCidr,
  intToIp,
  ipToInt,
  parseCidrNotation,
} from './network'

export type PlanStrategy = 'vlsm' | 'vlan-octet'
export type GatewayPosition = 'first' | 'last'

export interface PlanRequirement {
  id: string
  name: string
  vlan: number | null
  hosts: number
}

export interface PlanOptions {
  base: string
  strategy: PlanStrategy
  gateway: GatewayPosition
  /** Extra capacity on top of the requested hosts, in percent. */
  growthPercent: number
  /** Count the gateway as one of the addresses the subnet must hold. */
  reserveGateway: boolean
}

export interface PlannedSubnet {
  requirementId: string
  name: string
  vlan: number | null
  requestedHosts: number
  /** Addresses the subnet must hold: hosts + growth (+ gateway). */
  requiredAddresses: number
  cidr: number
  network: string
  subnetMask: string
  wildcardMask: string
  gateway: string
  /** First / last address assignable to hosts (the gateway excluded). */
  firstIp: string
  lastIp: string
  broadcast: string
  totalAddresses: number
  /** 2^n − 2: every address except network and broadcast. */
  totalHosts: number
  /** totalHosts minus the gateway. */
  availableHosts: number
  /** Spare host addresses after the requested hosts. */
  spare: number
  hostBits: number
}

export type PlanIssueCode =
  | 'invalid-base'
  | 'base-normalized'
  | 'no-requirements'
  | 'invalid-hosts'
  | 'invalid-vlan'
  | 'duplicate-vlan'
  | 'duplicate-name'
  | 'missing-vlan'
  | 'vlan-octet-range'
  | 'octet-base-too-small'
  | 'octet-too-many-hosts'
  | 'subnet-too-large'
  | 'does-not-fit'

export interface PlanIssue {
  level: 'error' | 'warning'
  code: PlanIssueCode
  requirementId?: string
  params: Record<string, string>
}

export interface FreeBlock {
  network: string
  cidr: number
  totalAddresses: number
}

export interface PlanResult {
  ok: boolean
  base: { network: string; cidr: number; totalAddresses: number } | null
  subnets: PlannedSubnet[]
  issues: PlanIssue[]
  free: FreeBlock[]
  usedAddresses: number
  /** Percentage of the base network allocated, 0–100. */
  utilization: number
}

export function requiredAddresses(hosts: number, growthPercent: number, reserveGateway: boolean): number {
  return Math.ceil(hosts * (1 + Math.max(0, growthPercent) / 100)) + (reserveGateway ? 1 : 0)
}

function buildSubnet(req: PlanRequirement, networkInt: number, cidr: number, opts: PlanOptions): PlannedSubnet {
  const info = calculateSubnet(intToIp(networkInt), cidr)
  const first = ipToInt(info.firstHost)
  const last = ipToInt(info.lastHost)
  const totalHosts = getUsableHosts(cidr)
  const gatewayFirst = opts.gateway === 'first'
  const gateway = gatewayFirst ? first : last
  const firstIp = gatewayFirst ? first + 1 : first
  const lastIp = gatewayFirst ? last : last - 1
  return {
    requirementId: req.id,
    name: req.name,
    vlan: req.vlan,
    requestedHosts: req.hosts,
    requiredAddresses: requiredAddresses(req.hosts, opts.growthPercent, opts.reserveGateway),
    cidr,
    network: info.networkAddress,
    subnetMask: info.subnetMask,
    wildcardMask: info.wildcardMask,
    gateway: intToIp(gateway),
    firstIp: intToIp(firstIp >>> 0),
    lastIp: intToIp(lastIp >>> 0),
    broadcast: info.broadcastAddress,
    totalAddresses: getTotalAddresses(cidr),
    totalHosts,
    availableHosts: totalHosts - 1,
    spare: totalHosts - 1 - req.hosts,
    hostBits: 32 - cidr,
  }
}

/** Splits [start, end] (inclusive, uint32) into the fewest aligned CIDR blocks. */
export function rangeToBlocks(start: number, end: number): FreeBlock[] {
  const blocks: FreeBlock[] = []
  let cur = start
  while (cur <= end) {
    // Largest block aligned at `cur` that does not pass `end`.
    let size = cur === 0 ? 2 ** 32 : 2 ** Math.min(32, countTrailingZeros(cur))
    while (cur + size - 1 > end) size /= 2
    const cidr = 32 - Math.log2(size)
    blocks.push({ network: intToIp(cur), cidr, totalAddresses: size })
    cur += size
  }
  return blocks
}

function countTrailingZeros(n: number): number {
  let count = 0
  let v = n >>> 0
  while (count < 32 && (v & 1) === 0) {
    v >>>= 1
    count++
  }
  return count
}

function validateRequirements(reqs: PlanRequirement[], opts: PlanOptions, issues: PlanIssue[]): PlanRequirement[] {
  if (reqs.length === 0) issues.push({ level: 'error', code: 'no-requirements', params: {} })
  const valid: PlanRequirement[] = []
  const vlans = new Map<number, string>()
  const names = new Map<string, string>()
  for (const r of reqs) {
    const name = r.name.trim() || '—'
    if (!Number.isInteger(r.hosts) || r.hosts < 1) {
      issues.push({ level: 'error', code: 'invalid-hosts', requirementId: r.id, params: { name, value: String(r.hosts) } })
      continue
    }
    if (r.vlan !== null) {
      if (!Number.isInteger(r.vlan) || r.vlan < 1 || r.vlan > 4094) {
        issues.push({ level: 'error', code: 'invalid-vlan', requirementId: r.id, params: { name, value: String(r.vlan) } })
        continue
      }
      const owner = vlans.get(r.vlan)
      if (owner !== undefined) {
        issues.push({ level: 'error', code: 'duplicate-vlan', requirementId: r.id, params: { name, other: owner, vlan: String(r.vlan) } })
        continue
      }
      vlans.set(r.vlan, name)
    }
    const key = name.toLowerCase()
    if (names.has(key) && name !== '—') issues.push({ level: 'warning', code: 'duplicate-name', requirementId: r.id, params: { name } })
    names.set(key, name)
    const needed = requiredAddresses(r.hosts, opts.growthPercent, opts.reserveGateway)
    if (hostsToCidr(needed) === null || (hostsToCidr(needed) ?? 0) < 1) {
      issues.push({ level: 'error', code: 'subnet-too-large', requirementId: r.id, params: { name, value: String(r.hosts) } })
      continue
    }
    valid.push(r)
  }
  return valid
}

export function planNetwork(reqs: PlanRequirement[], opts: PlanOptions): PlanResult {
  const issues: PlanIssue[] = []
  const parsed = parseCidrNotation(opts.base)
  if (!parsed) {
    issues.push({ level: 'error', code: 'invalid-base', params: { value: opts.base } })
    return { ok: false, base: null, subnets: [], issues, free: [], usedAddresses: 0, utilization: 0 }
  }
  const baseNetwork = (ipToInt(parsed.ip) & cidrToMaskInt(parsed.cidr)) >>> 0
  const baseTotal = getTotalAddresses(parsed.cidr)
  const baseEnd = baseNetwork + baseTotal - 1
  const base = { network: intToIp(baseNetwork), cidr: parsed.cidr, totalAddresses: baseTotal }
  if (intToIp(baseNetwork) !== parsed.ip) {
    issues.push({ level: 'warning', code: 'base-normalized', params: { value: opts.base, network: `${base.network}/${base.cidr}` } })
  }

  const valid = validateRequirements(reqs, opts, issues)
  const subnets: PlannedSubnet[] = []

  if (opts.strategy === 'vlsm') {
    // Largest first; ties keep the order the user entered.
    const sorted = valid
      .map((r, i) => ({ r, i, cidr: hostsToCidr(requiredAddresses(r.hosts, opts.growthPercent, opts.reserveGateway))! }))
      .sort((a, b) => a.cidr - b.cidr || a.i - b.i)
    let cursor = baseNetwork
    for (const { r, cidr } of sorted) {
      const size = getTotalAddresses(cidr)
      if (cidr < parsed.cidr || cursor + size - 1 > baseEnd) {
        issues.push({
          level: 'error',
          code: 'does-not-fit',
          requirementId: r.id,
          params: { name: r.name.trim() || '—', cidr: String(cidr), base: `${base.network}/${base.cidr}` },
        })
        continue
      }
      subnets.push(buildSubnet(r, cursor, cidr, opts))
      cursor += size
    }
    const used = cursor - baseNetwork
    const free = cursor <= baseEnd ? rangeToBlocks(cursor, baseEnd) : []
    return finish(base, subnets, issues, free, used)
  }

  // vlan-octet
  if (parsed.cidr > 16) {
    issues.push({ level: 'error', code: 'octet-base-too-small', params: { network: `${base.network}/${base.cidr}` } })
    return finish(base, subnets, issues, [], 0)
  }
  for (const r of valid) {
    const name = r.name.trim() || '—'
    if (r.vlan === null) {
      issues.push({ level: 'error', code: 'missing-vlan', requirementId: r.id, params: { name } })
      continue
    }
    if (r.vlan > 255) {
      issues.push({ level: 'error', code: 'vlan-octet-range', requirementId: r.id, params: { name, vlan: String(r.vlan) } })
      continue
    }
    const cidr = hostsToCidr(requiredAddresses(r.hosts, opts.growthPercent, opts.reserveGateway))!
    if (cidr < 24) {
      issues.push({ level: 'error', code: 'octet-too-many-hosts', requirementId: r.id, params: { name, cidr: String(cidr) } })
      continue
    }
    // Keep the base's first two octets (or more for /8) and put the VLAN ID in the third octet.
    const network = ((baseNetwork & 0xffff0000) | (r.vlan << 8)) >>> 0
    if (network < baseNetwork || network > baseEnd) {
      issues.push({ level: 'error', code: 'does-not-fit', requirementId: r.id, params: { name, cidr: String(cidr), base: `${base.network}/${base.cidr}` } })
      continue
    }
    subnets.push(buildSubnet(r, network, cidr, opts))
  }
  subnets.sort((a, b) => (a.vlan ?? 0) - (b.vlan ?? 0))
  return finish(base, subnets, issues, [], subnets.reduce((s, x) => s + x.totalAddresses, 0))
}

function finish(base: PlanResult['base'], subnets: PlannedSubnet[], issues: PlanIssue[], free: FreeBlock[], used: number): PlanResult {
  const total = base?.totalAddresses ?? 0
  return {
    ok: !issues.some((i) => i.level === 'error'),
    base,
    subnets,
    issues,
    free,
    usedAddresses: used,
    utilization: total ? Math.round((used / total) * 1000) / 10 : 0,
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const EXPORT_COLUMNS = [
  'Name',
  'VLAN',
  'Hosts Needed',
  'Network',
  'CIDR',
  'Subnet Mask',
  'Gateway',
  'First IP',
  'Last IP',
  'Broadcast',
  'Total Hosts',
  'Available Hosts',
] as const

function row(s: PlannedSubnet): (string | number)[] {
  return [s.name, s.vlan ?? '', s.requestedHosts, s.network, `/${s.cidr}`, s.subnetMask, s.gateway, s.firstIp, s.lastIp, s.broadcast, s.totalHosts, s.availableHosts]
}

export function planToCsv(subnets: PlannedSubnet[]): string {
  return toCsv(EXPORT_COLUMNS, subnets.map(row))
}

/** Tab-separated: pastes straight into Excel / Google Sheets. */
export function planToTsv(subnets: PlannedSubnet[]): string {
  return [EXPORT_COLUMNS.join('\t'), ...subnets.map((s) => row(s).map((v) => String(v).replace(/[\t\n]/g, ' ')).join('\t'))].join('\n')
}

export function planToJson(project: string, opts: PlanOptions, result: PlanResult): string {
  return JSON.stringify(
    {
      project,
      generatedAt: new Date().toISOString(),
      base: result.base ? `${result.base.network}/${result.base.cidr}` : opts.base,
      strategy: opts.strategy,
      gateway: opts.gateway,
      growthPercent: opts.growthPercent,
      subnets: result.subnets.map((s) => ({
        name: s.name,
        vlan: s.vlan,
        hostsNeeded: s.requestedHosts,
        network: s.network,
        cidr: s.cidr,
        subnetMask: s.subnetMask,
        gateway: s.gateway,
        firstIp: s.firstIp,
        lastIp: s.lastIp,
        broadcast: s.broadcast,
        totalHosts: s.totalHosts,
        availableHosts: s.availableHosts,
      })),
      free: result.free.map((f) => `${f.network}/${f.cidr}`),
    },
    null,
    2,
  )
}

// ---------------------------------------------------------------------------
// Network Simulator export
// ---------------------------------------------------------------------------

/**
 * Builds a starter topology from a plan: a router holding every gateway (router-on-a-stick on a
 * trunk), a switch, and one sample host per subnet on an access port of its VLAN.
 */
export function planToTopology(project: string, subnets: PlannedSubnet[]): { devices: TopoDevice[]; links: TopoLink[] } {
  const device = (id: string, type: TopoDevice['type'], name: string, x: number, y: number, extra: Partial<TopoDevice> = {}): TopoDevice => ({
    id, type, name, ip: '', cidr: 24, gateway: '', vlan: null, mac: '', interfaces: [], x, y, ...extra,
  })
  const [first, ...rest] = subnets
  const devices: TopoDevice[] = [
    device('router-1', 'router', `${project || 'Core'} Router`.slice(0, 24), 500, 80, first
      ? { ip: first.gateway, cidr: first.cidr, interfaces: rest.map((s) => `${s.gateway}/${s.cidr}`) }
      : {}),
    device('switch-1', 'switch', 'Access Switch', 500, 230),
  ]
  const links: TopoLink[] = [{ id: 'link-1', a: 'router-1', b: 'switch-1', vlan: null }]
  const n = subnets.length
  subnets.forEach((s, i) => {
    const id = `server-${i + 1}`
    const x = n === 1 ? 500 : 90 + (i * 820) / (n - 1)
    devices.push(
      device(id, 'server', `${s.name || 'Host'}`.slice(0, 18), Math.round(x), i % 2 === 0 ? 400 : 480, {
        ip: s.firstIp,
        cidr: s.cidr,
        gateway: s.gateway,
        vlan: s.vlan,
        mac: macFromIp(s.firstIp),
      }),
    )
    links.push({ id: `link-${i + 2}`, a: 'switch-1', b: id, vlan: s.vlan })
  })
  return { devices, links }
}
