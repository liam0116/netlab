import { describe, expect, it } from 'vitest'
import { buildTcpSession, nextAck, randomIsn, TCP_SERVICES, type TcpService } from './tcp'

describe('buildTcpSession', () => {
  it('builds a correct three-way handshake', () => {
    const [syn, synAck, ack] = buildTcpSession('http', 1000, 5000)
    expect(syn).toEqual({ from: 'client', flags: 'SYN', seq: 1000, len: 0 })
    expect(synAck).toEqual({ from: 'server', flags: 'SYN, ACK', seq: 5000, ack: 1001, len: 0 })
    expect(ack).toEqual({ from: 'client', flags: 'ACK', seq: 1001, ack: 5001, len: 0 })
  })

  it('keeps seq / ack consistent through the data exchange for every service', () => {
    for (const service of Object.keys(TCP_SERVICES) as TcpService[]) {
      const segs = buildTcpSession(service, 2000, 9000)
      // Every segment acknowledges exactly what the peer has sent so far.
      let clientNext = 2000
      let serverNext = 9000
      for (const s of segs) {
        if (s.from === 'client') {
          expect(s.seq, service).toBe(clientNext)
          if (s.ack !== undefined) expect(s.ack, service).toBe(serverNext)
          clientNext = nextAck(s.seq, s.len, s.flags)
        } else {
          expect(s.seq, service).toBe(serverNext)
          expect(s.ack, service).toBe(clientNext)
          serverNext = nextAck(s.seq, s.len, s.flags)
        }
      }
    }
  })

  it('SSH and MySQL servers speak first; HTTP and HTTPS clients do', () => {
    expect(buildTcpSession('ssh', 1, 1)[3]!.from).toBe('server')
    expect(buildTcpSession('mysql', 1, 1)[3]!.from).toBe('server')
    expect(buildTcpSession('http', 1, 1)[3]!.payload).toBe('GET / HTTP/1.1')
    expect(buildTcpSession('https', 1, 1)[3]!.payload).toMatch(/ClientHello/)
    expect(TCP_SERVICES.mysql.port).toBe(3306)
  })

  it('nextAck counts SYN / FIN as one byte', () => {
    expect(nextAck(100, 0, 'SYN')).toBe(101)
    expect(nextAck(100, 500, 'PSH, ACK')).toBe(600)
    expect(nextAck(100, 0, 'FIN, ACK')).toBe(101)
    expect(randomIsn(() => 0)).toBe(1000)
  })
})
