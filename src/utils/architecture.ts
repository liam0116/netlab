/**
 * One-click rack layouts for common data-center architectures, most common first:
 *   three-tier  compute servers + SAN storage array (FC) + separate networks
 *   hci         hyperconverged nodes: each node is compute and storage, no external array
 *   dhci        disaggregated HCI: compute nodes + an external array over iSCSI, scaled independently
 *   two-node    two HCI nodes for a branch office / small business (witness runs elsewhere)
 *   ceph        software-defined storage cluster on NVMe storage nodes
 *   ai          GPU servers + InfiniBand compute fabric + NVMe storage nodes
 * Placement follows the device guide: switches at the top (ToR), heavy devices at the bottom, the rest in
 * between. When a rack runs out of U, power (one PDU feed lost) or weight, the next rack is opened.
 */
import type { Rack, RackItem, RackItemType, RackPort } from '@/types/project'
import { firstFreeU, RACK_LIMITS, RACK_TEMPLATES, rackTotals } from './rack'

export type ArchitectureKind = 'three-tier' | 'hci' | 'dhci' | 'two-node' | 'ceph' | 'ai'
export const ARCHITECTURES: ArchitectureKind[] = ['three-tier', 'hci', 'dhci', 'two-node', 'ceph', 'ai']

export interface ArchitectureOptions {
  /** Compute hosts, HCI / storage nodes or GPU servers. */
  nodes: number
  /** Second quantity: disk shelves (three-tier, dHCI) or storage nodes (AI). Ignored by the other kinds. */
  storage: number
  heightU: number
  pduCapacityW: number
  voltage: number
  maxWeightKg: number
}

/** What a device is in the architecture; also the order of the bill of materials. */
export type ArchitectureRole = 'compute' | 'hci' | 'gpu' | 'storage-node' | 'array' | 'shelf' | 'tor' | 'fc' | 'fabric' | 'oob' | 'patch'
const ROLE_ORDER: ArchitectureRole[] = ['compute', 'hci', 'gpu', 'storage-node', 'array', 'shelf', 'tor', 'fc', 'fabric', 'oob', 'patch']

interface DeviceSpec {
  role: ArchitectureRole
  template: string
  prefix: string
  /** Extra ports added to the template's, e.g. FC HBAs on three-tier hosts. */
  extraPorts?: RackPort[]
}

interface Limits {
  min: number
  max: number
  default: number
}

interface KindConfig {
  node: DeviceSpec
  nodes: Limits
  /** Devices counted by `storage`; null when the architecture has no second quantity. */
  storage: { spec: DeviceSpec; limits: Limits } | null
  /** External SAN array placed at the bottom of the first rack. */
  array: boolean
  /** Heavy nodes go to the bottom; otherwise storage does. */
  nodesFirst: boolean
  tor: string
  /** A second switch pair in the first rack only (FC fabric, GPU compute fabric). */
  fabric: DeviceSpec | null
  pduCapacityW: number
}

const FC_HBA: RackPort[] = [
  { name: 'hba0', speed: 32 },
  { name: 'hba1', speed: 32 },
]

const D = {
  patch: { role: 'patch', template: 'patch-panel', prefix: 'patch' },
  oob: { role: 'oob', template: 'mgmt-switch', prefix: 'oob-sw' },
  array: { role: 'array', template: 'san-array-2u', prefix: 'san' },
  shelf: { role: 'shelf', template: 'disk-shelf-2u', prefix: 'shelf' },
} satisfies Record<string, DeviceSpec>

