import { describe, expect, it } from 'vitest'
import {
  binaryToDecimal,
  buildCidrTable,
  calculateSubnet,
  checkSameSubnet,
  cidrToMask,
  cidrToMaskInt,
  cidrToWildcard,
  compactBlocks,
  countBits,
  decimalToBinarySteps,
  getAddressType,
  getIPv4Class,
  getSubnetBlocks,
  getUsableHosts,
  hostsToCidr,
  intToIp,
  ipToInt,
  isContiguousMask,
  isValidIPv4,
  maskOctetBitCounts,
  maskToCidr,
  parseCidr,
  parseCidrNotation,
  parseIPv4,
  toBinaryString,
  toBitArray,
  validateBinaryOctet,
  validateGateway,
  validateIPv4,
  validateMask,
} from './network'

describe('IPv4 parsing', () => {
  it('accepts valid addresses', () => {
    for (const ip of ['0.0.0.0', '192.168.50.137', '255.255.255.255', '10.0.0.1', ' 8.8.8.8 ']) {
      expect(isValidIPv4(ip)).toBe(true)
    }
  })

  it('rejects invalid addresses', () => {
    for (const ip of ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', 'a.b.c.d', '1.2.3.-4', '1..2.3', '01.2.3.4', '1.2.3.4/24']) {
      expect(isValidIPv4(ip), ip).toBe(false)
    }
  })

  it('explains why an address is invalid', () => {
    expect(validateIPv4('300.1.1.1')).toEqual({ key: 'validation.ipOctetRange', params: { octet: '300' } })
    expect(validateIPv4('010.1.1.1')).toEqual({ key: 'validation.ipLeadingZero', params: { octet: '010' } })
    expect(validateIPv4('1.2.3')).toEqual({ key: 'validation.ipFormat' })
    expect(validateIPv4('')).toEqual({ key: 'validation.ipRequired' })
  })

  it('converts between dotted-decimal and uint32', () => {
    expect(ipToInt('0.0.0.0')).toBe(0)
    expect(ipToInt('255.255.255.255')).toBe(4294967295)
    expect(ipToInt('192.168.50.137')).toBe(3232248457)
    expect(intToIp(3232248457)).toBe('192.168.50.137')
    expect(intToIp(4294967295)).toBe('255.255.255.255')
    expect(parseIPv4('nope')).toBeNull()
    expect(() => ipToInt('nope')).toThrow()
  })

  it('round-trips arbitrary addresses', () => {
    for (const ip of ['1.2.3.4', '128.0.0.1', '172.31.255.254', '224.0.0.5']) {
      expect(intToIp(ipToInt(ip))).toBe(ip)
    }
  })

  it('parses CIDR prefixes', () => {
    expect(parseCidr('27')).toBe(27)
    expect(parseCidr('/27')).toBe(27)
    expect(parseCidr(0)).toBe(0)
    expect(parseCidr(32)).toBe(32)
    expect(parseCidr('33')).toBeNull()
    expect(parseCidr('-1')).toBeNull()
    expect(parseCidr('2.5')).toBeNull()
    expect(parseCidr(33)).toBeNull()
  })

  it('parses ip/cidr notation', () => {
    expect(parseCidrNotation('192.168.50.137/27')).toEqual({ ip: '192.168.50.137', cidr: 27 })
    expect(parseCidrNotation('192.168.50.137')).toBeNull()
    expect(parseCidrNotation('192.168.50.137/40')).toBeNull()
    expect(parseCidrNotation('1.2.3.4/24/1')).toBeNull()
  })
})

