/**
 * Field calculators: data transfer time, storage capacity, power / UPS.
 */

// --- Transfer time ----------------------------------------------------------------

export type SizeUnit = 'GB' | 'TB' | 'PB' | 'GiB' | 'TiB'

const UNIT_BYTES: Record<SizeUnit, number> = { GB: 1e9, TB: 1e12, PB: 1e15, GiB: 2 ** 30, TiB: 2 ** 40 }

export function toBytes(size: number, unit: SizeUnit): number {
  return size * UNIT_BYTES[unit]
}

/**
 * Seconds to move `bytes` over a `gbps` link at `efficiency` (0–1): protocol overhead, disks
 * and contention mean real copies rarely exceed ~70–80 % of line rate.
 */
export function transferSeconds(bytes: number, gbps: number, efficiency: number): number | null {
  if (!(bytes >= 0) || !(gbps > 0) || !(efficiency > 0 && efficiency <= 1)) return null
  return (bytes * 8) / (gbps * 1e9 * efficiency)
}

/** Link speed (Gbps) needed to move `bytes` within `seconds`. */
export function requiredGbps(bytes: number, seconds: number, efficiency: number): number | null {
  if (!(bytes >= 0) || !(seconds > 0) || !(efficiency > 0 && efficiency <= 1)) return null
  return (bytes * 8) / (seconds * 1e9 * efficiency)
}

export function splitDuration(seconds: number): { days: number; hours: number; minutes: number; seconds: number } {
  let s = Math.round(seconds)
  const days = Math.floor(s / 86400)
  s -= days * 86400
  const hours = Math.floor(s / 3600)
  s -= hours * 3600
  const minutes = Math.floor(s / 60)
  return { days, hours, minutes, seconds: s - minutes * 60 }
}

// --- Storage capacity ---------------------------------------------------------------

export type StorageScheme = 'raid0' | 'raid1' | 'raid5' | 'raid6' | 'raid10' | 'replica' | 'ec'

export interface StorageInput {
  scheme: StorageScheme
  disks: number
  /** Per-disk size in TB (decimal, as printed on the drive). */
  diskTB: number
  /** Ceph / object replica count. */
  replicas?: number
  /** Erasure coding k data + m parity chunks. */
  k?: number
  m?: number
}

export interface StorageResult {
  valid: boolean
  /** Reason code when invalid. */
  reason?: 'min-disks' | 'even-disks' | 'bad-params'
  minDisks: number
  rawTB: number
  usableTB: number
  usableTiB: number
  efficiency: number
  /** Disks (or hosts / failure domains for replica / EC) that can fail without data loss. */
  faultTolerance: number
}

export function storageCapacity(input: StorageInput): StorageResult {
  const { scheme, disks: n, diskTB } = input
  const raw = n * diskTB
  const result = (minDisks: number, dataDisks: number, faultTolerance: number): StorageResult => {
    const usableTB = dataDisks * diskTB
    return { valid: true, minDisks, rawTB: raw, usableTB, usableTiB: (usableTB * 1e12) / 2 ** 40, efficiency: raw ? usableTB / raw : 0, faultTolerance }
  }
  const invalid = (minDisks: number, reason: StorageResult['reason']): StorageResult => ({
    valid: false, reason, minDisks, rawTB: raw, usableTB: 0, usableTiB: 0, efficiency: 0, faultTolerance: 0,
  })
  if (!Number.isInteger(n) || n < 1 || !(diskTB > 0)) return invalid(1, 'bad-params')
  switch (scheme) {
    case 'raid0':
      return result(1, n, 0)
    case 'raid1':
      return n < 2 ? invalid(2, 'min-disks') : result(2, 1, n - 1)
    case 'raid5':
      return n < 3 ? invalid(3, 'min-disks') : result(3, n - 1, 1)
    case 'raid6':
      return n < 4 ? invalid(4, 'min-disks') : result(4, n - 2, 2)
    case 'raid10':
      if (n < 4) return invalid(4, 'min-disks')
      return n % 2 ? invalid(4, 'even-disks') : result(4, n / 2, 1)
    case 'replica': {
      const r = input.replicas ?? 3
      if (!Number.isInteger(r) || r < 1) return invalid(1, 'bad-params')
      if (n < r) return invalid(r, 'min-disks')
      return { ...result(r, n / r, r - 1), usableTB: raw / r, usableTiB: (raw / r) * 1e12 / 2 ** 40, efficiency: 1 / r }
    }
    case 'ec': {
      const k = input.k ?? 4
      const m = input.m ?? 2
      if (!Number.isInteger(k) || !Number.isInteger(m) || k < 1 || m < 1) return invalid(1, 'bad-params')
      if (n < k + m) return invalid(k + m, 'min-disks')
      const usableTB = (raw * k) / (k + m)
      return { valid: true, minDisks: k + m, rawTB: raw, usableTB, usableTiB: (usableTB * 1e12) / 2 ** 40, efficiency: k / (k + m), faultTolerance: m }
    }
  }
}

// --- Power / UPS ----------------------------------------------------------------------

export interface PowerResult {
  amps: number
  va: number
  btuPerHour: number
  kwhPerDay: number
}

export function powerFigures(watts: number, voltage: number, powerFactor: number): PowerResult | null {
  if (!(watts >= 0) || !(voltage > 0) || !(powerFactor > 0 && powerFactor <= 1)) return null
  const va = watts / powerFactor
  return { amps: va / voltage, va, btuPerHour: watts * 3.412, kwhPerDay: (watts * 24) / 1000 }
}

/** Rough UPS runtime in minutes from usable battery energy (Wh) and inverter efficiency. */
export function upsRuntimeMinutes(loadW: number, batteryWh: number, efficiency = 0.9): number | null {
  if (!(loadW > 0) || !(batteryWh > 0) || !(efficiency > 0 && efficiency <= 1)) return null
  return ((batteryWh * efficiency) / loadW) * 60
}

/** Whether a UPS rated `ratedVa` / `ratedW` can carry the load (both limits apply). */
export function upsFits(loadW: number, loadVa: number, ratedVa: number, ratedW: number): boolean {
  return loadW <= ratedW && loadVa <= ratedVa
}
