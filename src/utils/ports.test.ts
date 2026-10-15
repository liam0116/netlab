import { describe, expect, it } from 'vitest'
import { PORTS } from '@/data/ports'
import { isValidPort, portCommands, portRange, searchPorts } from './ports'

describe('port data', () => {
  it('has unique ids and valid ports, including every port from the spec', () => {
    expect(new Set(PORTS.map((p) => p.id)).size).toBe(PORTS.length)
    for (const p of PORTS) expect(isValidPort(p.port), p.id).toBe(true)
    const required = [20, 21, 22, 23, 25, 53, 67, 68, 80, 123, 443, 445, 1433, 3306, 3389, 5432]
    for (const port of required) expect(PORTS.some((p) => p.port === port), String(port)).toBe(true)
  })
})

describe('searchPorts', () => {
  it('SSH → TCP 22 (spec example)', () => {
    const [first] = searchPorts(PORTS, 'SSH')
    expect(first).toMatchObject({ port: 22, protocols: ['TCP'] })
  })

  it('443 → HTTPS (spec example)', () => {
    expect(searchPorts(PORTS, '443')[0]?.service).toBe('HTTPS')
  })

  it('ranks exact number before prefix matches', () => {
    const r = searchPorts(PORTS, '80')
    expect(r[0]?.port).toBe(80)
    expect(r.map((p) => p.port)).toContain(8080)
  })

  it('matches aliases, case-insensitively', () => {
    expect(searchPorts(PORTS, 'mariadb')[0]?.port).toBe(3306)
    expect(searchPorts(PORTS, 'postgres')[0]?.port).toBe(5432)
    expect(searchPorts(PORTS, 'Remote Desktop').map((p) => p.port)).toContain(3389)
  })

  it('accepts a tcp/ prefix and empty queries', () => {
    expect(searchPorts(PORTS, 'tcp/22')[0]?.port).toBe(22)
    expect(searchPorts(PORTS, '  ')).toHaveLength(PORTS.length)
  })

  it('can search localized descriptions', () => {
    const r = searchPorts(PORTS, '遠端', (p) => (p.id === 'ssh' ? '加密的遠端登入' : ''))
    expect(r.map((p) => p.id)).toEqual(['ssh'])
    expect(searchPorts(PORTS, 'zzzz')).toEqual([])
  })
})

describe('port helpers', () => {
  it('classifies IANA ranges', () => {
    expect(portRange(22)).toBe('well-known')
    expect(portRange(1023)).toBe('well-known')
    expect(portRange(3306)).toBe('registered')
    expect(portRange(49152)).toBe('dynamic')
  })

  it('builds TCP and UDP commands', () => {
    expect(portCommands({ port: 22, protocols: ['TCP'] }, '10.0.0.5')).toEqual([
      "ss -tlnp 'sport = :22'",
      'nc -zv 10.0.0.5 22',
      'firewall-cmd --permanent --add-port=22/tcp && firewall-cmd --reload',
      'ufw allow 22/tcp',
    ])
    expect(portCommands({ port: 123, protocols: ['UDP'] })[1]).toBe('nc -zvu <host> 123')
  })
})