describe('mask and CIDR conversion', () => {
  it('converts CIDR to mask with bitwise shifts', () => {
    expect(cidrToMask(0)).toBe('0.0.0.0')
    expect(cidrToMask(8)).toBe('255.0.0.0')
    expect(cidrToMask(16)).toBe('255.255.0.0')
    expect(cidrToMask(24)).toBe('255.255.255.0')
    expect(cidrToMask(26)).toBe('255.255.255.192')
    expect(cidrToMask(27)).toBe('255.255.255.224')
    expect(cidrToMask(31)).toBe('255.255.255.254')
    expect(cidrToMask(32)).toBe('255.255.255.255')
    expect(cidrToMaskInt(1)).toBe(0x80000000)
    expect(() => cidrToMask(33)).toThrow()
  })

  it('converts CIDR to wildcard', () => {
    expect(cidrToWildcard(27)).toBe('0.0.0.31')
    expect(cidrToWildcard(0)).toBe('255.255.255.255')
    expect(cidrToWildcard(32)).toBe('0.0.0.0')
  })

  it('converts mask to CIDR', () => {
    expect(maskToCidr('255.255.255.224')).toBe(27)
    expect(maskToCidr('255.255.240.0')).toBe(20)
    expect(maskToCidr('0.0.0.0')).toBe(0)
    expect(maskToCidr('255.255.255.255')).toBe(32)
  })

  it('round-trips every prefix', () => {
    for (let cidr = 0; cidr <= 32; cidr++) {
      expect(maskToCidr(cidrToMask(cidr))).toBe(cidr)
    }
  })

  it('rejects non-contiguous masks', () => {
    expect(isContiguousMask(ipToInt('255.0.255.0'))).toBe(false)
    expect(isContiguousMask(ipToInt('255.255.255.225'))).toBe(false)
    expect(maskToCidr('255.255.0.255')).toBeNull()
    expect(validateMask('255.255.255.1')).toEqual({ key: 'validation.maskNotContiguous' })
    expect(validateMask('255.255.255.224')).toBeNull()
  })

  it('counts network bits per octet', () => {
    expect(maskOctetBitCounts('255.255.255.224')).toEqual([8, 8, 8, 3])
    expect(countBits(0xffffffff)).toBe(32)
    expect(countBits(0)).toBe(0)
  })
})

describe('binary helpers', () => {
  it('formats addresses as dotted binary', () => {
    expect(toBinaryString(ipToInt('255.255.255.224'))).toBe('11111111.11111111.11111111.11100000')
    expect(toBinaryString(ipToInt('192.168.1.1'))).toBe('11000000.10101000.00000001.00000001')
  })

  it('splits into 32 bits MSB first', () => {
    const bits = toBitArray(ipToInt('128.0.0.1'))
    expect(bits).toHaveLength(32)
    expect(bits[0]).toBe(1)
    expect(bits[31]).toBe(1)
    expect(bits.filter((b) => b === 1)).toHaveLength(2)
  })

  it('builds the subtract-the-place-value steps for 192', () => {
    const steps = decimalToBinarySteps(192)
    expect(steps.map((s) => s.bit).join('')).toBe('11000000')
    expect(steps[0]).toEqual({ bitIndex: 0, placeValue: 128, remainderBefore: 192, bit: 1, remainderAfter: 64 })
    expect(steps[1]).toEqual({ bitIndex: 1, placeValue: 64, remainderBefore: 64, bit: 1, remainderAfter: 0 })
    expect(steps[7]?.remainderAfter).toBe(0)
  })

  it('produces correct bits for every octet value', () => {
    for (let n = 0; n <= 255; n++) {
      const bits = decimalToBinarySteps(n).map((s) => s.bit).join('')
      expect(bits).toBe(n.toString(2).padStart(8, '0'))
    }
  })

  it('rejects out-of-range octets', () => {
    expect(() => decimalToBinarySteps(256)).toThrow()
    expect(() => decimalToBinarySteps(-1)).toThrow()
    expect(() => decimalToBinarySteps(1.5)).toThrow()
  })

  it('converts binary back to decimal with terms', () => {
    expect(binaryToDecimal('11000000')).toEqual({ value: 192, bits: [1, 1, 0, 0, 0, 0, 0, 0], terms: [128, 64] })
    expect(binaryToDecimal('101').value).toBe(5)
    expect(binaryToDecimal('1111 1111').value).toBe(255)
    expect(binaryToDecimal('0').terms).toEqual([])
    expect(() => binaryToDecimal('102')).toThrow()
  })

  it('validates binary input', () => {
    expect(validateBinaryOctet('110000001')?.key).toBe('validation.binaryLength')
    expect(validateBinaryOctet('12')?.key).toBe('validation.binaryChars')
    expect(validateBinaryOctet('')?.key).toBe('validation.binaryRequired')
    expect(validateBinaryOctet('1010')).toBeNull()
  })
})

