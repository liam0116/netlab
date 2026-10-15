/**
 * Project file (de)serialization. Imported files are untrusted: every field is type-checked,
 * length-limited and defaulted, unknown fields are dropped.
 */
import type {
  AddressPurpose,
  Cable,
  CableType,
  DeviceAddress,
  Flowchart,
  FlowNode,
  FlowNodeType,
  ProjectData,
  ProjectFile,
  ProjectMeta,
  Rack,
  RackItem,
  RackItemType,
  RackPort,
  ServiceFlow,
  ServiceKind,
  ServiceNode,
} from '@/types/project'
import type { PlanOptions, PlanRequirement } from './planner'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_LOGO_CHARS = 600_000
const MAX_ITEMS = 2000

export type Obj = Record<string, unknown>
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
export const str = (v: unknown, max = 200, fallback = ''): string => (typeof v === 'string' ? v.slice(0, max) : fallback)
const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
const int = (v: unknown, min: number, max: number, fallback: number): number => Math.round(num(v, min, max, fallback))
const intOrNull = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null
export const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)
export const list = <T>(v: unknown, map: (x: Obj) => T | null): T[] =>
  Array.isArray(v) ? v.slice(0, MAX_ITEMS).filter(isObj).map(map).filter((x): x is T => x !== null) : []
export const id = (v: unknown): string | null => (typeof v === 'string' && /^[\w.:-]{1,80}$/.test(v) ? v : null)

const RACK_TYPES: RackItemType[] = ['server', 'gpu-server', 'storage', 'switch', 'mgmt-switch', 'firewall', 'router', 'patch-panel', 'ups', 'kvm', 'blank', 'other']
const CABLE_TYPES: CableType[] = ['DAC', 'AOC', 'MMF-SR', 'SMF-LR', 'Cat6', 'Cat6A']
const SERVICE_KINDS: ServiceKind[] = ['client', 'lb', 'app', 'db', 'storage', 'mgmt', 'external', 'other']
const FLOW_TYPES: FlowNodeType[] = ['start', 'step', 'decision', 'end']

export function emptyMeta(): ProjectMeta {
  return { customer: '', project: '', site: '', engineer: '', company: '', date: new Date().toISOString().slice(0, 10), notes: '', logo: null }
}

function meta(v: unknown): ProjectMeta {
  const m = isObj(v) ? v : {}
  const logo = typeof m.logo === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(m.logo) && m.logo.length <= MAX_LOGO_CHARS ? m.logo : null
  return {
    customer: str(m.customer),
    project: str(m.project),
    site: str(m.site),
    engineer: str(m.engineer),
    company: str(m.company),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(m.date)) ? str(m.date) : emptyMeta().date,
    notes: str(m.notes, 4000),
    logo,
  }
}

const port = (p: Obj): RackPort | null => {
  if (!str(p.name, 40)) return null
  const mac = str(p.mac, 17)
  return mac ? { name: str(p.name, 40), speed: num(p.speed, 0, 1600, 1), mac } : { name: str(p.name, 40), speed: num(p.speed, 0, 1600, 1) }
}

const PURPOSES: AddressPurpose[] = ['mgmt', 'service', 'vmotion', 'storage', 'cluster', 'backup', 'other']
const address = (a: Obj): DeviceAddress | null => {
  const aid = id(a.id)
  return aid ? { id: aid, purpose: oneOf(a.purpose, PURPOSES, 'other'), iface: str(a.iface, 40), vlan: intOrNull(a.vlan, 1, 4094), address: str(a.address, 45) } : null
}

const rack = (r: Obj): Rack | null => {
  const rid = id(r.id)
  return rid
    ? { id: rid, name: str(r.name, 80), location: str(r.location, 120), heightU: int(r.heightU, 1, 60, 42), pduCapacityW: num(r.pduCapacityW, 0, 100000, 7000), voltage: num(r.voltage, 1, 480, 220), maxWeightKg: num(r.maxWeightKg, 0, 5000, 1200), row: intOrNull(r.row, 0, 25), col: intOrNull(r.col, 1, 99) }
    : null
}

const rackItem = (r: Obj): RackItem | null => {
  const rid = id(r.id)
  const rackId = id(r.rackId)
  if (!rid || !rackId) return null
  return {
    id: rid,
    rackId,
    name: str(r.name, 80),
    model: str(r.model, 120),
    type: oneOf(r.type, RACK_TYPES, 'other'),
    uHeight: int(r.uHeight, 1, 20, 1),
    uPosition: int(r.uPosition, 1, 60, 1),
    powerW: num(r.powerW, 0, 50000, 0),
    weightKg: num(r.weightKg, 0, 2000, 0),
    psus: int(r.psus, 0, 8, 2),
    hostname: str(r.hostname, 80),
    ip: str(r.ip, 45),
    mgmtIp: str(r.mgmtIp, 45),
    addresses: list(r.addresses, address).slice(0, 32),
    serial: str(r.serial, 80),
    assetTag: str(r.assetTag, 80),
    os: str(r.os, 80),
    notes: str(r.notes, 1000),
    ports: list(r.ports, port).slice(0, 200),
  }
}

