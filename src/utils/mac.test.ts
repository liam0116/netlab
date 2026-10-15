import { describe, expect, it } from 'vitest'
import { BROADCAST_MAC, describeMac, isValidMac, macFromIp, normalizeMac } from './mac'

describe('MAC helpers', () => {
  it('validates the common notations', () => {
    for (const mac of ['00:1A:2b:3c:4d:5e', '00-1a-2b-3c-4d-5e', '001a2b3c4d5e', BROADCAST_MAC]) expect(isValidMac(mac), mac).toBe(true)
    for (const mac of ['', '00:1a:2b:3c:4d', '00:1a:2b:3c:4d:5g', '00:1a-2b:3c:4d:5e', '001a.2b3c.4d5e']) expect(isValidMac(mac), mac).toBe(false)
  })

  it('normalizes to lowercase colons', () => {
    expect(normalizeMac('00-1A-2B-3C-4D-5E')).toBe('00:1a:2b:3c:4d:5e')
    expect(normalizeMac('001A2B3C4D5E')).toBe('00:1a:2b:3c:4d:5e')
    expect(normalizeMac('nope')).toBeNull()
  })

  it('derives a stable locally administered MAC from an IP', () => {
    expect(macFromIp('192.168.1.10')).toBe('02:00:c0:a8:01:0a')
    expect(describeMac(macFromIp('10.0.0.1')).locallyAdministered).toBe(true)
    expect(macFromIp('10.0.0.1')).not.toBe(macFromIp('10.0.0.2'))
  })

  it('splits OUI / NIC and reads the I/G and U/L bits', () => {
    const vendor = describeMac('3c:ec:ef:12:34:56')
    expect(vendor.oui).toBe('3c:ec:ef')
    expect(vendor.nic).toBe('12:34:56')
    expect(vendor.multicast).toBe(false)
    expect(vendor.locallyAdministered).toBe(false)
    expect(vendor.firstByteBits).toBe('00111100')
    expect(describeMac('01:00:5e:00:00:01').multicast).toBe(true)
    expect(describeMac(BROADCAST_MAC)).toMatchObject({ broadcast: true, multicast: true })
  })
})
