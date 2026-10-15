import type { Rack, RackItem } from '@/types/project'
import { rackTotals } from './rack'

/** Row label: 0 → A, 1 → B … */
export const rowLetter = (row: number): string => (row >= 0 && row < 26 ? String.fromCharCode(65 + row) : `R${row + 1}`)

/** Rack name in a grid, e.g. row 1 col 3 → "B03". */
export const gridRackName = (row: number, col: number): string => `${rowLetter(row)}${String(col).padStart(2, '0')}`

export interface GridOptions {
  rows: number
  cols: number
  /** Row index of the first new row (0 = A). */
  startRow: number
}

/** Positions and names for a rows × cols block of racks, row by row. */
export function rackGrid({ rows, cols, startRow }: GridOptions): { name: string; row: number; col: number }[] {
  const out: { name: string; row: number; col: number }[] = []
  for (let r = 0; r < rows; r++) for (let c = 1; c <= cols; c++) out.push({ name: gridRackName(startRow + r, c), row: startRow + r, col: c })
  return out
}

/** First row index that has no rack yet, so a new block goes after the existing ones. */
export const nextFreeRow = (racks: Rack[]): number => racks.reduce((max, r) => (r.row !== null && r.row >= max ? r.row + 1 : max), 0)

export type Facing = 'down' | 'up'
export type AisleKind = 'cold' | 'hot'

export interface FloorRow {
  row: number
  letter: string
  /** Direction the rack fronts (cold-air intake) face on the plan. */
  facing: Facing
  /** One entry per slot 1..cols; null for an empty slot. */
  slots: (Rack | null)[]
  powerW: number
}

export interface FloorLayout {
  rows: FloorRow[]
  cols: number
  /** Aisle between rows[i] and rows[i + 1]. */
  aisles: { after: number; kind: AisleKind }[]
  /** Racks with no floor position. */
  unplaced: Rack[]
  /** Racks that share a slot with another rack (only the first one is drawn). */
  conflicts: Rack[]
}

/**
 * Hot / cold aisle containment: rows alternate direction so that fronts face fronts across a cold aisle and
 * backs face backs across a hot aisle. Row A fronts face down (towards row B), so A–B is a cold aisle,
 * B–C a hot aisle, C–D cold, and so on.
 */
export const rowFacing = (row: number): Facing => (row % 2 === 0 ? 'down' : 'up')
export const aisleAfter = (row: number): AisleKind => (row % 2 === 0 ? 'cold' : 'hot')

export function floorLayout(racks: Rack[], items: RackItem[]): FloorLayout {
  const placed = racks.filter((r) => r.row !== null && r.col !== null)
  const unplaced = racks.filter((r) => r.row === null || r.col === null)
  if (!placed.length) return { rows: [], cols: 0, aisles: [], unplaced, conflicts: [] }

  const minRow = Math.min(...placed.map((r) => r.row!))
  const maxRow = Math.max(...placed.map((r) => r.row!))
  const cols = Math.max(...placed.map((r) => r.col!))
  const rows: FloorRow[] = []
  const conflicts: Rack[] = []
  for (let row = minRow; row <= maxRow; row++) {
    const slots: (Rack | null)[] = Array.from({ length: cols }, () => null)
    for (const r of placed.filter((x) => x.row === row)) {
      if (slots[r.col! - 1]) conflicts.push(r)
      else slots[r.col! - 1] = r
    }
    const powerW = slots.reduce((sum, r) => sum + (r ? rackTotals(r, items).powerW : 0), 0)
    rows.push({ row, letter: rowLetter(row), facing: rowFacing(row), slots, powerW })
  }
  const aisles = rows.slice(0, -1).map((r) => ({ after: r.row, kind: aisleAfter(r.row) }))
  return { rows, cols, aisles, unplaced, conflicts }
}
