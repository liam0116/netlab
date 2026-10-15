/**
 * IPv4 計算核心。
 *
 * 所有計算都以 32-bit unsigned integer 進行真正的 bitwise 運算，
 * 不 hardcode 任何答案。JavaScript 的 bitwise 運算子會回傳 signed 32-bit，
 * 所以每次運算後都用 `>>> 0` 轉回 unsigned。
 */
import type {
  AddressType,
  BinaryStep,
  BinaryToDecimalResult,
  CidrTableRow,
  GatewayIssue,
  GatewayValidationResult,
  IPv4Class,
  IPv4Int,
  SameSubnetResult,
  SubnetBlock,
  SubnetBlockBreakdown,
  SubnetInfo,
  ValidationError,
} from '@/types/network'

export const PLACE_VALUES = [128, 64, 32, 16, 8, 4, 2, 1] as const

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/** Returns a validation error, or null if `input` is a valid dotted-decimal IPv4 address. */
export function validateIPv4(input: string): ValidationError | null {
  const value = input.trim()
  if (value === '') return { key: 'validation.ipRequired' }
  const match = IPV4_PATTERN.exec(value)
  if (!match) return { key: 'validation.ipFormat' }
  for (const octet of match.slice(1)) {
    if (octet.length > 1 && octet.startsWith('0')) return { key: 'validation.ipLeadingZero', params: { octet } }
    if (Number(octet) > 255) return { key: 'validation.ipOctetRange', params: { octet } }
  }
  return null
}

export function isValidIPv4(input: string): boolean {
  return validateIPv4(input) === null
}

/** IPv6 literal check that works in browsers and Node (the WHATWG URL parser validates it). */
export function isValidIPv6(input: string): boolean {
  const v = input.trim()
  if (!v.includes(':') || /[^0-9a-f:.]/i.test(v)) return false
  try {
    new URL(`http://[${v}]/`)
    return true
  } catch {
    return false
  }
}

/** Dotted-decimal → 32-bit unsigned integer. Returns null when invalid. */
export function parseIPv4(input: string): IPv4Int | null {
  if (!isValidIPv4(input)) return null
  return input
    .trim()
    .split('.')
    .reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0)
}

/** Like parseIPv4 but throws; for internal use after validation. */
export function ipToInt(input: string): IPv4Int {
  const value = parseIPv4(input)
  if (value === null) throw new Error(`Invalid IPv4 address: ${input}`)
  return value
}

/** 32-bit unsigned integer → dotted-decimal. */
export function intToIp(value: IPv4Int): string {
  const v = value >>> 0
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff].join('.')
}

export function intToOctets(value: IPv4Int): [number, number, number, number] {
  const v = value >>> 0
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]
}

export function isValidCidr(cidr: number): boolean {
  return Number.isInteger(cidr) && cidr >= 0 && cidr <= 32
}

