/**
 * RAID 0 / 1 / 5 / 6 / 10: block layout, capacity, fault tolerance and recovery — the model behind the
 * RAID simulator. Layouts follow the common conventions (RAID 5/6 "left-symmetric" rotating parity,
 * RAID 10 = stripe over mirrored pairs) so the picture matches what controllers actually do.
 */

export type RaidLevel = 0 | 1 | 5 | 6 | 10
export const RAID_LEVELS: RaidLevel[] = [0, 1, 5, 6, 10]

export type BlockKind = 'data' | 'mirror' | 'parity' | 'parity-q'

export interface RaidBlock {
  /** "D3" for data (and its mirror copies), "P2" / "Q2" for parity of stripe 2. */
  label: string
  kind: BlockKind
  stripe: number
  /** 0-based index of the data block it holds (data / mirror only). */
  dataIndex: number | null
}

export const MIN_DISKS: Record<RaidLevel, number> = { 0: 2, 1: 2, 5: 3, 6: 4, 10: 4 }
export const MAX_DISKS = 12

export function validDiskCount(level: RaidLevel, disks: number): boolean {
  return Number.isInteger(disks) && disks >= MIN_DISKS[level] && disks <= MAX_DISKS && (level !== 10 || disks % 2 === 0)
}

/** Disk that holds P for a stripe (left-symmetric: starts on the last disk and moves left). */
const parityDisk = (disks: number, stripe: number) => (((disks - 1 - stripe) % disks) + disks) % disks

/** layout[disk][stripe] */
export function raidLayout(level: RaidLevel, disks: number, stripes: number): RaidBlock[][] {
  const grid: RaidBlock[][] = Array.from({ length: disks }, () => [])
  const data = (stripe: number, index: number, kind: BlockKind = 'data'): RaidBlock => ({ label: `D${index + 1}`, kind, stripe, dataIndex: index })
  for (let s = 0; s < stripes; s++) {
    if (level === 0) {
      for (let d = 0; d < disks; d++) grid[d]!.push(data(s, s * disks + d))
    } else if (level === 1) {
      for (let d = 0; d < disks; d++) grid[d]!.push(data(s, s, d === 0 ? 'data' : 'mirror'))
    } else if (level === 10) {
      const pairs = disks / 2
      for (let d = 0; d < disks; d++) grid[d]!.push(data(s, s * pairs + Math.floor(d / 2), d % 2 === 0 ? 'data' : 'mirror'))
    } else {
      const p = parityDisk(disks, s)
      const q = level === 6 ? (p + 1) % disks : -1
      const perStripe = disks - (level === 6 ? 2 : 1)
      // Data starts right after the parity block(s) and wraps around.
      let k = 0
      for (let i = 1; i <= disks; i++) {
        const d = (p + i) % disks
        if (d === q || d === p) continue
        grid[d]![s] = data(s, s * perStripe + k++)
      }
      grid[p]![s] = { label: `P${s + 1}`, kind: 'parity', stripe: s, dataIndex: null }
      if (q >= 0) grid[q]![s] = { label: `Q${s + 1}`, kind: 'parity-q', stripe: s, dataIndex: null }
    }
  }
  return grid
}

export interface RaidInfo {
  usableDisks: number
  usableTB: number
  /** Share of raw capacity that holds data. */
  efficiency: number
  /** Disks that can fail in the worst case without losing data. */
  tolerance: number
  /** RAID 10: up to one per mirror pair if you are lucky. */
  bestCaseTolerance: number
  /** Relative to one disk. */
  readSpeed: number
  writeSpeed: number
  /** Disk I/Os per random write. */
  writePenalty: number
}

export function raidInfo(level: RaidLevel, disks: number, diskTB: number): RaidInfo {
  const usableDisks = { 0: disks, 1: 1, 5: disks - 1, 6: disks - 2, 10: disks / 2 }[level]
  const penalty = { 0: 1, 1: 2, 5: 4, 6: 6, 10: 2 }[level]
  const tolerance = { 0: 0, 1: disks - 1, 5: 1, 6: 2, 10: 1 }[level]
  return {
    usableDisks,
    usableTB: usableDisks * diskTB,
    efficiency: usableDisks / disks,
    tolerance,
    bestCaseTolerance: level === 10 ? disks / 2 : tolerance,
    readSpeed: level === 5 ? disks - 1 : level === 6 ? disks - 2 : disks,
    writeSpeed: level === 1 ? 1 : disks / penalty,
    writePenalty: penalty,
  }
}

