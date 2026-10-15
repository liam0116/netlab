/**
 * Rack elevation logic: U placement, overlap / bounds checks, power per PDU feed (including the
 * failover case where one feed is lost), weight and heat output.
 */
import type { Rack, RackItem, RackItemType, RackPort } from '@/types/project'

export const BTU_PER_WATT = 3.412

export interface RackTemplate {
  type: RackItemType
  model: string
  uHeight: number
  powerW: number
  weightKg: number
  psus: number
  ports: RackPort[]
}

const range = (prefix: string, from: number, to: number, speed: number): RackPort[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ name: `${prefix}${from + i}`, speed }))

/** Typical devices; values are sensible defaults, editable per item. */
export const RACK_TEMPLATES: Record<string, RackTemplate> = {
  'server-1u': { type: 'server', model: '1U Server', uHeight: 1, powerW: 450, weightKg: 18, psus: 2, ports: [{ name: 'BMC', speed: 1 }, { name: 'ens1f0', speed: 25 }, { name: 'ens1f1', speed: 25 }] },
  'server-2u': { type: 'server', model: '2U Server', uHeight: 2, powerW: 750, weightKg: 28, psus: 2, ports: [{ name: 'BMC', speed: 1 }, { name: 'ens1f0', speed: 25 }, { name: 'ens1f1', speed: 25 }, { name: 'ens2f0', speed: 25 }, { name: 'ens2f1', speed: 25 }] },
  'gpu-8u': { type: 'gpu-server', model: '8U GPU Server (8× GPU)', uHeight: 8, powerW: 10200, weightKg: 130, psus: 6, ports: [{ name: 'BMC', speed: 1 }, { name: 'eth0', speed: 100 }, { name: 'eth1', speed: 100 }, ...range('ib', 0, 7, 400)] },
  'storage-2u': { type: 'storage', model: '2U Storage (24× NVMe)', uHeight: 2, powerW: 1100, weightKg: 32, psus: 2, ports: [{ name: 'BMC', speed: 1 }, { name: 'eth0', speed: 100 }, { name: 'eth1', speed: 100 }] },
  // Hyperconverged node: compute + local SSDs pooled by vSAN / Nutanix / Ceph; storage traffic on its own pair of NICs.
  'hci-node-2u': { type: 'server', model: '2U HCI Node (10× NVMe)', uHeight: 2, powerW: 900, weightKg: 30, psus: 2, ports: [{ name: 'BMC', speed: 1 }, { name: 'ens1f0', speed: 25 }, { name: 'ens1f1', speed: 25 }, { name: 'ens2f0', speed: 25 }, { name: 'ens2f1', speed: 25 }] },
  // External storage for three-tier / dHCI: two controllers, each with FC and iSCSI (25G) ports.
  'san-array-2u': {
    type: 'storage',
    model: '2U SAN Array (dual controller, 24× SSD)',
    uHeight: 2,
    powerW: 900,
    weightKg: 35,
    psus: 2,
    ports: [
      { name: 'A-MGMT', speed: 1 },
      { name: 'B-MGMT', speed: 1 },
      { name: 'A-FC0', speed: 32 },
      { name: 'A-FC1', speed: 32 },
      { name: 'B-FC0', speed: 32 },
      { name: 'B-FC1', speed: 32 },
      { name: 'A-ETH0', speed: 25 },
      { name: 'A-ETH1', speed: 25 },
      { name: 'B-ETH0', speed: 25 },
      { name: 'B-ETH1', speed: 25 },
    ],
  },
  'disk-shelf-2u': { type: 'storage', model: '2U Expansion Shelf (24× SSD)', uHeight: 2, powerW: 450, weightKg: 25, psus: 2, ports: [{ name: 'SAS-A', speed: 12 }, { name: 'SAS-B', speed: 12 }] },
  'storage-4u': { type: 'storage', model: '4U Storage (60× HDD)', uHeight: 4, powerW: 1400, weightKg: 75, psus: 2, ports: [{ name: 'BMC', speed: 1 }, { name: 'eth0', speed: 25 }, { name: 'eth1', speed: 25 }] },
  // 12 drive bays arranged 3 rows × 4 on the front; usually RAID 6 / SHR-2 (see /learn/raid).
  'nas-12bay': { type: 'storage', model: '2U NAS 12-bay (3×4)', uHeight: 2, powerW: 250, weightKg: 20, psus: 2, ports: [{ name: 'LAN1', speed: 1 }, { name: 'LAN2', speed: 1 }, { name: '10GbE-1', speed: 10 }, { name: '10GbE-2', speed: 10 }] },
  'switch-25g': { type: 'switch', model: '1U Switch 48×25G + 8×100G', uHeight: 1, powerW: 350, weightKg: 9, psus: 2, ports: [...range('Eth1/', 1, 48, 25), ...range('Eth1/', 49, 56, 100)] },
  'switch-100g': { type: 'switch', model: '1U Switch 32×100G', uHeight: 1, powerW: 450, weightKg: 9, psus: 2, ports: range('Eth1/', 1, 32, 100) },
  // GPU compute fabric (e.g. NVIDIA Quantum-2 NDR); carries GPU-to-GPU traffic only.
  'ib-switch': { type: 'switch', model: '1U InfiniBand Switch 64×400G', uHeight: 1, powerW: 1100, weightKg: 14, psus: 2, ports: range('ib', 1, 64, 400) },
  'fc-switch': { type: 'switch', model: '1U FC Switch 24×32G', uHeight: 1, powerW: 150, weightKg: 8, psus: 2, ports: range('fc', 0, 23, 32) },
  'mgmt-switch': { type: 'mgmt-switch', model: '1U Switch 48×1G', uHeight: 1, powerW: 60, weightKg: 4, psus: 1, ports: range('Gi1/0/', 1, 48, 1) },
  firewall: { type: 'firewall', model: '1U Firewall', uHeight: 1, powerW: 150, weightKg: 6, psus: 2, ports: range('port', 1, 8, 10) },
  'patch-panel': { type: 'patch-panel', model: '1U Patch Panel 24P', uHeight: 1, powerW: 0, weightKg: 1, psus: 0, ports: range('P', 1, 24, 10) },
  ups: { type: 'ups', model: '2U UPS 3kVA', uHeight: 2, powerW: 0, weightKg: 30, psus: 0, ports: [] },
  kvm: { type: 'kvm', model: '1U KVM Console', uHeight: 1, powerW: 30, weightKg: 12, psus: 1, ports: [] },
  blank: { type: 'blank', model: 'Blank Panel', uHeight: 1, powerW: 0, weightKg: 0.5, psus: 0, ports: [] },
}