/** Accepts "27", "/27" or 27. Returns null if not 0 ~ 32. */
export function parseCidr(input: string | number): number | null {
  if (typeof input === 'number') return isValidCidr(input) ? input : null
  const value = input.trim().replace(/^\//, '')
  if (!/^\d{1,2}$/.test(value)) return null
  const cidr = Number(value)
  return isValidCidr(cidr) ? cidr : null
}

/** Parses "192.168.1.10/24" style notation. */
export function parseCidrNotation(input: string): { ip: string; cidr: number } | null {
  const [ip, prefix, ...rest] = input.trim().split('/')
  if (ip === undefined || prefix === undefined || rest.length > 0) return null
  const cidr = parseCidr(prefix)
  if (cidr === null || !isValidIPv4(ip)) return null
  return { ip: ip.trim(), cidr }
}

// ---------------------------------------------------------------------------
// Mask / CIDR conversion
// ---------------------------------------------------------------------------

/** /27 → 0xFFFFFFE0. Shifting by 32 is a no-op in JS, so /0 is special-cased. */
export function cidrToMaskInt(cidr: number): IPv4Int {
  if (!isValidCidr(cidr)) throw new Error(`Invalid CIDR: ${cidr}`)
  return cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0
}

export function cidrToMask(cidr: number): string {
  return intToIp(cidrToMaskInt(cidr))
}

export function cidrToWildcard(cidr: number): string {
  return intToIp(~cidrToMaskInt(cidr) >>> 0)
}

/**
 * A mask is valid only when its 1-bits are contiguous from the left.
 * Inverting it must then give 0...01...1, and x & (x + 1) === 0 holds only for that shape.
 */
export function isContiguousMask(mask: IPv4Int): boolean {
  const inverted = ~mask >>> 0
  return (inverted & (inverted + 1)) >>> 0 === 0
}

/** Returns a validation error, or null if `input` is a valid subnet mask. */
export function validateMask(input: string): ValidationError | null {
  const ipError = validateIPv4(input)
  if (ipError) return ipError
  if (!isContiguousMask(ipToInt(input))) return { key: 'validation.maskNotContiguous' }
  return null
}

/** Counts the 1-bits of a mask (popcount). */
export function countBits(value: IPv4Int): number {
  let v = value >>> 0
  let count = 0
  while (v !== 0) {
    count += v & 1
    v >>>= 1
  }
  return count
}

/** 255.255.255.224 → 27. Returns null for invalid / non-contiguous masks. */
export function maskToCidr(mask: string): number | null {
  if (validateMask(mask) !== null) return null
  return countBits(ipToInt(mask))
}

/** Network bits contributed by each octet, e.g. 255.255.255.224 → [8, 8, 8, 3]. */
export function maskOctetBitCounts(mask: string): number[] {
  return intToOctets(ipToInt(mask)).map((octet) => countBits(octet))
}

// ---------------------------------------------------------------------------
// Binary helpers
// ---------------------------------------------------------------------------

export function toBinaryOctet(octet: number): string {
  return (octet & 0xff).toString(2).padStart(8, '0')
}

/** 192.168.1.1 → "11000000.10101000.00000001.00000001" */
export function toBinaryString(value: IPv4Int): string {
  return intToOctets(value).map(toBinaryOctet).join('.')
}

/** Splits a 32-bit value into an array of 32 bits, MSB first. */
export function toBitArray(value: IPv4Int): (0 | 1)[] {
  const v = value >>> 0
  return Array.from({ length: 32 }, (_, i) => ((v >>> (31 - i)) & 1) as 0 | 1)
}

/**
 * Decimal (0 ~ 255) → binary, step by step, the way it is taught:
 * compare the remainder with each place value; if it fits, bit = 1 and subtract.
 */
export function decimalToBinarySteps(value: number): BinaryStep[] {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`Octet must be an integer between 0 and 255: ${value}`)
  }
  let remainder = value
  return PLACE_VALUES.map((placeValue, bitIndex) => {
    const bit: 0 | 1 = remainder >= placeValue ? 1 : 0
    const remainderBefore = remainder
    if (bit) remainder -= placeValue
    return { bitIndex, placeValue, remainderBefore, bit, remainderAfter: remainder }
  })
}

/** Returns a validation error, or null if `input` is a valid 1 ~ 8 bit binary string. */
export function validateBinaryOctet(input: string): ValidationError | null {
  const value = input.replace(/\s/g, '')
  if (value === '') return { key: 'validation.binaryRequired' }
  if (!/^[01]+$/.test(value)) return { key: 'validation.binaryChars' }
  if (value.length > 8) return { key: 'validation.binaryLength' }
  return null
}

/** "11000000" → 192 with the contributing place values [128, 64]. Shorter input is left-padded. */
export function binaryToDecimal(input: string): BinaryToDecimalResult {
  const error = validateBinaryOctet(input)
  if (error) throw new Error(`Invalid binary octet: ${input} (${error.key})`)
  const bits = input
    .replace(/\s/g, '')
    .padStart(8, '0')
    .split('')
    .map((b) => (b === '1' ? 1 : 0)) as (0 | 1)[]
  const terms = PLACE_VALUES.filter((_, i) => bits[i] === 1)
  return { value: terms.reduce((sum, t) => sum + t, 0), bits, terms }
}

// ---------------------------------------------------------------------------
// Subnet calculation
// ---------------------------------------------------------------------------

export function getTotalAddresses(cidr: number): number {
  return 2 ** (32 - cidr)
}

/**
 * Usable hosts. /31 is a point-to-point link where both addresses are usable (RFC 3021),
 * and /32 is a single host route.
 */