export type ArrayState = 'optimal' | 'degraded' | 'failed'

/** Whether the data survives the given failed disks. */
export function arrayState(level: RaidLevel, disks: number, failed: ReadonlySet<number>): ArrayState {
  const n = [...failed].filter((d) => d >= 0 && d < disks).length
  if (n === 0) return 'optimal'
  let ok: boolean
  if (level === 0) ok = false
  else if (level === 1) ok = n < disks
  else if (level === 5) ok = n <= 1
  else if (level === 6) ok = n <= 2
  else {
    ok = true
    for (let pair = 0; pair < disks / 2; pair++) if (failed.has(pair * 2) && failed.has(pair * 2 + 1)) ok = false
  }
  return ok ? 'degraded' : 'failed'
}

export type Recovery =
  | { method: 'mirror'; from: number[] }
  /** RAID 5 (or RAID 6 with one failure): XOR of the other blocks in the stripe. */
  | { method: 'xor'; from: number[] }
  /** RAID 6 with two failures: solve with both P and Q. */
  | { method: 'pq'; from: number[] }
  | { method: 'lost'; from: [] }

/** How the block on a failed disk can be read back (what the controller does in degraded mode / rebuild). */
export function recoverBlock(level: RaidLevel, disks: number, failed: ReadonlySet<number>, disk: number, stripe: number): Recovery {
  if (arrayState(level, disks, failed) === 'failed') return { method: 'lost', from: [] }
  const alive = Array.from({ length: disks }, (_, d) => d).filter((d) => !failed.has(d))
  if (level === 1) return { method: 'mirror', from: alive.slice(0, 1) }
  if (level === 10) return { method: 'mirror', from: [disk % 2 === 0 ? disk + 1 : disk - 1] }
  if (level === 5) return { method: 'xor', from: alive }
  if (level === 6) {
    const failedHere = [...failed].filter((d) => d < disks).length
    return failedHere >= 2 ? { method: 'pq', from: alive } : { method: 'xor', from: alive.filter((d) => raidLayout(6, disks, stripe + 1)[d]![stripe]!.kind !== 'parity-q') }
  }
  return { method: 'lost', from: [] }
}

/** A small 4-bit value per data block, so the XOR parity math can be shown with real numbers. */
export const demoValue = (dataIndex: number): number => (dataIndex * 7 + 5) % 16

/** RAID 5 parity of a stripe: XOR of its data values. */
export function stripeParity(layout: RaidBlock[][], stripe: number): number {
  return layout.reduce((acc, disk) => (disk[stripe]?.kind === 'data' ? acc ^ demoValue(disk[stripe]!.dataIndex!) : acc), 0)
}

export const toBits = (v: number): string => v.toString(2).padStart(4, '0')

/** Rough rebuild time: the whole replacement disk has to be written. */
export function rebuildHours(diskTB: number, mbPerSecond: number): number {
  return (diskTB * 1_000_000) / mbPerSecond / 3600
}

// --- RAID 6 Q parity: Galois field GF(2^4) on the 4-bit demo values ----------------------------
// Real controllers do the same in GF(2^8) on bytes; 4 bits keeps the numbers readable.
const GF_POLY = 0b10011 // x^4 + x + 1
const GF_EXP: number[] = []
const GF_LOG: number[] = new Array(16).fill(0)
for (let i = 0, x = 1; i < 15; i++) {
  GF_EXP[i] = x
  GF_LOG[x] = i
  x <<= 1
  if (x & 0b10000) x ^= GF_POLY
}
export const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : GF_EXP[(GF_LOG[a]! + GF_LOG[b]!) % 15]!)
export const gfDiv = (a: number, b: number): number => {
  if (b === 0) throw new Error('division by zero in GF(16)')
  return a === 0 ? 0 : GF_EXP[(GF_LOG[a]! - GF_LOG[b]! + 15) % 15]!
}
/** Weight of the k-th data block of a stripe in Q: g^k with generator g = 2. */
export const gfWeight = (k: number): number => GF_EXP[k % 15]!

