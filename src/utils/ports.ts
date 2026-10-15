/**
 * Port lookup: search by number or by service name / alias.
 */
export type Transport = 'TCP' | 'UDP'

export interface PortEntry {
  id: string
  port: number
  protocols: Transport[]
  service: string
  aliases: string[]
}

export type PortRange = 'well-known' | 'registered' | 'dynamic'

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/** IANA ranges: 0–1023 well-known, 1024–49151 registered, 49152–65535 dynamic / ephemeral. */
export function portRange(port: number): PortRange {
  if (port <= 1023) return 'well-known'
  if (port <= 49151) return 'registered'
  return 'dynamic'
}

/**
 * Ranked search. Numbers match exact port first, then ports starting with the digits.
 * Text matches service name or alias: exact, then prefix, then substring. `extraText` lets the UI
 * include the localized description in substring matching.
 */
export function searchPorts(
  entries: PortEntry[],
  query: string,
  extraText: (entry: PortEntry) => string = () => '',
): PortEntry[] {
  const q = query.trim().toLowerCase().replace(/^(tcp|udp)\s*[/:]?\s*/, '')
  if (q === '') return [...entries].sort((a, b) => a.port - b.port)

  const scored: { entry: PortEntry; score: number }[] = []
  for (const entry of entries) {
    let score = 0
    if (/^\d+$/.test(q)) {
      const port = String(entry.port)
      if (port === q) score = 100
      else if (port.startsWith(q)) score = 50
    } else {
      const names = [entry.service, ...entry.aliases].map((n) => n.toLowerCase())
      if (names.includes(q)) score = names[0] === q ? 100 : 90
      else if (names.some((n) => n.startsWith(q))) score = 60
      else if (names.some((n) => n.includes(q))) score = 40
      else if (extraText(entry).toLowerCase().includes(q)) score = 10
    }
    if (score > 0) scored.push({ entry, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.entry.port - b.entry.port).map((s) => s.entry)
}

/** Handy commands for a port: who is listening, is it reachable, open it in the firewall. */
export function portCommands(entry: { port: number; protocols: Transport[] }, host = '<host>'): string[] {
  const proto = (entry.protocols[0] ?? 'TCP').toLowerCase()
  const udp = proto === 'udp'
  return [
    `ss -${udp ? 'u' : 't'}lnp 'sport = :${entry.port}'`,
    udp ? `nc -zvu ${host} ${entry.port}` : `nc -zv ${host} ${entry.port}`,
    `firewall-cmd --permanent --add-port=${entry.port}/${proto} && firewall-cmd --reload`,
    `ufw allow ${entry.port}/${proto}`,
  ]
}
