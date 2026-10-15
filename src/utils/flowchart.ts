/**
 * Flowcharts as data (start / step / decision / end) with validation and a layered layout:
 * nodes are ranked top-down along forward edges; edges that jump back up (loops) are routed
 * around the right-hand side.
 */
import type { Flowchart, FlowNode } from '@/types/project'

export type FlowchartIssueCode = 'no-start' | 'multiple-start' | 'no-end' | 'dangling' | 'missing-branch' | 'missing-next' | 'unreachable'

export interface FlowchartIssue {
  level: 'error' | 'warning'
  code: FlowchartIssueCode
  nodeId?: string
  params: Record<string, string>
}

export function successors(n: FlowNode): { to: string; label?: 'yes' | 'no' }[] {
  if (n.type === 'decision') {
    return [
      ...(n.yes ? [{ to: n.yes, label: 'yes' as const }] : []),
      ...(n.no ? [{ to: n.no, label: 'no' as const }] : []),
    ]
  }
  if (n.type === 'end') return []
  return n.next ? [{ to: n.next }] : []
}

export function checkFlowchart(fc: Flowchart): FlowchartIssue[] {
  const issues: FlowchartIssue[] = []
  const byId = new Map(fc.nodes.map((n) => [n.id, n]))
  const starts = fc.nodes.filter((n) => n.type === 'start')
  if (starts.length === 0) issues.push({ level: 'error', code: 'no-start', params: {} })
  if (starts.length > 1) issues.push({ level: 'warning', code: 'multiple-start', params: { count: String(starts.length) } })
  if (!fc.nodes.some((n) => n.type === 'end')) issues.push({ level: 'warning', code: 'no-end', params: {} })
  for (const n of fc.nodes) {
    const text = n.text || n.id
    if (n.type === 'decision' && (!n.yes || !n.no)) issues.push({ level: 'error', code: 'missing-branch', nodeId: n.id, params: { text } })
    if ((n.type === 'start' || n.type === 'step') && !n.next) issues.push({ level: 'warning', code: 'missing-next', nodeId: n.id, params: { text } })
    for (const s of successors(n)) if (!byId.has(s.to)) issues.push({ level: 'error', code: 'dangling', nodeId: n.id, params: { text } })
  }
  if (starts[0]) {
    const seen = new Set<string>()
    const stack = [starts[0].id]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      const n = byId.get(id)
      if (n) for (const s of successors(n)) stack.push(s.to)
    }
    for (const n of fc.nodes) if (!seen.has(n.id) && n.type !== 'start') issues.push({ level: 'warning', code: 'unreachable', nodeId: n.id, params: { text: n.text || n.id } })
  }
  return issues
}

export interface LaidOutNode {
  node: FlowNode
  x: number
  y: number
  w: number
  h: number
}

export interface LaidOutEdge {
  from: string
  to: string
  label?: 'yes' | 'no'
  back: boolean
  points: { x: number; y: number }[]
}

export interface FlowchartLayout {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
  width: number
  height: number
}

const NODE_W = 200
const NODE_H = 56
const RANK_GAP = 48
const COL_GAP = 40
/** Height of a rank: the tallest shape (a decision diamond). */
const RANK_H = NODE_H + 16

export function layoutFlowchart(fc: Flowchart): FlowchartLayout {
  const byId = new Map(fc.nodes.map((n) => [n.id, n]))
  const order = fc.nodes.map((n) => n.id)
  const start = fc.nodes.find((n) => n.type === 'start') ?? fc.nodes[0]

  // DFS from the start to classify back edges (edges to a node on the current DFS path).
  const back = new Set<string>()
  const state = new Map<string, 'active' | 'done'>()
  const visit = (id: string) => {
    state.set(id, 'active')
    for (const s of successors(byId.get(id)!)) {
      if (!byId.has(s.to)) continue
      if (state.get(s.to) === 'active') back.add(`${id}->${s.to}`)
      else if (!state.has(s.to)) visit(s.to)
    }
    state.set(id, 'done')
  }
  if (start) visit(start.id)
  for (const id of order) if (!state.has(id)) visit(id)

  // Longest-path ranks over forward edges.
  const rank = new Map<string, number>(order.map((id) => [id, 0]))
  for (let pass = 0; pass < order.length; pass++) {
    let changed = false
    for (const id of order) {
      for (const s of successors(byId.get(id)!)) {
        if (!byId.has(s.to) || back.has(`${id}->${s.to}`)) continue
        const r = (rank.get(id) ?? 0) + 1
        if (r > (rank.get(s.to) ?? 0)) {
          rank.set(s.to, r)
          changed = true
        }
      }
    }
    if (!changed) break
  }

  const ranks: string[][] = []
  for (const id of order) (ranks[rank.get(id)!] ??= []).push(id)
  const widest = Math.max(1, ...ranks.map((r) => r?.length ?? 0))
  const width = widest * NODE_W + (widest - 1) * COL_GAP + 120
  const laid = new Map<string, LaidOutNode>()
  ranks.forEach((ids, r) => {
    if (!ids) return
    const rowWidth = ids.length * NODE_W + (ids.length - 1) * COL_GAP
    ids.forEach((id, i) => {
      const n = byId.get(id)!
      const h = n.type === 'decision' ? NODE_H + 16 : NODE_H
      // Every node in a rank shares one centre line, whatever its own height.
      laid.set(id, { node: n, x: (width - 120 - rowWidth) / 2 + i * (NODE_W + COL_GAP) + NODE_W / 2 + 20, y: 30 + r * (RANK_H + RANK_GAP) + RANK_H / 2, w: NODE_W, h })
    })
  })

  const edges: LaidOutEdge[] = []
  let backLane = 0
  for (const id of order) {
    const a = laid.get(id)!
    for (const s of successors(byId.get(id)!)) {
      const b = laid.get(s.to)
      if (!b) continue
      const isBack = back.has(`${id}->${s.to}`)
      if (isBack) {
        // Leave through the bottom, run along the free gap below this rank to the side lane, then
        // up and into the target from the right, so the loop never crosses a neighbouring node.
        const laneX = width - 40 + (backLane % 3) * 10
        const gapY = a.y + RANK_H / 2 + RANK_GAP * 0.3 + (backLane % 3) * 5
        backLane++
        edges.push({
          from: id,
          to: s.to,
          label: s.label,
          back: true,
          points: [
            { x: a.x + 12, y: a.y + a.h / 2 },
            { x: a.x + 12, y: gapY },
            { x: laneX, y: gapY },
            { x: laneX, y: b.y },
            { x: b.x + b.w / 2, y: b.y },
          ],
        })
      } else {
        const y1 = a.y + a.h / 2
        const y2 = b.y - b.h / 2
        const midY = (y1 + y2) / 2
        edges.push({
          from: id,
          to: s.to,
          label: s.label,
          back: false,
          points: a.x === b.x ? [{ x: a.x, y: y1 }, { x: b.x, y: y2 }] : [{ x: a.x, y: y1 }, { x: a.x, y: midY }, { x: b.x, y: midY }, { x: b.x, y: y2 }],
        })
      }
    }
  }
  const maxY = Math.max(0, ...[...laid.values()].map((n) => n.y + n.h / 2))
  return { nodes: [...laid.values()], edges, width, height: maxY + 30 }
}

/** Builds a flowchart from template rows; ids are taken from the rows so `next`/`yes`/`no` can refer to them. */
export function newNodeId(nodes: FlowNode[]): string {
  let n = nodes.length + 1
  while (nodes.some((x) => x.id === `n${n}`)) n++
  return `n${n}`
}
