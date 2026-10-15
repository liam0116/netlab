/**
 * Cabling (port map) checks and exports.
 */
import type { Cable, CableType, RackItem } from '@/types/project'

export const CABLE_TYPES: CableType[] = ['DAC', 'AOC', 'MMF-SR', 'SMF-LR', 'Cat6', 'Cat6A']

/** Recommended maximum length per cable type, in metres; beyond it the link is out of spec. */
export const CABLE_MAX_M: Record<CableType, number> = { DAC: 5, AOC: 100, 'MMF-SR': 100, 'SMF-LR': 10000, Cat6: 100, Cat6A: 100 }

/** Fastest port speed (Gbps) a cable type supports. */
export const CABLE_MAX_SPEED: Record<CableType, number> = { DAC: 800, AOC: 800, 'MMF-SR': 800, 'SMF-LR': 800, Cat6: 10, Cat6A: 10 }

export const SWITCH_TYPES = ['switch', 'mgmt-switch'] as const

export function isSwitch(item: RackItem | undefined): boolean {
  return !!item && (SWITCH_TYPES as readonly string[]).includes(item.type)
}

export type CableIssueCode =
  | 'missing-device'
  | 'self-loop'
  | 'port-reused'
  | 'unknown-port'
  | 'speed-mismatch'
  | 'type-speed'
  | 'too-long'
  | 'invalid-vlan'
  | 'bond-single-member'
  | 'bond-single-switch'
  | 'bond-mismatch'
  | 'duplicate-label'

export interface CableIssue {
  level: 'error' | 'warning'
  code: CableIssueCode
  cableIds: string[]
  params: Record<string, string>
}

function portSpeed(item: RackItem | undefined, port: string): number | null {
  return item?.ports.find((p) => p.name === port)?.speed ?? null
}

export function parseVlanList(text: string): number[] | null {
  const out: number[] = []
  for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part)
    if (!m) return null
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b > 4094 || b < a) return null
    for (let v = a; v <= b; v++) out.push(v)
  }
  return out
}

