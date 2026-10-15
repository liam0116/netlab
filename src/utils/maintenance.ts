/**
 * Maintenance work orders: parts moved between slots and machines (DIMMs, disks, NICs …).
 * Slots are parsed from free text ("A1, A2", "B1-B4", "DIMM_A1"), each line is checked against what
 * the earlier lines already did, and the result is summarised per machine so the engineer can verify
 * the count and capacity after POST.
 */
import type { Flowchart, FlowNode, MaintenanceJob, PartOp, PartOpKind } from '@/types/project'

export const PART_OP_KINDS: PartOpKind[] = ['move', 'swap', 'remove', 'install', 'replace']
export const PART_KINDS = ['dimm', 'disk', 'nic', 'gpu', 'cpu', 'psu', 'fan', 'other'] as const

/** Which side(s) of a line are used: parts come out of `from`, go into `to`. */
export const usesFrom = (k: PartOpKind) => k !== 'install'
export const usesTo = (k: PartOpKind) => k === 'move' || k === 'swap' || k === 'install'

/**
 * "A1, A2" → ["A1","A2"]; "A1-A4" / "A1-4" → A1…A4; "1-3" → 1,2,3. Upper-cased, order kept.
 * Separators: comma, space, 、, ;, /. A range of more than 64 slots is kept as written.
 */
export function parseSlots(text: string): string[] {
  const out: string[] = []
  // "Bay 3" / "Slot 1-4" is one slot name, not the slots "BAY" and "3".
  const glued = text.replace(/(?<![\w])([A-Za-z_]+)\s+(?=\d)/g, '$1')
  for (const raw of glued.split(/[\s,，、;；/]+/).filter(Boolean)) {
    const token = raw.toUpperCase()
    const m = /^([A-Z_]*?)(\d+)[-~–]([A-Z_]*?)(\d+)$/.exec(token)
    if (m && (m[3] === '' || m[3] === m[1])) {
      const a = Number(m[2])
      const b = Number(m[4])
      if (b >= a && b - a < 64) {
        for (let n = a; n <= b; n++) out.push(`${m[1]}${n}`)
        continue
      }
    }
    out.push(token)
  }
  return out
}

export type JobIssueCode =
  | 'no-from-host'
  | 'no-to-host'
  | 'no-from-slots'
  | 'no-to-slots'
  | 'count-mismatch'
  | 'duplicate-slot'
  | 'same-slot'
  | 'slot-empty'
  | 'slot-occupied'

export interface JobIssue {
  level: 'error' | 'warning'
  code: JobIssueCode
  opId: string
  /** 1-based line number. */
  line: number
  params: Record<string, string>
}

/** Per slot: what happened to it in this job, in order. */
export interface SlotEvent {
  line: number
  kind: PartOpKind
  /** 'out' = module taken out, 'in' = module put in, 'swap' = exchanged with `peer`, 'replace' = new module in place. */
  dir: 'out' | 'in' | 'swap' | 'replace'
  /** Other end of a move / swap: "esx04 A3". Empty for remove / install / replace. */
  peer: string
  spec: string
}

export interface HostSummary {
  host: string
  slots: { slot: string; events: SlotEvent[] }[]
  /** Modules taken out of / put into this machine, by part kind ('dimm' …). */
  out: number
  in: number
  /** Net capacity change in GB when the spec says e.g. "32GB"; null when unknown. */
  deltaGb: number | null
}

const hostKey = (h: string) => h.trim().toLowerCase()
const slotKey = (h: string, s: string) => `${hostKey(h)}::${s}`

/** Capacity per module from a spec like "32GB DDR5" or "1.92TB SSD", in GB. */
export function specGb(spec: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(GB|TB|G|T)\b/i.exec(spec)
  if (!m) return null
  const n = Number(m[1])
  return m[2]!.toUpperCase().startsWith('T') ? n * 1000 : n
}

/** Natural sort for slot names: A2 before A10. */
export function compareSlots(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true })
}

export interface JobAnalysis {
  issues: JobIssue[]
  hosts: HostSummary[]
}

/**
 * Walks the lines in order and tracks every slot that is touched. A slot is assumed to hold a module
 * before the job (when something is taken out of it) or to be free (when something goes in), so only
 * contradictions within the job are reported: taking out twice, putting in twice.
 */
