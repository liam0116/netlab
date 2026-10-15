import { describe, expect, it } from 'vitest'
import { arrayState, blockValue, demoValue, gfDiv, gfMul, raidInfo, raidLayout, rebuildHours, recoverBlock, recoveryPlan, solvePQ, stripeParity, validDiskCount } from './raid'

const labels = (grid: ReturnType<typeof raidLayout>) => grid.map((disk) => disk.map((b) => b.label).join(' '))

describe('raidLayout', () => {
  it('RAID 0 stripes blocks across every disk', () => {
    expect(labels(raidLayout(0, 3, 2))).toEqual(['D1 D4', 'D2 D5', 'D3 D6'])
  })

  it('RAID 1 writes the same block to every disk', () => {
    const g = raidLayout(1, 2, 2)
    expect(labels(g)).toEqual(['D1 D2', 'D1 D2'])
    expect(g[1]![0]!.kind).toBe('mirror')
  })

  it('RAID 5 rotates the parity block (left-symmetric)', () => {
    expect(labels(raidLayout(5, 4, 4))).toEqual(['D1 D5 D9 P4', 'D2 D6 P3 D10', 'D3 P2 D7 D11', 'P1 D4 D8 D12'])
  })

  it('RAID 6 keeps P and Q on different disks in every stripe', () => {
    const g = raidLayout(6, 5, 5)
    for (let s = 0; s < 5; s++) {
      const kinds = g.map((d) => d[s]!.kind)
      expect(kinds.filter((k) => k === 'parity')).toHaveLength(1)
      expect(kinds.filter((k) => k === 'parity-q')).toHaveLength(1)
      expect(kinds.filter((k) => k === 'data')).toHaveLength(3)
    }
    // Every data block appears exactly once.
    const data = g.flat().filter((b) => b.kind === 'data').map((b) => b.dataIndex)
    expect(new Set(data).size).toBe(15)
  })

  it('RAID 10 stripes over mirrored pairs', () => {
    expect(labels(raidLayout(10, 4, 2))).toEqual(['D1 D3', 'D1 D3', 'D2 D4', 'D2 D4'])
  })
})

describe('raidInfo', () => {
  it('usable capacity and tolerance for 4 × 10 TB', () => {
    const cap = (l: 0 | 1 | 5 | 6 | 10) => raidInfo(l, 4, 10)
    expect([0, 1, 5, 6, 10].map((l) => cap(l as 0).usableTB)).toEqual([40, 10, 30, 20, 20])
    expect([0, 1, 5, 6, 10].map((l) => cap(l as 0).tolerance)).toEqual([0, 3, 1, 2, 1])
    expect(cap(10).bestCaseTolerance).toBe(2)
    expect(cap(5).writePenalty).toBe(4)
    expect(cap(6).writePenalty).toBe(6)
  })

  it('validates disk counts', () => {
    expect(validDiskCount(5, 2)).toBe(false)
    expect(validDiskCount(6, 4)).toBe(true)
    expect(validDiskCount(10, 5)).toBe(false)
    expect(validDiskCount(10, 6)).toBe(true)
  })
})

describe('failures', () => {
  it('knows which failures each level survives', () => {
    const s = (l: 0 | 1 | 5 | 6 | 10, n: number, f: number[]) => arrayState(l, n, new Set(f))
    expect(s(0, 4, [2])).toBe('failed')
    expect(s(1, 2, [0])).toBe('degraded')
    expect(s(5, 4, [1])).toBe('degraded')
    expect(s(5, 4, [1, 3])).toBe('failed')
    expect(s(6, 5, [0, 4])).toBe('degraded')
    expect(s(6, 5, [0, 2, 4])).toBe('failed')
    // RAID 10: one disk per pair is fine, both disks of one pair is not.
    expect(s(10, 4, [0, 2])).toBe('degraded')
    expect(s(10, 4, [0, 1])).toBe('failed')
    expect(s(5, 4, [])).toBe('optimal')
  })

  it('explains how a missing block is rebuilt', () => {
    expect(recoverBlock(10, 4, new Set([2]), 2, 0)).toEqual({ method: 'mirror', from: [3] })
    expect(recoverBlock(5, 4, new Set([1]), 1, 0)).toEqual({ method: 'xor', from: [0, 2, 3] })
    expect(recoverBlock(6, 5, new Set([0, 1]), 0, 0)).toMatchObject({ method: 'pq', from: [2, 3, 4] })
    expect(recoverBlock(0, 3, new Set([1]), 1, 0).method).toBe('lost')
  })

  it('RAID 5 parity really rebuilds the lost value with XOR', () => {
    const g = raidLayout(5, 4, 3)
    for (let s = 0; s < 3; s++) {
      const parity = stripeParity(g, s)
      for (let lost = 0; lost < 4; lost++) {
        const block = g[lost]![s]!
        if (block.kind !== 'data') continue
        // XOR of every other block in the stripe, parity included, gives back the lost one.
        const rebuilt = g.reduce((acc, disk, d) => (d === lost ? acc : acc ^ (disk[s]!.kind === 'parity' ? parity : demoValue(disk[s]!.dataIndex!))), 0)
        expect(rebuilt).toBe(demoValue(block.dataIndex!))
      }
    }
  })

  it('estimates rebuild time from disk size', () => {
    // 20 TB at 200 MB/s ≈ 28 hours — why big HDD arrays want RAID 6.
    expect(Math.round(rebuildHours(20, 200))).toBe(28)
  })
})