describe('calculateSubnet', () => {
  it('192.168.50.137/27 (spec example)', () => {
    const r = calculateSubnet('192.168.50.137', 27)
    expect(r.subnetMask).toBe('255.255.255.224')
    expect(r.networkAddress).toBe('192.168.50.128')
    expect(r.broadcastAddress).toBe('192.168.50.159')
    expect(r.firstHost).toBe('192.168.50.129')
    expect(r.lastHost).toBe('192.168.50.158')
    expect(r.totalAddresses).toBe(32)
    expect(r.usableHosts).toBe(30)
    expect(r.networkBits).toBe(27)
    expect(r.hostBits).toBe(5)
    expect(r.wildcardMask).toBe('0.0.0.31')
    expect(r.binaryIp).toBe('11000000.10101000.00110010.10001001')
    expect(r.binaryMask).toBe('11111111.11111111.11111111.11100000')
    expect(r.ipClass).toBe('C')
    expect(r.addressType).toBe('Private')
  })

  it('10.20.30.150/26', () => {
    const r = calculateSubnet('10.20.30.150', 26)
    expect(r.networkAddress).toBe('10.20.30.128')
    expect(r.broadcastAddress).toBe('10.20.30.191')
    expect(r.usableHosts).toBe(62)
  })

  it('handles non-octet-aligned large networks', () => {
    const r = calculateSubnet('172.20.77.9', 20)
    expect(r.subnetMask).toBe('255.255.240.0')
    expect(r.networkAddress).toBe('172.20.64.0')
    expect(r.broadcastAddress).toBe('172.20.79.255')
    expect(r.firstHost).toBe('172.20.64.1')
    expect(r.lastHost).toBe('172.20.79.254')
    expect(r.usableHosts).toBe(4094)
  })

  it('handles /0', () => {
    const r = calculateSubnet('8.8.8.8', 0)
    expect(r.networkAddress).toBe('0.0.0.0')
    expect(r.broadcastAddress).toBe('255.255.255.255')
    expect(r.totalAddresses).toBe(4294967296)
    expect(r.usableHosts).toBe(4294967294)
  })

  it('handles /31 point-to-point (RFC 3021)', () => {
    const r = calculateSubnet('10.0.0.1', 31)
    expect(r.networkAddress).toBe('10.0.0.0')
    expect(r.firstHost).toBe('10.0.0.0')
    expect(r.lastHost).toBe('10.0.0.1')
    expect(r.usableHosts).toBe(2)
  })

  it('handles /32 host route', () => {
    const r = calculateSubnet('10.0.0.5', 32)
    expect(r.networkAddress).toBe('10.0.0.5')
    expect(r.broadcastAddress).toBe('10.0.0.5')
    expect(r.firstHost).toBe('10.0.0.5')
    expect(r.usableHosts).toBe(1)
  })

  it('throws on bad input', () => {
    expect(() => calculateSubnet('1.2.3', 24)).toThrow()
    expect(() => calculateSubnet('1.2.3.4', 33)).toThrow()
  })
})

