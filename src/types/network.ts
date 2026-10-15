/** 32-bit unsigned IPv4 address stored as a number (0 ~ 4294967295). */
export type IPv4Int = number

export interface SubnetInfo {
  ip: string
  cidr: number
  subnetMask: string
  wildcardMask: string
  networkAddress: string
  broadcastAddress: string
  firstHost: string
  lastHost: string
  totalAddresses: number
  usableHosts: number
  networkBits: number
  hostBits: number
  binaryIp: string
  binaryMask: string
  binaryNetwork: string
  binaryBroadcast: string
  ipClass: IPv4Class
  addressType: AddressType
}

export type IPv4Class = 'A' | 'B' | 'C' | 'D (Multicast)' | 'E (Reserved)'

export type AddressType =
  | 'Private'
  | 'Public'
  | 'Loopback'
  | 'Link-local'
  | 'CGNAT'
  | 'Multicast'
  | 'Reserved'
  | 'Unspecified'
  | 'Broadcast'

/** One step of the decimal → binary "subtract the place value" animation. */
export interface BinaryStep {
  bitIndex: number // 0 = MSB (128), 7 = LSB (1)
  placeValue: number
  remainderBefore: number
  bit: 0 | 1
  remainderAfter: number
}

export interface BinaryToDecimalResult {
  value: number
  bits: (0 | 1)[]
  /** Place values whose bit is 1, e.g. [128, 64] for 11000000. */
  terms: number[]
}

/** One block when splitting the "interesting octet" by block size, e.g. 128-159 for /27. */
export interface SubnetBlock {
  start: number
  end: number
  containsIp: boolean
}

export interface SubnetBlockBreakdown {
  /** 0-based octet index where the mask stops being 255 (the "interesting" octet). */
  octetIndex: number
  maskOctet: number
  blockSize: number
  ipOctet: number
  blocks: SubnetBlock[]
  totalBlocks: number
}

export interface SameSubnetResult {
  same: boolean
  a: SubnetInfo
  b: SubnetInfo
  /** True if A considers B local (A's mask applied to B). */
  aSeesBLocal: boolean
  /** True if B considers A local (B's mask applied to A). */
  bSeesALocal: boolean
  maskMismatch: boolean
}

export type GatewayIssueCode =
  | 'outside-subnet'
  | 'is-network-address'
  | 'is-broadcast-address'
  | 'same-as-host'
  | 'no-usable-gateway'

export type GatewayIssueLevel = 'error' | 'warning'

export interface GatewayIssue {
  code: GatewayIssueCode
  level: GatewayIssueLevel
  /** Values for the translated message, e.g. the offending address. */
  params: Record<string, string>
}

/** A validation failure as an i18n message key plus parameters; the UI translates it. */
export interface ValidationError {
  key: string
  params?: Record<string, string | number>
}

export interface GatewayValidationResult {
  valid: boolean
  server: SubnetInfo
  gatewayIp: string
  /** Network the gateway would belong to if it used the server's mask. */
  gatewayNetwork: string
  issues: GatewayIssue[]
}

export interface CidrTableRow {
  cidr: number
  mask: string
  wildcard: string
  totalAddresses: number
  usableHosts: number
}