/** Data blocks of a stripe in order, with their position k (used as the Q weight). */
export function stripeData(layout: RaidBlock[][], stripe: number): { disk: number; block: RaidBlock; k: number }[] {
  const out = layout.map((d, disk) => ({ disk, block: d[stripe]! })).filter((x) => x.block.kind === 'data')
  return out.sort((a, b) => a.block.dataIndex! - b.block.dataIndex!).map((x, k) => ({ ...x, k }))
}

/** RAID 6 Q of a stripe: Σ g^k · D_k in GF(16). */
export function stripeQ(layout: RaidBlock[][], stripe: number): number {
  return stripeData(layout, stripe).reduce((acc, d) => acc ^ gfMul(gfWeight(d.k), demoValue(d.block.dataIndex!)), 0)
}

/** The demo value stored in any block (data, mirror, P or Q). */
export function blockValue(layout: RaidBlock[][], block: RaidBlock): number {
  if (block.kind === 'parity') return stripeParity(layout, block.stripe)
  if (block.kind === 'parity-q') return stripeQ(layout, block.stripe)
  return demoValue(block.dataIndex!)
}

// --- Step-by-step recovery plan (drives the recovery animation) -----------------------------

export interface PlanBlock {
  disk: number
  label: string
  value: number
}

export type RecoveryStep =
  /** These blocks are gone with the failed disk(s). */
  | { kind: 'missing'; blocks: PlanBlock[] }
  /** RAID 0: nothing else holds this data. */
  | { kind: 'lost'; blocks: PlanBlock[] }
  /** Read the surviving blocks of the stripe that the calculation needs. */
  | { kind: 'read'; blocks: PlanBlock[] }
  /** Mirror: the copy is the answer. */
  | { kind: 'copy'; from: PlanBlock; to: PlanBlock }
  /** XOR the rows together, bit by bit, to get `to`. */
  | { kind: 'xor'; rows: PlanBlock[]; to: PlanBlock }
  /** RAID 6: Q is recomputed from the (now complete) data. */
  | { kind: 'q-calc'; terms: { block: PlanBlock; weight: number; product: number }[]; to: PlanBlock }
  /** RAID 6 with a data block and P lost: Dx = (Q ⊕ Σ others) / g^k. */
  | { kind: 'q-solve-one'; known: number; weight: number; to: PlanBlock }
  /** RAID 6 with two data blocks lost: two equations (from P and Q), two unknowns. */
  | { kind: 'pq-solve'; a: number; b: number; wx: number; wy: number; x: PlanBlock; y: PlanBlock }
  /** Write the recovered blocks to the replacement disk(s). */
  | { kind: 'write'; blocks: PlanBlock[] }

/**
 * How the controller rebuilds the failed disk(s) in one stripe, as a list of steps with real values.
 * Every step can be checked: the written values equal what the disks held before the failure.
 */