describe('host counts', () => {
  it('computes usable hosts', () => {
    expect(getUsableHosts(24)).toBe(254)
    expect(getUsableHosts(27)).toBe(30)
    expect(getUsableHosts(30)).toBe(2)
  })

  it('finds the smallest prefix for a host count', () => {
    expect(hostsToCidr(20)).toBe(27)
    expect(hostsToCidr(30)).toBe(27)
    expect(hostsToCidr(31)).toBe(26)
    expect(hostsToCidr(50)).toBe(26)
    expect(hostsToCidr(200)).toBe(24)
    expect(hostsToCidr(1)).toBe(32)
    expect(hostsToCidr(0)).toBeNull()
  })
})

describe('address classification', () => {
  it('classifies by first octet', () => {
    expect(getIPv4Class(ipToInt('10.0.0.1'))).toBe('A')
    expect(getIPv4Class(ipToInt('172.16.0.1'))).toBe('B')
    expect(getIPv4Class(ipToInt('192.168.0.1'))).toBe('C')
    expect(getIPv4Class(ipToInt('224.0.0.1'))).toBe('D (Multicast)')
    expect(getIPv4Class(ipToInt('250.0.0.1'))).toBe('E (Reserved)')
  })

  it('detects special ranges', () => {
    expect(getAddressType(ipToInt('10.1.2.3'))).toBe('Private')
    expect(getAddressType(ipToInt('172.31.255.255'))).toBe('Private')
    expect(getAddressType(ipToInt('172.32.0.1'))).toBe('Public')
    expect(getAddressType(ipToInt('192.168.1.1'))).toBe('Private')
    expect(getAddressType(ipToInt('8.8.8.8'))).toBe('Public')
    expect(getAddressType(ipToInt('127.0.0.1'))).toBe('Loopback')
    expect(getAddressType(ipToInt('169.254.10.1'))).toBe('Link-local')
    expect(getAddressType(ipToInt('100.64.0.1'))).toBe('CGNAT')
    expect(getAddressType(ipToInt('239.1.1.1'))).toBe('Multicast')
    expect(getAddressType(ipToInt('255.255.255.255'))).toBe('Broadcast')
    expect(getAddressType(ipToInt('0.0.0.0'))).toBe('Unspecified')
  })
})

describe('getSubnetBlocks', () => {
  it('splits the 4th octet into 32-address blocks for /27', () => {
    const r = getSubnetBlocks('192.168.50.137', 27)
    expect(r.octetIndex).toBe(3)
    expect(r.maskOctet).toBe(224)
    expect(r.blockSize).toBe(32)
    expect(r.totalBlocks).toBe(8)
    expect(r.blocks.map((b) => `${b.start}-${b.end}`)).toEqual([
      '0-31', '32-63', '64-95', '96-127', '128-159', '160-191', '192-223', '224-255',
    ])
    expect(r.blocks.find((b) => b.containsIp)).toMatchObject({ start: 128, end: 159 })
  })

  it('uses the 3rd octet for /20', () => {
    const r = getSubnetBlocks('172.20.77.9', 20)
    expect(r.octetIndex).toBe(2)
    expect(r.blockSize).toBe(16)
    expect(r.blocks.find((b) => b.containsIp)).toMatchObject({ start: 64, end: 79 })
  })

  it('treats octet boundaries as a single 256 block', () => {
    const r = getSubnetBlocks('192.168.1.10', 24)
    expect(r.octetIndex).toBe(3)
    expect(r.blockSize).toBe(256)
    expect(r.totalBlocks).toBe(1)
  })

  it('compacts long lists around the IP', () => {
    const { blocks } = getSubnetBlocks('192.168.1.130', 30)
    expect(blocks).toHaveLength(64)
    const compact = compactBlocks(blocks)
    expect(compact.length).toBeLessThan(16)
    expect(compact[0]).toMatchObject({ start: 0 })
    expect(compact.at(-1)).toMatchObject({ end: 255 })
    expect(compact).toContain(null)
    expect(compact.some((b) => b?.containsIp)).toBe(true)
    expect(compactBlocks(blocks.slice(0, 8))).toHaveLength(8)
  })
})