const KINDS: Record<ArchitectureKind, KindConfig> = {
  'three-tier': {
    node: { role: 'compute', template: 'server-1u', prefix: 'esx', extraPorts: FC_HBA },
    nodes: { min: 2, max: 64, default: 4 },
    storage: { spec: D.shelf, limits: { min: 0, max: 6, default: 1 } },
    array: true,
    nodesFirst: false,
    tor: 'switch-25g',
    fabric: { role: 'fc', template: 'fc-switch', prefix: 'fc-sw' },
    pduCapacityW: 7000,
  },
  hci: {
    node: { role: 'hci', template: 'hci-node-2u', prefix: 'hci' },
    nodes: { min: 3, max: 64, default: 4 },
    storage: null,
    array: false,
    nodesFirst: true,
    tor: 'switch-25g',
    fabric: null,
    pduCapacityW: 7000,
  },
  dhci: {
    node: { role: 'compute', template: 'server-1u', prefix: 'cmp' },
    nodes: { min: 2, max: 64, default: 3 },
    storage: { spec: D.shelf, limits: { min: 0, max: 6, default: 1 } },
    array: true,
    nodesFirst: false,
    tor: 'switch-25g',
    fabric: null,
    pduCapacityW: 7000,
  },
  'two-node': {
    node: { role: 'hci', template: 'hci-node-2u', prefix: 'node' },
    nodes: { min: 2, max: 2, default: 2 },
    storage: null,
    array: false,
    nodesFirst: true,
    tor: 'switch-25g',
    fabric: null,
    pduCapacityW: 7000,
  },
  ceph: {
    node: { role: 'storage-node', template: 'storage-2u', prefix: 'ceph' },
    nodes: { min: 3, max: 64, default: 4 },
    storage: null,
    array: false,
    nodesFirst: true,
    tor: 'switch-100g',
    fabric: null,
    pduCapacityW: 7000,
  },
  ai: {
    node: { role: 'gpu', template: 'gpu-8u', prefix: 'gpu' },
    nodes: { min: 1, max: 64, default: 2 },
    storage: { spec: { role: 'storage-node', template: 'storage-2u', prefix: 'stor' }, limits: { min: 0, max: 16, default: 2 } },
    array: false,
    nodesFirst: true,
    tor: 'switch-100g',
    fabric: { role: 'fabric', template: 'ib-switch', prefix: 'ib-sw' },
    // GPU racks need high-density power, e.g. a three-phase 32 A feed (about 22 kW).
    pduCapacityW: 22000,
  },
}

export const nodeLimits = (kind: ArchitectureKind): Limits => KINDS[kind].nodes
export const storageLimits = (kind: ArchitectureKind): Limits | null => KINDS[kind].storage?.limits ?? null

export function defaultOptions(kind: ArchitectureKind): ArchitectureOptions {
  const k = KINDS[kind]
  return { nodes: k.nodes.default, storage: k.storage?.limits.default ?? 0, heightU: 42, pduCapacityW: k.pduCapacityW, voltage: 230, maxWeightKg: 1200 }
}

export function validOptions(kind: ArchitectureKind, o: ArchitectureOptions): boolean {
  const inRange = (v: number, l: { min: number; max: number; integer?: boolean }) => Number.isFinite(v) && v >= l.min && v <= l.max && (!l.integer || Number.isInteger(v))
  const storage = storageLimits(kind)
  return (
    inRange(o.nodes, { ...nodeLimits(kind), integer: true }) &&
    (!storage || inRange(o.storage, { ...storage, integer: true })) &&
    (['heightU', 'pduCapacityW', 'voltage', 'maxWeightKg'] as const).every((f) => inRange(o[f], RACK_LIMITS[f]))
  )
}

export interface BomLine {
  role: ArchitectureRole
  model: string
  count: number
  uHeight: number
  powerW: number
}

/** Device counts per role, for the preview before anything is created. */
export function bom(items: RackItem[], roles: Map<string, ArchitectureRole>): BomLine[] {
  const lines = new Map<ArchitectureRole, BomLine>()
  for (const it of items) {
    const role = roles.get(it.id)
    if (!role) continue
    const line = lines.get(role) ?? { role, model: it.model, count: 0, uHeight: 0, powerW: 0 }
    line.count++
    line.uHeight += it.uHeight
    line.powerW += it.powerW
    lines.set(role, line)
  }
  return ROLE_ORDER.map((r) => lines.get(r)).filter((l): l is BomLine => Boolean(l))
}

export interface PlanInput {
  existingRacks: Rack[]
  existingItems: RackItem[]
  /** Floor row for the new racks; they take slots 1, 2, … of that row. */
  row: number
  newId: (prefix: string) => string
  /** Location text for a floor slot, e.g. "Row A, rack 3". */
  location: (row: number, col: number) => string
  rackName: (row: number, col: number) => string
}

export interface ArchitectureResult {
  ok: boolean
  racks: Rack[]
  items: RackItem[]
  /** Role of every created device (for the bill of materials). */
  roles: Map<string, ArchitectureRole>
  /** Set when a single device cannot fit an empty rack (rack too small or PDU too weak). */
  error: 'node-too-big' | null
}