describe('step-by-step recovery', () => {
  const written = (steps: ReturnType<typeof recoveryPlan>) => (steps.at(-1)?.kind === 'write' ? (steps.at(-1) as { blocks: { label: string; value: number }[] }).blocks : [])

  it('GF(16) arithmetic is consistent', () => {
    for (let a = 1; a < 16; a++) for (let b = 1; b < 16; b++) expect(gfDiv(gfMul(a, b), b)).toBe(a)
  })

  it('RAID 5: read the others, XOR bit by bit, write back the original value', () => {
    for (let s = 0; s < 4; s++) {
      for (let d = 0; d < 4; d++) {
        const steps = recoveryPlan(5, 4, new Set([d]), s)
        expect(steps.map((x) => x.kind)).toEqual(['missing', 'read', 'xor', 'write'])
        const xor = steps[2] as Extract<(typeof steps)[number], { kind: 'xor' }>
        expect(xor.rows.reduce((acc, r) => acc ^ r.value, 0)).toBe(xor.to.value)
        expect(xor.rows.map((r) => r.disk)).not.toContain(d)
      }
    }
  })

  it('RAID 1 / 10: copy from the mirror', () => {
    const steps = recoveryPlan(10, 4, new Set([2]), 1)
    expect(steps.map((x) => x.kind)).toEqual(['missing', 'read', 'copy', 'write'])
    const copy = steps[2] as Extract<(typeof steps)[number], { kind: 'copy' }>
    expect(copy.from.disk).toBe(3)
    expect(copy.from.value).toBe(copy.to.value)
  })

  it('RAID 0: nothing to rebuild from', () => {
    expect(recoveryPlan(0, 3, new Set([1]), 0).map((x) => x.kind)).toEqual(['missing', 'lost'])
  })

  it('RAID 6: every pair of failed disks in every stripe is solved back to the original values', () => {
    const disks = 5
    for (let s = 0; s < 5; s++) {
      const layout = raidLayout(6, disks, s + 1)
      for (let i = 0; i < disks; i++) {
        for (let j = i + 1; j < disks; j++) {
          const steps = recoveryPlan(6, disks, new Set([i, j]), s)
          expect(steps[0]!.kind).toBe('missing')
          expect(steps.at(-1)!.kind).toBe('write')
          // Each solved / computed value must equal what the disk held.
          for (const st of steps) {
            if (st.kind === 'xor') expect(st.rows.reduce((acc, r) => acc ^ r.value, 0)).toBe(st.to.value)
            if (st.kind === 'q-calc') expect(st.terms.reduce((acc, t) => acc ^ t.product, 0)).toBe(st.to.value)
            if (st.kind === 'q-solve-one') expect(gfDiv(st.known, st.weight)).toBe(st.to.value)
            if (st.kind === 'pq-solve') expect(solvePQ(st.a, st.b, st.wx, st.wy)).toEqual({ x: st.x.value, y: st.y.value })
          }
          for (const w of written(steps)) {
            const original = layout.map((d) => d[s]!).find((b) => b.label === w.label)!
            expect(w.value, `${w.label} stripe ${s} disks ${i},${j}`).toBe(blockValue(layout, original))
          }
        }
      }
    }
  })
})
