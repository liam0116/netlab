/**
 * A customer project: everything an installation engineer prepares, verifies and hands over.
 * One project = one file (export / import), so work prepared in the office opens on-site.
 */
import type { PlanOptions, PlanRequirement } from '@/utils/planner'

export interface ProjectMeta {
  customer: string
  project: string
  site: string
  engineer: string
  company: string
  /** YYYY-MM-DD */
  date: string
  notes: string
  /** Company / customer logo as a data: URL (PNG / JPEG / SVG), or null. */
  logo: string | null
}

// --- Rack -------------------------------------------------------------------------

export type RackItemType =
  | 'server'
  | 'gpu-server'
  | 'storage'
  | 'switch'
  | 'mgmt-switch'
  | 'firewall'
  | 'router'
  | 'patch-panel'
  | 'ups'
  | 'kvm'
  | 'blank'
  | 'other'

export interface RackPort {
  name: string
  /** Gbps */
  speed: number
  /** Hardware address, filled in on-site (switch MAC tables, DHCP / PXE reservations). */
  mac?: string
}

/** What an extra IP address on a device is for. */
export type AddressPurpose = 'mgmt' | 'service' | 'vmotion' | 'storage' | 'cluster' | 'backup' | 'other'

/** An IP address besides the device's primary IP and BMC IP, e.g. vMotion or iSCSI on a VLAN of bond0. */
export interface DeviceAddress {
  id: string
  purpose: AddressPurpose
  /** Port or bond it lives on; empty = the primary data interface. */
  iface: string
  /** VLAN tag; null = take it from the IP plan, or untagged. */
  vlan: number | null
  address: string
}

export interface Rack {
  id: string
  name: string
  location: string
  heightU: number
  /** Capacity of each PDU feed (A and B), in watts. */
  pduCapacityW: number
  voltage: number
  maxWeightKg: number
  /** Position on the floor plan: row index (0 = row A) and slot within the row (1-based); null when not placed. */
  row: number | null
  col: number | null
}

export interface RackItem {
  id: string
  rackId: string
  name: string
  model: string
  type: RackItemType
  uHeight: number
  /** Lowest U the device occupies (1 = bottom). */
  uPosition: number
  powerW: number
  weightKg: number
  /** Number of power supplies; 2+ are split across feeds A and B. */
  psus: number
  hostname: string
  /** Primary IP: OS management / service address with the default gateway. */
  ip: string
  /** BMC / iDRAC / iLO address. */
  mgmtIp: string
  /** Further addresses (vMotion, storage, cluster, backup …). */
  addresses: DeviceAddress[]
  serial: string
  /** Customer asset tag / inventory number. */
  assetTag: string
  /** Operating system or firmware, e.g. "Ubuntu 24.04", "ESXi 8.0 U3". */
  os: string
  notes: string
  ports: RackPort[]
}

// --- Cabling ------------------------------------------------------------------------

export type CableType = 'DAC' | 'AOC' | 'MMF-SR' | 'SMF-LR' | 'Cat6' | 'Cat6A'

export interface Cable {
  id: string
  label: string
  aItemId: string
  aPort: string
  bItemId: string
  bPort: string
  type: CableType
  lengthM: number | null
  /** Switch-port mode for the switch end. */
  mode: 'access' | 'trunk'
  /** Access VLAN (or native VLAN on a trunk). */
  vlan: number | null
  /** Trunk allowed VLANs, e.g. "10,20,30". */
  allowedVlans: string
  /** Bond / LACP group name on the host side, e.g. "bond0"; empty = none. */
  bond: string
  notes: string
}

// --- Service flows -------------------------------------------------------------------

export type ServiceKind = 'client' | 'lb' | 'app' | 'db' | 'storage' | 'mgmt' | 'external' | 'other'

export interface ServiceNode {
  id: string
  name: string
  kind: ServiceKind
  zone: string
  /** Comma-separated IPs / CIDRs / hostnames. */
  addresses: string
}

export interface ServiceFlow {
  id: string
  from: string
  to: string
  protocol: 'TCP' | 'UDP' | 'ICMP'
  /** "443", "80,443", "8000-8100"; empty for ICMP. */
  ports: string
  purpose: string
}

// --- Flowcharts ------------------------------------------------------------------------

export type FlowNodeType = 'start' | 'step' | 'decision' | 'end'

export interface FlowNode {
  id: string
  type: FlowNodeType
  text: string
  /** Next node for start / step. */
  next: string | null
  /** Branches for decisions. */
  yes: string | null
  no: string | null
}

export interface Flowchart {
  id: string
  title: string
  /** What the procedure applies to: VMs, hosts or systems, one per line (e.g. "ERP-AP01", "esx01–esx04"). */
  scope: string
  nodes: FlowNode[]
}

// --- Maintenance ----------------------------------------------------------------------------

/** What happens to the parts in one line of a work order. */
export type PartOpKind = 'move' | 'swap' | 'remove' | 'install' | 'replace'
export type PartKind = 'dimm' | 'disk' | 'nic' | 'gpu' | 'cpu' | 'psu' | 'fan' | 'other'

/**
 * One line of a work order, e.g. "move 2 DIMMs from esx01 B1, B2 to esx04 A3, A4".
 * Hosts are plain names (typed, or picked from earlier work orders).
 */
export interface PartOp {
  id: string
  kind: PartOpKind
  part: PartKind
  /** Where parts come out (move / swap / remove / replace). */
  fromHost: string
  /** Slot list, e.g. "A1, A2" or "A1-A4". */
  fromSlots: string
  /** Where parts go in (move / swap / install). */
  toHost: string
  toSlots: string
  /** Part description, e.g. "32GB DDR5-4800 RDIMM". */
  spec: string
  /** Serial numbers (old / new part). */
  serial: string
  done: boolean
  notes: string
}

/** A work order on machines already in service. Kept apart from projects (new builds). */
export interface MaintenanceJob {
  id: string
  title: string
  customer: string
  site: string
  engineer: string
  /** Case / RMA / ticket number. */
  ticket: string
  /** YYYY-MM-DD */
  date: string
  notes: string
  ops: PartOp[]
  /** Filled in on-site (or by hand on the printout): HH:MM times, field notes, and what each host actually shows after power-on. */
  startTime: string
  endTime: string
  fieldNotes: string
  /** Host name → count / capacity actually seen in BIOS / BMC. */
  actual: Record<string, string>
}

// --- Project file --------------------------------------------------------------------------

export interface ProjectData {
  meta: ProjectMeta
  planner: { project: string; options: PlanOptions; requirements: PlanRequirement[] }
  racks: Rack[]
  rackItems: RackItem[]
  cables: Cable[]
  services: ServiceNode[]
  flows: ServiceFlow[]
  flowcharts: Flowchart[]
}

export interface MaintenanceFile {
  app: 'netlab-maintenance'
  formatVersion: 1
  savedAt: string
  jobs: MaintenanceJob[]
}

export interface ProjectFile extends ProjectData {
  app: 'netlab'
  formatVersion: 1
  savedAt: string
}
