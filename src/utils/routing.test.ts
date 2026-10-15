import { describe, expect, it } from 'vitest'
import { formatRoute, lookupRoute, parseIpRoute, routePrefix, type Route } from './routing'

const table: Route[] = [
  { destination: 'default', via: '192.168.1.1', dev: 'eth0', metric: 100 },
  { destination: '192.168.1.0/24', dev: 'eth0', metric: 0 },
  { destination: '10.0.0.0/8', via: '192.168.1.254', dev: 'eth0', metric: 0 },
  { destination: '10.20.0.0/16', via: '172.16.0.1', dev: 'eth1', metric: 0 },
  { destination: '172.16.0.0/30', dev: 'eth1', metric: 0 },
]

describe('routePrefix', () => {
  it('handles default and host routes', () => {
    expect(routePrefix('default')).toEqual({ network: 0, cidr: 0 })
    expect(routePrefix('10.0.0.5')?.cidr).toBe(32)
    expect(routePrefix('10.0.0.5/24')?.network).toBe(0x0a000000)
    expect(routePrefix('garbage')).toBeNull()
  })
})

describe('lookupRoute (longest prefix match)', () => {
  it('picks the most specific route', () => {
    expect(lookupRoute(table, '10.20.30.40').match?.destination).toBe('10.20.0.0/16')
    expect(lookupRoute(table, '10.99.0.1').match?.destination).toBe('10.0.0.0/8')
    expect(lookupRoute(table, '192.168.1.50').match?.destination).toBe('192.168.1.0/24')
    expect(lookupRoute(table, '172.16.0.2').match?.dev).toBe('eth1')
  })

  it('falls back to the default route', () => {
    const r = lookupRoute(table, '8.8.8.8')
    expect(r.match?.via).toBe('192.168.1.1')
    expect(r.candidates.filter((c) => c.matches)).toHaveLength(1)
  })

  it('breaks prefix ties with the lowest metric', () => {
    const routes: Route[] = [
      { destination: 'default', via: '10.0.0.1', dev: 'eth0', metric: 200 },
      { destination: 'default', via: '10.0.1.1', dev: 'eth1', metric: 100 },
    ]
    expect(lookupRoute(routes, '1.1.1.1').match?.dev).toBe('eth1')
  })

  it('returns null without a matching route', () => {
    expect(lookupRoute(table.slice(1), '8.8.8.8').match).toBeNull()
    expect(() => lookupRoute(table, 'x')).toThrow()
  })
})

describe('parseIpRoute', () => {
  it('parses real ip route output', () => {
    const routes = parseIpRoute(`default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.10 metric 100
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10 metric 100
10.0.0.0/8 via 192.168.1.254 dev eth0

not a route
blackhole 10.1.0.0/16`)
    expect(routes).toEqual([
      { destination: 'default', via: '192.168.1.1', dev: 'eth0', metric: 100 },
      { destination: '192.168.1.0/24', via: undefined, dev: 'eth0', metric: 100 },
      { destination: '10.0.0.0/8', via: '192.168.1.254', dev: 'eth0', metric: 0 },
    ])
  })

  it('formats routes back', () => {
    expect(formatRoute(table[0]!)).toBe('default via 192.168.1.1 dev eth0 metric 100')
    expect(formatRoute(table[1]!)).toBe('192.168.1.0/24 dev eth0')
  })
})
