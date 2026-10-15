/**
 * MAC address helpers. All functions are pure and locale-independent.
 */
import { intToOctets, ipToInt } from './network'

const MAC_PATTERN = /^([0-9a-f]{2})([:-]?)([0-9a-f]{2})\2([0-9a-f]{2})\2([0-9a-f]{2})\2([0-9a-f]{2})\2([0-9a-f]{2})$/i

export const BROADCAST_MAC = 'ff:ff:ff:ff:ff:ff'

/** Accepts aa:bb:cc:dd:ee:ff, aa-bb-..., or aabbccddeeff. */
export function isValidMac(input: string): boolean {
  return MAC_PATTERN.test(input.trim())
}

/** Normalizes to lowercase colon form. Returns null when invalid. */
export function normalizeMac(input: string): string | null {
  const match = MAC_PATTERN.exec(input.trim())
  if (!match) return null
  return [match[1], match[3], match[4], match[5], match[6], match[7]].map((x) => x!.toLowerCase()).join(':')
}

function macOctets(mac: string): number[] {
  const normalized = normalizeMac(mac)
  if (!normalized) throw new Error(`Invalid MAC address: ${mac}`)
  return normalized.split(':').map((x) => parseInt(x, 16))
}

/**
 * A deterministic, locally administered MAC derived from an IPv4 address (02:00 + the 4 IP octets).
 * Used by the simulators so the same IP always gets the same MAC.
 */
export function macFromIp(ip: string): string {
  return ['02', '00', ...intToOctets(ipToInt(ip)).map((o) => o.toString(16).padStart(2, '0'))].join(':')
}

export interface MacInfo {
  mac: string
  /** Organizationally Unique Identifier: the first 3 bytes, assigned to the vendor. */
  oui: string
  /** The last 3 bytes, assigned by the vendor to this NIC. */
  nic: string
  /** I/G bit (bit 0 of the first byte): 1 = multicast / group address. */
  multicast: boolean
  /** U/L bit (bit 1 of the first byte): 1 = locally administered (not burned in by a vendor). */
  locallyAdministered: boolean
  broadcast: boolean
  firstByteBits: string
}

export function describeMac(mac: string): MacInfo {
  const octets = macOctets(mac)
  const normalized = normalizeMac(mac)!
  const first = octets[0]!
  return {
    mac: normalized,
    oui: normalized.slice(0, 8),
    nic: normalized.slice(9),
    multicast: (first & 0b01) === 1,
    locallyAdministered: (first & 0b10) === 0b10,
    broadcast: normalized === BROADCAST_MAC,
    firstByteBits: first.toString(2).padStart(8, '0'),
  }
}