/**
 * Limits for the editable rack and device fields. Zero is not allowed where it makes no sense
 * (a 0U rack, a 0 V feed); 0 W / 0 kg devices (patch panels, blanks) are fine.
 */
export const RACK_LIMITS = {
  heightU: { min: 1, max: 60, integer: true },
  pduCapacityW: { min: 100, max: 100000 },
  voltage: { min: 100, max: 480 },
  maxWeightKg: { min: 10, max: 5000 },
} as const

export const ITEM_LIMITS = {
  uPosition: { min: 1, max: 60, integer: true },
  uHeight: { min: 1, max: 20, integer: true },
  powerW: { min: 0, max: 50000 },
  weightKg: { min: 0, max: 2000 },
  psus: { min: 0, max: 8, integer: true },
} as const

export function itemTop(item: RackItem): number {
  return item.uPosition + item.uHeight - 1
}

/** Lowest U where an item of `height` fits, or null if the rack is full. */
export function firstFreeU(rack: Rack, items: RackItem[], height: number, ignoreId?: string): number | null {
  const taken = occupancy(rack, items.filter((i) => i.id !== ignoreId))
  for (let u = 1; u + height - 1 <= rack.heightU; u++) {
    let free = true
    for (let k = u; k < u + height; k++) if (taken.has(k)) free = false
    if (free) return u
  }
  return null
}

/** U → item ids occupying it (only items in this rack). */
export function occupancy(rack: Rack, items: RackItem[]): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const it of items) {
    if (it.rackId !== rack.id) continue
    for (let u = it.uPosition; u <= itemTop(it); u++) map.set(u, [...(map.get(u) ?? []), it.id])
  }
  return map
}

export interface RackTotals {
  powerW: number
  amps: number
  btuPerHour: number
  weightKg: number
  usedU: number
  freeU: number
  /** Normal load on each feed. */
  feedA: number
  feedB: number
  /** Load on the surviving feed when the other one fails. */
  failoverA: number
  failoverB: number
}

