/**
 * TCP three-way handshake and the first application exchange for common services, with real
 * sequence / acknowledgement arithmetic: SYN and FIN consume one sequence number, data consumes
 * its length, and ACK = the next byte expected.
 */
export type TcpService = 'http' | 'https' | 'ssh' | 'mysql'

export interface TcpSegment {
  from: 'client' | 'server'
  flags: string
  seq: number
  ack?: number
  len: number
  /** Application payload summary (language-neutral). */
  payload?: string
}

interface ServiceDef {
  port: number
  /** Who speaks first after the handshake. SSH and MySQL servers send a greeting first. */
  first: 'client' | 'server'
  exchange: { from: 'client' | 'server'; payload: string; len: number }[]
}

export const TCP_SERVICES: Record<TcpService, ServiceDef> = {
  http: {
    port: 80,
    first: 'client',
    exchange: [
      { from: 'client', payload: 'GET / HTTP/1.1', len: 78 },
      { from: 'server', payload: 'HTTP/1.1 200 OK', len: 612 },
    ],
  },
  https: {
    port: 443,
    first: 'client',
    exchange: [
      { from: 'client', payload: 'TLS ClientHello', len: 517 },
      { from: 'server', payload: 'TLS ServerHello, Certificate', len: 1460 },
    ],
  },
  ssh: {
    port: 22,
    first: 'server',
    exchange: [
      { from: 'server', payload: 'SSH-2.0-OpenSSH_9.6', len: 21 },
      { from: 'client', payload: 'SSH-2.0-OpenSSH_9.6', len: 21 },
    ],
  },
  mysql: {
    port: 3306,
    first: 'server',
    exchange: [
      { from: 'server', payload: 'MySQL Server Greeting (v10)', len: 78 },
      { from: 'client', payload: 'Login Request (user=app)', len: 92 },
    ],
  },
}

/** Handshake (3 segments) followed by the service's first request / response. */
export function buildTcpSession(service: TcpService, clientIsn: number, serverIsn: number): TcpSegment[] {
  // Next sequence number each side will send.
  let clientNext = clientIsn + 1
  let serverNext = serverIsn + 1
  const segments: TcpSegment[] = [
    { from: 'client', flags: 'SYN', seq: clientIsn, len: 0 },
    { from: 'server', flags: 'SYN, ACK', seq: serverIsn, ack: clientNext, len: 0 },
    { from: 'client', flags: 'ACK', seq: clientNext, ack: serverNext, len: 0 },
  ]
  for (const msg of TCP_SERVICES[service].exchange) {
    if (msg.from === 'client') {
      segments.push({ from: 'client', flags: 'PSH, ACK', seq: clientNext, ack: serverNext, len: msg.len, payload: msg.payload })
      clientNext += msg.len
    } else {
      segments.push({ from: 'server', flags: 'PSH, ACK', seq: serverNext, ack: clientNext, len: msg.len, payload: msg.payload })
      serverNext += msg.len
    }
  }
  return segments
}

/** The ACK a receiver sends after a segment: next expected byte. */
export function nextAck(seq: number, len: number, flags = ''): number {
  return seq + len + (/SYN|FIN/.test(flags) ? 1 : 0)
}

/** Random 32-bit-ish initial sequence number, kept small enough to read. */
export function randomIsn(random: () => number = Math.random): number {
  return 1000 + Math.floor(random() * 4_000_000)
}