/** Builds the racks and devices for an architecture. Nothing is changed in the input; the caller adds the result. */
export function planArchitecture(kind: ArchitectureKind, opts: ArchitectureOptions, input: PlanInput): ArchitectureResult {
  const cfg = KINDS[kind]
  const takenRackNames = new Set(input.existingRacks.map((r) => r.name.toLowerCase()))
  const takenItemNames = new Set(input.existingItems.map((i) => i.name.toLowerCase()))
  const racks: Rack[] = []
  const items: RackItem[] = []
  const roles = new Map<string, ArchitectureRole>()
  const counters = new Map<string, number>()
  let nextCol = 1

  function nextName(prefix: string): string {
    for (let n = (counters.get(prefix) ?? 0) + 1; ; n++) {
      const name = `${prefix}${String(n).padStart(2, '0')}`
      if (!takenItemNames.has(name.toLowerCase())) {
        counters.set(prefix, n)
        takenItemNames.add(name.toLowerCase())
        return name
      }
    }
  }

  function makeItem(spec: DeviceSpec, rack: Rack, uPosition: number): RackItem {
    const t = RACK_TEMPLATES[spec.template]!
    const name = nextName(spec.prefix)
    const hasHost = !(['patch-panel', 'blank'] as RackItemType[]).includes(t.type)
    const item: RackItem = {
      id: input.newId('item'),
      rackId: rack.id,
      name,
      model: t.model,
      type: t.type,
      uHeight: t.uHeight,
      uPosition,
      powerW: t.powerW,
      weightKg: t.weightKg,
      // Generated layouts are production designs: give the management switch both PSUs too.
      psus: spec.role === 'oob' ? 2 : t.psus,
      hostname: hasHost ? name : '',
      ip: '',
      mgmtIp: '',
      addresses: [],
      serial: '',
      assetTag: '',
      os: '',
      notes: '',
      ports: [...t.ports, ...(spec.extraPorts ?? [])].map((p) => ({ ...p })),
    }
    items.push(item)
    roles.set(item.id, spec.role)
    return item
  }

  /** Top of rack, from the top down: patch panel, OOB switch, two ToR switches (+ the fabric pair in rack 1). */
  function openRack(): Rack {
    let name = input.rackName(input.row, nextCol)
    while (takenRackNames.has(name.toLowerCase())) name = input.rackName(input.row, ++nextCol)
    takenRackNames.add(name.toLowerCase())
    const col = nextCol++
    const rack: Rack = {
      id: input.newId('rack'),
      name,
      location: input.location(input.row, col),
      heightU: opts.heightU,
      pduCapacityW: opts.pduCapacityW,
      voltage: opts.voltage,
      maxWeightKg: opts.maxWeightKg,
      row: input.row,
      col,
    }
    const tor: DeviceSpec = { role: 'tor', template: cfg.tor, prefix: 'leaf' }
    const top: DeviceSpec[] = [D.patch, D.oob, tor, tor]
    if (cfg.fabric && racks.length === 0) top.push(cfg.fabric, cfg.fabric)
    racks.push(rack)
    top.forEach((spec, i) => makeItem(spec, rack, opts.heightU - i))
    return rack
  }

  /** Lowest free U if one more device keeps the rack within U, failover power and weight. */
  function fits(rack: Rack, spec: DeviceSpec): number | null {
    const t = RACK_TEMPLATES[spec.template]!
    const u = firstFreeU(rack, items, t.uHeight)
    if (u === null) return null
    const totals = rackTotals(rack, items)
    if (rack.pduCapacityW > 0 && Math.max(totals.failoverA, totals.failoverB) + t.powerW > rack.pduCapacityW) return null
    if (rack.maxWeightKg > 0 && totals.weightKg + t.weightKg > rack.maxWeightKg) return null
    return u
  }

  /** Places a device in the last rack, opening a new one when it is full. */
  function place(spec: DeviceSpec): boolean {
    let rack = racks.at(-1)!
    let u = fits(rack, spec)
    if (u === null) {
      rack = openRack()
      u = fits(rack, spec)
      if (u === null) return false
    }
    makeItem(spec, rack, u)
    return true
  }

  const storage: DeviceSpec[] = [...(cfg.array ? [D.array] : []), ...Array.from({ length: cfg.storage ? opts.storage : 0 }, () => cfg.storage!.spec)]
  const nodes: DeviceSpec[] = Array.from({ length: opts.nodes }, () => cfg.node)
  const order = cfg.nodesFirst ? [...nodes, ...storage] : [...storage, ...nodes]

  openRack()
  for (const spec of order) {
    if (!place(spec)) return { ok: false, racks: [], items: [], roles: new Map(), error: 'node-too-big' }
  }
  return { ok: true, racks, items, roles, error: null }
}