describe('checkSameSubnet', () => {
  it('same /24', () => {
    const r = checkSameSubnet('192.168.1.10', 24, '192.168.1.20', 24)
    expect(r.same).toBe(true)
    expect(r.a.networkAddress).toBe('192.168.1.0')
    expect(r.b.networkAddress).toBe('192.168.1.0')
  })

  it('different /24', () => {
    const r = checkSameSubnet('192.168.1.10', 24, '192.168.2.10', 24)
    expect(r.same).toBe(false)
    expect(r.aSeesBLocal).toBe(false)
    expect(r.b.networkAddress).toBe('192.168.2.0')
  })

  it('splits by /27 boundary', () => {
    expect(checkSameSubnet('192.168.50.130', 27, '192.168.50.158', 27).same).toBe(true)
    expect(checkSameSubnet('192.168.50.130', 27, '192.168.50.160', 27).same).toBe(false)
  })

  it('flags mask mismatch with asymmetric view', () => {
    const r = checkSameSubnet('192.168.1.10', 24, '192.168.1.200', 25)
    expect(r.same).toBe(false)
    expect(r.maskMismatch).toBe(true)
    expect(r.aSeesBLocal).toBe(true)
    expect(r.bSeesALocal).toBe(false)
  })
})

describe('validateGateway', () => {
  it('accepts a gateway in the same subnet (spec example)', () => {
    const r = validateGateway('10.20.30.150', 26, '10.20.30.129')
    expect(r.valid).toBe(true)
    expect(r.issues).toHaveLength(0)
    expect(r.server.networkAddress).toBe('10.20.30.128')
  })

  it('rejects a gateway outside the subnet (spec example)', () => {
    const r = validateGateway('192.168.10.50', 24, '192.168.20.1')
    expect(r.valid).toBe(false)
    expect(r.issues.map((i) => i.code)).toContain('outside-subnet')
    expect(r.server.networkAddress).toBe('192.168.10.0')
    expect(r.gatewayNetwork).toBe('192.168.20.0')
  })

  it('rejects network and broadcast addresses', () => {
    expect(validateGateway('10.20.30.150', 26, '10.20.30.128').issues[0]).toMatchObject({
      code: 'is-network-address',
      params: { address: '10.20.30.128' },
    })
    expect(validateGateway('10.20.30.150', 26, '10.20.30.191').issues[0]?.code).toBe('is-broadcast-address')
  })

  it('rejects gateway equal to host', () => {
    const r = validateGateway('10.0.0.5', 24, '10.0.0.5')
    expect(r.valid).toBe(false)
    expect(r.issues.map((i) => i.code)).toContain('same-as-host')
  })

  it('allows the peer address on /31', () => {
    expect(validateGateway('10.0.0.0', 31, '10.0.0.1').valid).toBe(true)
  })

  it('rejects /32', () => {
    expect(validateGateway('10.0.0.5', 32, '10.0.0.1').issues[0]?.code).toBe('no-usable-gateway')
  })
})

describe('buildCidrTable', () => {
  it('has a row for /0 through /32', () => {
    const table = buildCidrTable()
    expect(table).toHaveLength(33)
    expect(table[27]).toEqual({
      cidr: 27,
      mask: '255.255.255.224',
      wildcard: '0.0.0.31',
      totalAddresses: 32,
      usableHosts: 30,
    })
  })
})

describe('isValidIPv6', () => {
  it('accepts IPv6 literals and rejects everything else', async () => {
    const { isValidIPv6 } = await import('./network')
    for (const v of ['::1', '2001:db8::1', 'fe80::1', '::ffff:10.0.0.1', '2001:0db8:0000:0000:0000:ff00:0042:8329']) expect(isValidIPv6(v), v).toBe(true)
    for (const v of ['', '10.0.0.1', '2001:db8::g', '1:2:3:4:5:6:7:8:9', 'fe80::1%eth0', 'example.com', ':::']) expect(isValidIPv6(v), v).toBe(false)
  })
})