export function checkCabling(items: RackItem[], cables: Cable[]): CableIssue[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const issues: CableIssue[] = []
  const name = (id: string) => byId.get(id)?.name ?? id
  const ends = new Map<string, string[]>()

  for (const c of cables) {
    const a = byId.get(c.aItemId)
    const b = byId.get(c.bItemId)
    const label = c.label || c.id
    if (!a || !b) {
      issues.push({ level: 'error', code: 'missing-device', cableIds: [c.id], params: { label } })
      continue
    }
    if (c.aItemId === c.bItemId && c.aPort === c.bPort) {
      issues.push({ level: 'error', code: 'self-loop', cableIds: [c.id], params: { label } })
    }
    for (const [item, port] of [
      [a, c.aPort],
      [b, c.bPort],
    ] as const) {
      const key = `${item.id}::${port}`
      ends.set(key, [...(ends.get(key) ?? []), c.id])
      if (item.ports.length > 0 && !item.ports.some((p) => p.name === port)) {
        issues.push({ level: 'warning', code: 'unknown-port', cableIds: [c.id], params: { label, device: item.name, port } })
      }
    }
    const sa = portSpeed(a, c.aPort)
    const sb = portSpeed(b, c.bPort)
    if (sa !== null && sb !== null && sa !== sb) {
      issues.push({ level: 'error', code: 'speed-mismatch', cableIds: [c.id], params: { label, a: `${a.name} ${c.aPort}`, sa: String(sa), b: `${b.name} ${c.bPort}`, sb: String(sb) } })
    }
    const speed = Math.max(sa ?? 0, sb ?? 0)
    if (speed > CABLE_MAX_SPEED[c.type]) {
      issues.push({ level: 'error', code: 'type-speed', cableIds: [c.id], params: { label, type: c.type, speed: String(speed) } })
    }
    if (c.lengthM !== null && c.lengthM > CABLE_MAX_M[c.type]) {
      issues.push({ level: c.type.startsWith('Cat') ? 'error' : 'warning', code: 'too-long', cableIds: [c.id], params: { label, type: c.type, length: String(c.lengthM), max: String(CABLE_MAX_M[c.type]) } })
    }
    const vlansOk = (c.vlan === null || (Number.isInteger(c.vlan) && c.vlan >= 1 && c.vlan <= 4094)) && (c.mode !== 'trunk' || c.allowedVlans.trim() === '' || parseVlanList(c.allowedVlans) !== null)
    if (!vlansOk) issues.push({ level: 'error', code: 'invalid-vlan', cableIds: [c.id], params: { label } })
  }

  for (const [key, ids] of ends) {
    if (ids.length > 1) {
      const [itemId, port] = key.split('::') as [string, string]
      issues.push({ level: 'error', code: 'port-reused', cableIds: ids, params: { device: name(itemId), port, count: String(ids.length) } })
    }
  }

  // Bonds: group by host + bond name.
  const bonds = new Map<string, Cable[]>()
  for (const c of cables) {
    if (!c.bond.trim()) continue
    const a = byId.get(c.aItemId)
    const b = byId.get(c.bItemId)
    if (!a || !b) continue
    const host = isSwitch(a) ? b : a
    const key = `${host.id}::${c.bond.trim()}`
    bonds.set(key, [...(bonds.get(key) ?? []), c])
  }
  for (const [key, members] of bonds) {
    const [hostId, bond] = key.split('::') as [string, string]
    const params = { device: name(hostId), bond }
    if (members.length < 2) {
      issues.push({ level: 'warning', code: 'bond-single-member', cableIds: members.map((m) => m.id), params })
      continue
    }
    const switches = new Set(members.map((m) => (isSwitch(byId.get(m.aItemId)) ? m.aItemId : m.bItemId)))
    if (switches.size === 1) {
      issues.push({ level: 'warning', code: 'bond-single-switch', cableIds: members.map((m) => m.id), params: { ...params, switch: name([...switches][0]!) } })
    }
    const signature = (m: Cable) => `${m.mode}|${m.vlan ?? ''}|${m.mode === 'trunk' ? (parseVlanList(m.allowedVlans) ?? []).join(',') : ''}`
    if (new Set(members.map(signature)).size > 1) {
      issues.push({ level: 'error', code: 'bond-mismatch', cableIds: members.map((m) => m.id), params })
    }
  }

  const labels = new Map<string, string[]>()
  for (const c of cables) if (c.label.trim()) labels.set(c.label.trim(), [...(labels.get(c.label.trim()) ?? []), c.id])
  for (const [label, ids] of labels) if (ids.length > 1) issues.push({ level: 'warning', code: 'duplicate-label', cableIds: ids, params: { label } })

  const order = { error: 0, warning: 1 }
  return issues.sort((x, y) => order[x.level] - order[y.level])
}

/** Next free label like C-001. */
export function nextCableLabel(cables: Cable[], prefix = 'C'): string {
  const used = new Set(cables.map((c) => c.label))
  for (let n = 1; ; n++) {
    const label = `${prefix}-${String(n).padStart(3, '0')}`
    if (!used.has(label)) return label
  }
}

/** Ports of an item not used by any cable yet. */
export function freePorts(item: RackItem, cables: Cable[], ignoreCableId?: string): string[] {
  const used = new Set(
    cables
      .filter((c) => c.id !== ignoreCableId)
      .flatMap((c) => [c.aItemId === item.id ? c.aPort : null, c.bItemId === item.id ? c.bPort : null])
      .filter((p): p is string => p !== null),
  )
  return item.ports.map((p) => p.name).filter((p) => !used.has(p))
}

export const CABLE_COLUMNS = ['Label', 'A Device', 'A Port', 'B Device', 'B Port', 'Type', 'Length (m)', 'Mode', 'VLAN', 'Allowed VLANs', 'Bond', 'Notes'] as const

export function cableRows(items: RackItem[], cables: Cable[]): string[][] {
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? id
  return cables.map((c) => [
    c.label,
    name(c.aItemId),
    c.aPort,
    name(c.bItemId),
    c.bPort,
    c.type,
    c.lengthM === null ? '' : String(c.lengthM),
    c.mode,
    c.vlan === null ? '' : String(c.vlan),
    c.mode === 'trunk' ? c.allowedVlans : '',
    c.bond,
    c.notes,
  ])
}

/** One printable line per cable end, for label makers. */
export function cableLabels(items: RackItem[], cables: Cable[]): string[] {
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? id
  return cables.flatMap((c) => [
    `${c.label}  ${name(c.aItemId)} ${c.aPort} → ${name(c.bItemId)} ${c.bPort}`,
    `${c.label}  ${name(c.bItemId)} ${c.bPort} → ${name(c.aItemId)} ${c.aPort}`,
  ])
}