export function getUsableHosts(cidr: number): number {
  if (cidr === 32) return 1
  if (cidr === 31) return 2
  return getTotalAddresses(cidr) - 2
}

/** Smallest prefix whose usable host count is >= `hosts`. Returns null if it doesn't fit IPv4. */
export function hostsToCidr(hosts: number): number | null {
  if (!Number.isInteger(hosts) || hosts < 1) return null
  for (let cidr = 32; cidr >= 0; cidr--) {
    if (getUsableHosts(cidr) >= hosts) return cidr
  }
  return null
}

export function getNetworkInt(ip: IPv4Int, cidr: number): IPv4Int {
  return (ip & cidrToMaskInt(cidr)) >>> 0
}

export function getBroadcastInt(ip: IPv4Int, cidr: number): IPv4Int {
  return (ip | ~cidrToMaskInt(cidr)) >>> 0
}

export function getIPv4Class(ip: IPv4Int): IPv4Class {
  const first = ip >>> 24
  if (first < 128) return 'A'
  if (first < 192) return 'B'
  if (first < 224) return 'C'
  if (first < 240) return 'D (Multicast)'
  return 'E (Reserved)'
}

const ADDRESS_RANGES: { network: string; cidr: number; type: AddressType }[] = [
  { network: '255.255.255.255', cidr: 32, type: 'Broadcast' },
  { network: '0.0.0.0', cidr: 32, type: 'Unspecified' },
  { network: '0.0.0.0', cidr: 8, type: 'Reserved' },
  { network: '10.0.0.0', cidr: 8, type: 'Private' },
  { network: '100.64.0.0', cidr: 10, type: 'CGNAT' },
  { network: '127.0.0.0', cidr: 8, type: 'Loopback' },
  { network: '169.254.0.0', cidr: 16, type: 'Link-local' },
  { network: '172.16.0.0', cidr: 12, type: 'Private' },
  { network: '192.168.0.0', cidr: 16, type: 'Private' },
  { network: '224.0.0.0', cidr: 4, type: 'Multicast' },
  { network: '240.0.0.0', cidr: 4, type: 'Reserved' },
]

export function isInSubnet(ip: IPv4Int, network: IPv4Int, cidr: number): boolean {
  return getNetworkInt(ip, cidr) === getNetworkInt(network, cidr)
}

export function getAddressType(ip: IPv4Int): AddressType {
  const range = ADDRESS_RANGES.find((r) => isInSubnet(ip, ipToInt(r.network), r.cidr))
  return range?.type ?? 'Public'
}

export function calculateSubnet(ip: string, cidr: number): SubnetInfo {
  const ipInt = ipToInt(ip)
  if (!isValidCidr(cidr)) throw new Error(`Invalid CIDR: ${cidr}`)

  const maskInt = cidrToMaskInt(cidr)
  const network = getNetworkInt(ipInt, cidr)
  const broadcast = getBroadcastInt(ipInt, cidr)

  let firstHost: IPv4Int
  let lastHost: IPv4Int
  if (cidr >= 31) {
    firstHost = network
    lastHost = broadcast
  } else {
    firstHost = (network + 1) >>> 0
    lastHost = (broadcast - 1) >>> 0
  }

  return {
    ip: intToIp(ipInt),
    cidr,
    subnetMask: intToIp(maskInt),
    wildcardMask: intToIp(~maskInt >>> 0),
    networkAddress: intToIp(network),
    broadcastAddress: intToIp(broadcast),
    firstHost: intToIp(firstHost),
    lastHost: intToIp(lastHost),
    totalAddresses: getTotalAddresses(cidr),
    usableHosts: getUsableHosts(cidr),
    networkBits: cidr,
    hostBits: 32 - cidr,
    binaryIp: toBinaryString(ipInt),
    binaryMask: toBinaryString(maskInt),
    binaryNetwork: toBinaryString(network),
    binaryBroadcast: toBinaryString(broadcast),
    ipClass: getIPv4Class(ipInt),
    addressType: getAddressType(ipInt),
  }
}

/**
 * The "block size" method: find the octet where the mask stops being 255,
 * block size = 256 - mask octet, and list the ranges that octet is split into.
 * e.g. /27 → 4th octet, mask 224, block 32 → 0-31, 32-63, ... 224-255.
 */
