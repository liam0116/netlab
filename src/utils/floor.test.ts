import { describe, expect, it } from 'vitest'
import type { Rack } from '@/types/project'
import { demoProject } from '@/data/demoProject'
import { floorLayout, gridRackName, nextFreeRow, rackGrid, rowLetter } from './floor'

const rack = (id: string, row: number | null, col: number | null): Rack => ({ id, name: id, location: '', heightU: 42, pduCapacityW: 7000, voltage: 230, maxWeightKg: 1200, row, col })

describe('floor plan', () => {
  it('names a 3 × 4 grid A01…C04, row by row', () => {
    const grid = rackGrid({ rows: 3, cols: 4, startRow: 0 })
    expect(grid).toHaveLength(12)
    expect(grid.map((g) => g.name)).toEqual(['A01', 'A02', 'A03', 'A04', 'B01', 'B02', 'B03', 'B04', 'C01', 'C02', 'C03', 'C04'])
    expect(grid[5]).toEqual({ name: 'B02', row: 1, col: 2 })
    expect(rowLetter(25)).toBe('Z')
    expect(gridRackName(0, 12)).toBe('A12')
  })

  it('adds a new block after the rows already in use', () => {
    expect(nextFreeRow([])).toBe(0)
    expect(nextFreeRow([rack('a', 0, 1), rack('b', 2, 1), rack('x', null, null)])).toBe(3)
  })

  it('alternates rack direction so fronts share cold aisles and backs share hot aisles', () => {
    const racks = rackGrid({ rows: 3, cols: 4, startRow: 0 }).map((g) => rack(g.name, g.row, g.col))
    const plan = floorLayout(racks, [])
    expect(plan.cols).toBe(4)
    expect(plan.rows.map((r) => `${r.letter}:${r.facing}`)).toEqual(['A:down', 'B:up', 'C:down'])
    expect(plan.aisles).toEqual([
      { after: 0, kind: 'cold' },
      { after: 1, kind: 'hot' },
    ])
    expect(plan.rows[1]!.slots.map((s) => s?.name)).toEqual(['B01', 'B02', 'B03', 'B04'])
  })

  it('keeps gaps, lists unplaced racks and reports two racks in one slot', () => {
    const plan = floorLayout([rack('a1', 0, 1), rack('a3', 0, 3), rack('dup', 0, 3), rack('loose', null, null)], [])
    expect(plan.rows[0]!.slots.map((s) => s?.name ?? null)).toEqual(['a1', null, 'a3'])
    expect(plan.unplaced.map((r) => r.name)).toEqual(['loose'])
    expect(plan.conflicts.map((r) => r.name)).toEqual(['dup'])
  })

  it('sums row power for cooling planning (demo: one rack in row A)', () => {
    const p = demoProject('en')
    const plan = floorLayout(p.racks, p.rackItems)
    expect(plan.rows).toHaveLength(1)
    expect(plan.rows[0]!.slots.map((s) => s?.name)).toEqual(['R01'])
    expect(plan.rows[0]!.powerW).toBeGreaterThan(4_000)
  })
})