/**
 * Feed model: a device with 2+ PSUs splits its load evenly across A and B, and moves all of it to
 * the surviving feed on failure. Single-PSU devices sit on feed A and go dark if A fails.
 */
export function rackTotals(rack: Rack, items: RackItem[]): RackTotals {
  const inRack = items.filter((i) => i.rackId === rack.id)
  let feedA = 0
  let feedB = 0
  let dual = 0
  let singleA = 0
  for (const it of inRack) {
    if (it.psus >= 2) {
      feedA += it.powerW / 2
      feedB += it.powerW / 2
      dual += it.powerW
    } else if (it.psus === 1) {
      feedA += it.powerW
      singleA += it.powerW
    }
  }
  const powerW = feedA + feedB
  const usedU = inRack.reduce((s, i) => s + i.uHeight, 0)
  return {
    powerW,
    amps: rack.voltage > 0 ? powerW / rack.voltage : 0,
    btuPerHour: powerW * BTU_PER_WATT,
    weightKg: inRack.reduce((s, i) => s + i.weightKg, 0),
    usedU,
    freeU: rack.heightU - usedU,
    feedA,
    feedB,
    // Feed B fails → A carries all dual-PSU load plus its single-PSU devices.
    failoverA: dual + singleA,
    // Feed A fails → B carries the dual-PSU load; single-PSU devices are down.
    failoverB: dual,
  }
}

export type RackIssueCode =
  | 'overlap'
  | 'out-of-bounds'
  | 'feed-overload'
  | 'failover-overload'
  | 'overweight'
  | 'single-psu'
  | 'duplicate-name'

export interface RackIssue {
  level: 'error' | 'warning'
  code: RackIssueCode
  itemIds: string[]
  params: Record<string, string>
}

const NO_POWER: RackItemType[] = ['blank', 'patch-panel', 'ups']

export function checkRack(rack: Rack, items: RackItem[]): RackIssue[] {
  const inRack = items.filter((i) => i.rackId === rack.id)
  const issues: RackIssue[] = []
  const nameOf = (id: string) => inRack.find((i) => i.id === id)?.name ?? id

  for (const it of inRack) {
    if (it.uPosition < 1 || itemTop(it) > rack.heightU) {
      issues.push({ level: 'error', code: 'out-of-bounds', itemIds: [it.id], params: { name: it.name, top: String(itemTop(it)), height: String(rack.heightU) } })
    }
    if (it.psus === 1 && !NO_POWER.includes(it.type)) {
      issues.push({ level: 'warning', code: 'single-psu', itemIds: [it.id], params: { name: it.name } })
    }
  }

  const reported = new Set<string>()
  for (const [u, ids] of occupancy(rack, inRack)) {
    if (ids.length < 2) continue
    const key = [...ids].sort().join('|')
    if (reported.has(key)) continue
    reported.add(key)
    issues.push({ level: 'error', code: 'overlap', itemIds: ids, params: { names: ids.map(nameOf).join(', '), u: String(u) } })
  }

  const t = rackTotals(rack, items)
  const cap = rack.pduCapacityW
  if (cap > 0) {
    for (const [feed, load] of [['A', t.feedA], ['B', t.feedB]] as const) {
      if (load > cap) issues.push({ level: 'error', code: 'feed-overload', itemIds: [], params: { feed, load: String(Math.round(load)), cap: String(cap) } })
    }
    const worst = Math.max(t.failoverA, t.failoverB)
    if (t.feedA <= cap && t.feedB <= cap && worst > cap) {
      issues.push({ level: 'warning', code: 'failover-overload', itemIds: [], params: { load: String(Math.round(worst)), cap: String(cap) } })
    }
  }
  if (rack.maxWeightKg > 0 && t.weightKg > rack.maxWeightKg) {
    issues.push({ level: 'error', code: 'overweight', itemIds: [], params: { weight: String(Math.round(t.weightKg)), max: String(rack.maxWeightKg) } })
  }

  const names = new Map<string, string>()
  for (const it of inRack) {
    const key = it.name.trim().toLowerCase()
    if (!key) continue
    if (names.has(key)) issues.push({ level: 'warning', code: 'duplicate-name', itemIds: [names.get(key)!, it.id], params: { name: it.name } })
    else names.set(key, it.id)
  }

  const order = { error: 0, warning: 1 }
  return issues.sort((a, b) => order[a.level] - order[b.level])
}