export function getSubnetBlocks(ip: string, cidr: number): SubnetBlockBreakdown {
  const octets = intToOctets(ipToInt(ip))
  const maskOctets = intToOctets(cidrToMaskInt(cidr))
  const octetIndex = Math.min(3, Math.floor(cidr / 8))
  const maskOctet = maskOctets[octetIndex] ?? 0
  const ipOctet = octets[octetIndex] ?? 0
  const blockSize = 256 - maskOctet
  const totalBlocks = 256 / blockSize

  const blocks: SubnetBlock[] = Array.from({ length: totalBlocks }, (_, i) => {
    const start = i * blockSize
    const end = start + blockSize - 1
    return { start, end, containsIp: ipOctet >= start && ipOctet <= end }
  })

  return { octetIndex, maskOctet, blockSize, ipOctet, blocks, totalBlocks }
}

/**
 * Shortens a long block list for display: keeps the first and last block plus a window
 * around the block containing the IP. `null` marks an ellipsis.
 */
export function compactBlocks(blocks: SubnetBlock[], max = 16, around = 2): (SubnetBlock | null)[] {
  if (blocks.length <= max) return blocks
  const hit = Math.max(0, blocks.findIndex((b) => b.containsIp))
  const keep = new Set<number>([0, blocks.length - 1])
  for (let i = hit - around; i <= hit + around; i++) {
    if (i >= 0 && i < blocks.length) keep.add(i)
  }
  const result: (SubnetBlock | null)[] = []
  let previous = -1
  for (const i of [...keep].sort((x, y) => x - y)) {
    if (previous !== -1 && i - previous > 1) result.push(null)
    result.push(blocks[i] as SubnetBlock)
    previous = i
  }
  return result
}

// ---------------------------------------------------------------------------
// Checkers
// ---------------------------------------------------------------------------

export function checkSameSubnet(ipA: string, cidrA: number, ipB: string, cidrB: number): SameSubnetResult {
  const a = calculateSubnet(ipA, cidrA)
  const b = calculateSubnet(ipB, cidrB)
  const aInt = ipToInt(ipA)
  const bInt = ipToInt(ipB)
  const aSeesBLocal = isInSubnet(bInt, aInt, cidrA)
  const bSeesALocal = isInSubnet(aInt, bInt, cidrB)
  const maskMismatch = cidrA !== cidrB
  return {
    same: !maskMismatch && a.networkAddress === b.networkAddress,
    a,
    b,
    aSeesBLocal,
    bSeesALocal,
    maskMismatch,
  }
}

export function validateGateway(serverIp: string, cidr: number, gatewayIp: string): GatewayValidationResult {
  const server = calculateSubnet(serverIp, cidr)
  const serverInt = ipToInt(serverIp)
  const gatewayInt = ipToInt(gatewayIp)
  const network = getNetworkInt(serverInt, cidr)
  const broadcast = getBroadcastInt(serverInt, cidr)
  const issues: GatewayIssue[] = []

  if (cidr === 32) {
    issues.push({ code: 'no-usable-gateway', level: 'error', params: {} })
  } else if (!isInSubnet(gatewayInt, serverInt, cidr)) {
    issues.push({ code: 'outside-subnet', level: 'error', params: {} })
  } else {
    if (cidr <= 30 && gatewayInt === network) {
      issues.push({ code: 'is-network-address', level: 'error', params: { address: intToIp(network) } })
    }
    if (cidr <= 30 && gatewayInt === broadcast) {
      issues.push({ code: 'is-broadcast-address', level: 'error', params: { address: intToIp(broadcast) } })
    }
  }

  if (gatewayInt === serverInt) {
    issues.push({ code: 'same-as-host', level: 'error', params: {} })
  }

  return {
    valid: issues.every((i) => i.level !== 'error'),
    server,
    gatewayIp: intToIp(gatewayInt),
    gatewayNetwork: intToIp(getNetworkInt(gatewayInt, cidr)),
    issues,
  }
}

export function buildCidrTable(): CidrTableRow[] {
  return Array.from({ length: 33 }, (_, cidr) => ({
    cidr,
    mask: cidrToMask(cidr),
    wildcard: cidrToWildcard(cidr),
    totalAddresses: getTotalAddresses(cidr),
    usableHosts: getUsableHosts(cidr),
  }))
}