export function analyzeJob(job: MaintenanceJob): JobAnalysis {
  const issues: JobIssue[] = []
  const state = new Map<string, 'full' | 'empty'>()
  const hosts = new Map<string, HostSummary>()
  const hostOrder: string[] = []

  const summary = (host: string): HostSummary => {
    const key = hostKey(host)
    let h = hosts.get(key)
    if (!h) {
      h = { host: host.trim(), slots: [], out: 0, in: 0, deltaGb: 0 }
      hosts.set(key, h)
      hostOrder.push(key)
    }
    return h
  }
  const record = (host: string, slot: string, ev: SlotEvent) => {
    const h = summary(host)
    let s = h.slots.find((x) => x.slot === slot)
    if (!s) h.slots.push((s = { slot, events: [] }))
    s.events.push(ev)
  }
  const gb = (h: HostSummary, sign: 1 | -1, spec: string) => {
    const size = specGb(spec)
    h.deltaGb = size === null || h.deltaGb === null ? null : h.deltaGb + sign * size
  }

  job.ops.forEach((op, i) => {
    const line = i + 1
    const push = (level: JobIssue['level'], code: JobIssueCode, params: Record<string, string> = {}) =>
      issues.push({ level, code, opId: op.id, line, params })
    const from = usesFrom(op.kind) ? parseSlots(op.fromSlots) : []
    const to = usesTo(op.kind) ? parseSlots(op.toSlots) : []
    // A swap within one machine is the common case: an empty target host means "the same machine".
    const toHost = op.kind === 'swap' && !op.toHost.trim() ? op.fromHost : op.toHost

    const before = issues.length
    if (usesFrom(op.kind) && !op.fromHost.trim()) push('error', 'no-from-host')
    if (usesFrom(op.kind) && !from.length) push('error', 'no-from-slots')
    if (usesTo(op.kind) && !toHost.trim()) push('error', 'no-to-host')
    if (usesTo(op.kind) && !to.length) push('error', 'no-to-slots')
    if ((op.kind === 'move' || op.kind === 'swap') && from.length && to.length && from.length !== to.length) {
      push('error', 'count-mismatch', { from: String(from.length), to: String(to.length) })
    }
    let bad = issues.length > before
    const all = [...from.map((s) => slotKey(op.fromHost, s)), ...to.map((s) => slotKey(toHost, s))]
    const dup = all.find((k, j) => all.indexOf(k) !== j)
    if (dup) {
      const [, slot] = dup.split('::')
      if ((op.kind === 'move' || op.kind === 'swap') && from.some((s, j) => slotKey(op.fromHost, s) === slotKey(toHost, to[j] ?? ''))) push('error', 'same-slot', { slot: slot! })
      else push('error', 'duplicate-slot', { slot: slot! })
      bad = true
    }
    if (bad) return

    const takeOut = (host: string, slot: string) => {
      const k = slotKey(host, slot)
      if (state.get(k) === 'empty') push('warning', 'slot-empty', { host: host.trim(), slot })
      state.set(k, 'empty')
    }
    const putIn = (host: string, slot: string) => {
      const k = slotKey(host, slot)
      if (state.get(k) === 'full') push('warning', 'slot-occupied', { host: host.trim(), slot })
      state.set(k, 'full')
    }
    const mustHold = (host: string, slot: string) => {
      const k = slotKey(host, slot)
      if (state.get(k) === 'empty') push('warning', 'slot-empty', { host: host.trim(), slot })
      state.set(k, 'full')
    }

    switch (op.kind) {
      case 'remove':
        for (const s of from) {
          takeOut(op.fromHost, s)
          record(op.fromHost, s, { line, kind: op.kind, dir: 'out', peer: '', spec: op.spec })
          summary(op.fromHost).out++
          gb(summary(op.fromHost), -1, op.spec)
        }
        break
      case 'install':
        for (const s of to) {
          putIn(toHost, s)
          record(toHost, s, { line, kind: op.kind, dir: 'in', peer: '', spec: op.spec })
          summary(toHost).in++
          gb(summary(toHost), 1, op.spec)
        }
        break
      case 'replace':
        for (const s of from) {
          mustHold(op.fromHost, s)
          record(op.fromHost, s, { line, kind: op.kind, dir: 'replace', peer: '', spec: op.spec })
        }
        break
      case 'move':
        // Everything comes out first, so a chain like A1→A2, A2→A3 inside one line is fine.
        from.forEach((s) => takeOut(op.fromHost, s))
        from.forEach((s, j) => {
          const t = to[j]!
          putIn(toHost, t)
          record(op.fromHost, s, { line, kind: op.kind, dir: 'out', peer: `${toHost.trim()} ${t}`, spec: op.spec })
          record(toHost, t, { line, kind: op.kind, dir: 'in', peer: `${op.fromHost.trim()} ${s}`, spec: op.spec })
          if (hostKey(op.fromHost) !== hostKey(toHost)) {
            summary(op.fromHost).out++
            summary(toHost).in++
            gb(summary(op.fromHost), -1, op.spec)
            gb(summary(toHost), 1, op.spec)
          }
        })
        break
      case 'swap':
        from.forEach((s, j) => {
          const t = to[j]!
          mustHold(op.fromHost, s)
          mustHold(toHost, t)
          record(op.fromHost, s, { line, kind: op.kind, dir: 'swap', peer: hostKey(toHost) === hostKey(op.fromHost) ? t : `${toHost.trim()} ${t}`, spec: op.spec })
          record(toHost, t, { line, kind: op.kind, dir: 'swap', peer: hostKey(toHost) === hostKey(op.fromHost) ? s : `${op.fromHost.trim()} ${s}`, spec: op.spec })
        })
        break
    }
  })

  const list = hostOrder.map((k) => hosts.get(k)!)
  for (const h of list) h.slots.sort((a, b) => compareSlots(a.slot, b.slot))
  return { issues, hosts: list }
}