export function recoveryPlan(level: RaidLevel, disks: number, failed: ReadonlySet<number>, stripe: number): RecoveryStep[] {
  const layout = raidLayout(level, disks, stripe + 1)
  const at = (disk: number): PlanBlock => {
    const b = layout[disk]![stripe]!
    return { disk, label: b.label, value: blockValue(layout, b) }
  }
  const lostDisks = [...failed].filter((d) => d >= 0 && d < disks).sort((a, b) => a - b)
  const missing = lostDisks.map(at)
  const steps: RecoveryStep[] = [{ kind: 'missing', blocks: missing }]
  const state = arrayState(level, disks, failed)
  if (state === 'failed') return [...steps, { kind: 'lost', blocks: missing }]
  if (state === 'optimal') return steps
  const alive = Array.from({ length: disks }, (_, d) => d).filter((d) => !failed.has(d))

  if (level === 1 || level === 10) {
    for (const m of missing) {
      const partner = level === 1 ? alive[0]! : m.disk % 2 === 0 ? m.disk + 1 : m.disk - 1
      steps.push({ kind: 'read', blocks: [at(partner)] }, { kind: 'copy', from: at(partner), to: m })
    }
    return [...steps, { kind: 'write', blocks: missing }]
  }

  const kindOf = (disk: number) => layout[disk]![stripe]!.kind
  if (level === 5 || missing.length === 1) {
    const m = missing[0]!
    if (kindOf(m.disk) === 'parity-q') {
      // RAID 6, only Q lost: recompute it from the data.
      const data = stripeData(layout, stripe)
      steps.push({ kind: 'read', blocks: data.map((d) => at(d.disk)) })
      steps.push({ kind: 'q-calc', terms: data.map((d) => ({ block: at(d.disk), weight: gfWeight(d.k), product: gfMul(gfWeight(d.k), at(d.disk).value) })), to: m })
    } else {
      // XOR of every surviving block of the stripe except Q.
      const rows = alive.filter((d) => kindOf(d) !== 'parity-q').map(at)
      steps.push({ kind: 'read', blocks: rows }, { kind: 'xor', rows, to: m })
    }
    return [...steps, { kind: 'write', blocks: missing }]
  }

  // RAID 6, two blocks lost in this stripe.
  const data = stripeData(layout, stripe)
  const lostData = data.filter((d) => failed.has(d.disk))
  const keptData = data.filter((d) => !failed.has(d.disk))
  const pDisk = layout.findIndex((d) => d[stripe]!.kind === 'parity')
  const qDisk = layout.findIndex((d) => d[stripe]!.kind === 'parity-q')
  const qTerms = (list: typeof data) => list.map((d) => ({ block: at(d.disk), weight: gfWeight(d.k), product: gfMul(gfWeight(d.k), at(d.disk).value) }))

  if (lostData.length === 0) {
    // P and Q lost: both are recomputed from intact data.
    steps.push({ kind: 'read', blocks: data.map((d) => at(d.disk)) })
    steps.push({ kind: 'xor', rows: data.map((d) => at(d.disk)), to: at(pDisk) })
    steps.push({ kind: 'q-calc', terms: qTerms(data), to: at(qDisk) })
  } else if (lostData.length === 1 && failed.has(pDisk)) {
    // Data + P lost: Q alone gives the data block, then P is recomputed.
    const x = lostData[0]!
    const known = keptData.reduce((acc, d) => acc ^ gfMul(gfWeight(d.k), at(d.disk).value), at(qDisk).value)
    steps.push({ kind: 'read', blocks: [...keptData.map((d) => at(d.disk)), at(qDisk)] })
    steps.push({ kind: 'q-solve-one', known, weight: gfWeight(x.k), to: at(x.disk) })
    steps.push({ kind: 'xor', rows: data.map((d) => at(d.disk)), to: at(pDisk) })
  } else if (lostData.length === 1) {
    // Data + Q lost: XOR with P gives the data block, then Q is recomputed.
    const x = lostData[0]!
    const rows = [...keptData.map((d) => at(d.disk)), at(pDisk)]
    steps.push({ kind: 'read', blocks: rows }, { kind: 'xor', rows, to: at(x.disk) })
    steps.push({ kind: 'q-calc', terms: qTerms(data), to: at(qDisk) })
  } else {
    // Two data blocks lost: A = Dx ⊕ Dy from P, B = g^x·Dx ⊕ g^y·Dy from Q.
    const [x, y] = lostData as [(typeof data)[0], (typeof data)[0]]
    const a = keptData.reduce((acc, d) => acc ^ at(d.disk).value, at(pDisk).value)
    const b = keptData.reduce((acc, d) => acc ^ gfMul(gfWeight(d.k), at(d.disk).value), at(qDisk).value)
    steps.push({ kind: 'read', blocks: [...keptData.map((d) => at(d.disk)), at(pDisk), at(qDisk)] })
    steps.push({ kind: 'pq-solve', a, b, wx: gfWeight(x.k), wy: gfWeight(y.k), x: at(x.disk), y: at(y.disk) })
  }
  return [...steps, { kind: 'write', blocks: missing }]
}

/** Solves the two-unknown RAID 6 case; exposed so the animation and the tests use the same math. */
export function solvePQ(a: number, b: number, wx: number, wy: number): { x: number; y: number } {
  const x = gfDiv(b ^ gfMul(wy, a), wx ^ wy)
  return { x, y: a ^ x }
}