const cable = (c: Obj): Cable | null => {
  const cid = id(c.id)
  const a = id(c.aItemId)
  const b = id(c.bItemId)
  if (!cid || !a || !b) return null
  return {
    id: cid,
    label: str(c.label, 40),
    aItemId: a,
    aPort: str(c.aPort, 40),
    bItemId: b,
    bPort: str(c.bPort, 40),
    type: oneOf(c.type, CABLE_TYPES, 'DAC'),
    lengthM: typeof c.lengthM === 'number' && Number.isFinite(c.lengthM) && c.lengthM >= 0 ? Math.min(c.lengthM, 100000) : null,
    mode: oneOf(c.mode, ['access', 'trunk'] as const, 'access'),
    vlan: intOrNull(c.vlan, 1, 4094),
    allowedVlans: str(c.allowedVlans, 200),
    bond: str(c.bond, 20),
    notes: str(c.notes, 400),
  }
}

const service = (s: Obj): ServiceNode | null => {
  const sid = id(s.id)
  return sid ? { id: sid, name: str(s.name, 80), kind: oneOf(s.kind, SERVICE_KINDS, 'other'), zone: str(s.zone, 60), addresses: str(s.addresses, 1000) } : null
}

const flow = (f: Obj): ServiceFlow | null => {
  const fid = id(f.id)
  const from = id(f.from)
  const to = id(f.to)
  return fid && from && to ? { id: fid, from, to, protocol: oneOf(f.protocol, ['TCP', 'UDP', 'ICMP'] as const, 'TCP'), ports: str(f.ports, 200), purpose: str(f.purpose, 200) } : null
}

const flowNode = (n: Obj): FlowNode | null => {
  const nid = id(n.id)
  return nid ? { id: nid, type: oneOf(n.type, FLOW_TYPES, 'step'), text: str(n.text, 200), next: id(n.next), yes: id(n.yes), no: id(n.no) } : null
}

const flowchart = (f: Obj): Flowchart | null => {
  const fid = id(f.id)
  return fid ? { id: fid, title: str(f.title, 120), scope: str(f.scope, 2000), nodes: list(f.nodes, flowNode).slice(0, 200) } : null
}

const requirement = (r: Obj): PlanRequirement | null => {
  const rid = id(r.id)
  return rid ? { id: rid, name: str(r.name, 40), vlan: intOrNull(r.vlan, 1, 4094), hosts: int(r.hosts, 1, 16_000_000, 1) } : null
}

function planOptions(v: unknown): PlanOptions {
  const o = isObj(v) ? v : {}
  return {
    base: str(o.base, 18, '10.10.0.0/16'),
    strategy: oneOf(o.strategy, ['vlsm', 'vlan-octet'] as const, 'vlsm'),
    gateway: oneOf(o.gateway, ['first', 'last'] as const, 'first'),
    growthPercent: num(o.growthPercent, 0, 1000, 0),
    reserveGateway: typeof o.reserveGateway === 'boolean' ? o.reserveGateway : true,
  }
}

export function emptyProject(): ProjectData {
  return {
    meta: emptyMeta(),
    planner: { project: '', options: planOptions({}), requirements: [] },
    racks: [],
    rackItems: [],
    cables: [],
    services: [],
    flows: [],
    flowcharts: [],
  }
}

export function serializeProject(data: ProjectData, savedAt = new Date().toISOString()): string {
  const file: ProjectFile = { app: 'netlab', formatVersion: 1, savedAt, ...data }
  return JSON.stringify(file, null, 2)
}

export type ParseError = 'too-large' | 'not-json' | 'not-netlab' | 'unsupported-version'

/**
 * Files from before the floor plan have no rack positions. Their racks were shown side by side, so put them
 * in row A in the same order instead of leaving the floor plan empty. Explicit nulls are kept.
 */
function placeLegacyRacks(rawRacks: unknown, racks: Rack[]): Rack[] {
  const legacy = Array.isArray(rawRacks) && rawRacks.every((r) => !isObj(r) || (!('row' in r) && !('col' in r)))
  return legacy ? racks.map((r, i) => ({ ...r, row: 0, col: i + 1 })) : racks
}

export function parseProjectFile(text: string): { ok: true; data: ProjectData } | { ok: false; error: ParseError } {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'too-large' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'not-json' }
  }
  if (!isObj(raw) || raw.app !== 'netlab') return { ok: false, error: 'not-netlab' }
  if (raw.formatVersion !== 1) return { ok: false, error: 'unsupported-version' }
  const planner = isObj(raw.planner) ? raw.planner : {}
  return {
    ok: true,
    data: {
      meta: meta(raw.meta),
      planner: { project: str(planner.project, 60), options: planOptions(planner.options), requirements: list(planner.requirements, requirement) },
      racks: placeLegacyRacks(raw.racks, list(raw.racks, rack)),
      rackItems: list(raw.rackItems, rackItem),
      cables: list(raw.cables, cable),
      services: list(raw.services, service),
      flows: list(raw.flows, flow),
      flowcharts: list(raw.flowcharts, flowchart),
    },
  }
}