/** Distinct machine names in a job, in the order they first appear. */
export function jobHosts(job: MaintenanceJob): string[] {
  const seen = new Map<string, string>()
  for (const op of job.ops) {
    for (const h of [usesFrom(op.kind) ? op.fromHost : '', usesTo(op.kind) ? (op.kind === 'swap' && !op.toHost.trim() ? op.fromHost : op.toHost) : '']) {
      if (h.trim() && !seen.has(hostKey(h))) seen.set(hostKey(h), h.trim())
    }
  }
  return [...seen.values()]
}

export function newPartOp(id: string, prev?: PartOp): PartOp {
  return {
    id,
    kind: prev?.kind ?? 'move',
    part: prev?.part ?? 'dimm',
    fromHost: prev?.fromHost ?? '',
    fromSlots: '',
    toHost: prev?.toHost ?? '',
    toSlots: '',
    spec: prev?.spec ?? '',
    serial: '',
    done: false,
    notes: '',
  }
}

/** Text pieces for turning a job into a flowchart; the caller supplies them in the UI language. */
export interface JobFlowText {
  start: string
  prepare: string
  /** One per machine before work: e.g. "esx01: move VMs off, maintenance mode, power off". */
  hostDown: (host: string) => string
  op: (op: PartOp) => string
  /** One per machine after work, with the expected change, e.g. "esx04: power on, POST shows +4 DIMMs". */
  hostUp: (host: HostSummary | string) => string
  check: string
  fix: string
  end: string
}

/**
 * Builds a flowchart from a work order: prepare → take every machine down → each line of the order →
 * bring every machine up and verify → decision (all correct?) with a fix-and-retry loop → done.
 */
export function jobToFlowchart(job: MaintenanceJob, id: string, text: JobFlowText): Flowchart {
  const { hosts } = analyzeJob(job)
  const names = jobHosts(job)
  const steps: string[] = [
    text.prepare,
    ...names.map(text.hostDown),
    ...job.ops.map(text.op),
    ...names.map((n) => text.hostUp(hosts.find((h) => hostKey(h.host) === hostKey(n)) ?? n)),
  ]
  const nodes: FlowNode[] = [{ id: 's', type: 'start', text: text.start, next: 'n1', yes: null, no: null }]
  steps.forEach((t, i) => nodes.push({ id: `n${i + 1}`, type: 'step', text: t.slice(0, 200), next: i + 1 < steps.length ? `n${i + 2}` : 'd1', yes: null, no: null }))
  nodes.push(
    { id: 'd1', type: 'decision', text: text.check, next: null, yes: 'e', no: 'f1' },
    { id: 'f1', type: 'step', text: text.fix, next: 'd1', yes: null, no: null },
    { id: 'e', type: 'end', text: text.end, next: null, yes: null, no: null },
  )
  return { id, title: job.title.slice(0, 120), scope: names.join('\n'), nodes }
}
