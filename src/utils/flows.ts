/**
 * Service interaction design: who talks to whom on which port, the firewall rule matrix that
 * follows from it.
 */
import type { ServiceFlow, ServiceNode } from '@/types/project'
import { isValidIPv4, isValidIPv6, parseCidrNotation } from './network'

export interface PortRange {
  from: number
  to: number
}

/** "443" | "80,443" | "8000-8100" → ranges; null when invalid. Empty → []. */
export function parsePorts(text: string): PortRange[] | null {
  const out: PortRange[] = []
  for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(part)
    if (!m) return null
    const from = Number(m[1])
    const to = m[2] ? Number(m[2]) : from
    if (from < 1 || to > 65535 || to < from) return null
    out.push({ from, to })
  }
  return out
}

const HOSTNAME = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i

export type AddressKind = 'ip' | 'cidr' | 'hostname'

export function classifyAddress(text: string): AddressKind | null {
  const v = text.trim()
  if (isValidIPv4(v) || isValidIPv6(v)) return 'ip'
  if (parseCidrNotation(v)) return 'cidr'
  if (HOSTNAME.test(v) && !/^[\d.]+$/.test(v)) return 'hostname'
  return null
}

export function splitAddresses(text: string): string[] {
  return text.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
}

export type FlowIssueCode = 'unknown-node' | 'self-flow' | 'invalid-ports' | 'missing-ports' | 'duplicate-flow' | 'invalid-address' | 'no-address'

export interface FlowIssue {
  level: 'error' | 'warning'
  code: FlowIssueCode
  ids: string[]
  params: Record<string, string>
}

export function checkFlows(nodes: ServiceNode[], flows: ServiceFlow[]): FlowIssue[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const issues: FlowIssue[] = []
  for (const n of nodes) {
    for (const addr of splitAddresses(n.addresses)) {
      if (!classifyAddress(addr)) issues.push({ level: 'error', code: 'invalid-address', ids: [n.id], params: { name: n.name, value: addr } })
    }
  }
  const seen = new Map<string, string>()
  const warnedEmpty = new Set<string>()
  for (const f of flows) {
    const from = byId.get(f.from)
    const to = byId.get(f.to)
    if (!from || !to) {
      issues.push({ level: 'error', code: 'unknown-node', ids: [f.id], params: { purpose: f.purpose } })
      continue
    }
    if (f.from === f.to) issues.push({ level: 'warning', code: 'self-flow', ids: [f.id], params: { name: from.name } })
    if (f.protocol !== 'ICMP') {
      const ports = parsePorts(f.ports)
      if (ports === null) issues.push({ level: 'error', code: 'invalid-ports', ids: [f.id], params: { value: f.ports, from: from.name, to: to.name } })
      else if (ports.length === 0) issues.push({ level: 'error', code: 'missing-ports', ids: [f.id], params: { from: from.name, to: to.name } })
    }
    const key = `${f.from}|${f.to}|${f.protocol}|${f.ports.replace(/\s/g, '')}`
    if (seen.has(key)) issues.push({ level: 'warning', code: 'duplicate-flow', ids: [seen.get(key)!, f.id], params: { from: from.name, to: to.name } })
    else seen.set(key, f.id)
    for (const n of [from, to]) {
      if (!splitAddresses(n.addresses).length && !warnedEmpty.has(n.id)) {
        warnedEmpty.add(n.id)
        issues.push({ level: 'warning', code: 'no-address', ids: [n.id], params: { name: n.name } })
      }
    }
  }
  const order = { error: 0, warning: 1 }
  return issues.sort((a, b) => order[a.level] - order[b.level])
}

export const FIREWALL_COLUMNS = ['#', 'Source', 'Source Address', 'Destination', 'Destination Address', 'Protocol', 'Port', 'Purpose'] as const

export function firewallRows(nodes: ServiceNode[], flows: ServiceFlow[]): string[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return flows
    .filter((f) => byId.has(f.from) && byId.has(f.to))
    .map((f, i) => {
      const from = byId.get(f.from)!
      const to = byId.get(f.to)!
      return [String(i + 1), from.name, splitAddresses(from.addresses).join(' '), to.name, splitAddresses(to.addresses).join(' '), f.protocol, f.protocol === 'ICMP' ? '-' : f.ports.replace(/\s/g, ''), f.purpose]
    })
}

export interface ServiceLayout {
  zones: { name: string; x: number; width: number }[]
  nodes: Map<string, { x: number; y: number }>
  width: number
  height: number
}

/** Columns per zone (in order of first appearance), nodes stacked within a column. */
export function layoutServices(nodes: ServiceNode[], colWidth = 220, rowHeight = 96, top = 56): ServiceLayout {
  const zones: string[] = []
  for (const n of nodes) {
    const z = n.zone.trim() || '—'
    if (!zones.includes(z)) zones.push(z)
  }
  const counters = new Map<string, number>()
  const pos = new Map<string, { x: number; y: number }>()
  for (const n of nodes) {
    const z = n.zone.trim() || '—'
    const col = zones.indexOf(z)
    const row = counters.get(z) ?? 0
    counters.set(z, row + 1)
    pos.set(n.id, { x: col * colWidth + colWidth / 2, y: top + row * rowHeight + rowHeight / 2 })
  }
  const maxRows = Math.max(1, ...counters.values())
  return {
    zones: zones.map((name, i) => ({ name, x: i * colWidth, width: colWidth })),
    nodes: pos,
    width: Math.max(1, zones.length) * colWidth,
    height: top + maxRows * rowHeight + 16,
  }
}
