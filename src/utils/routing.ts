/**
 * Routing table lookup (longest prefix match) and a parser for Linux `ip route` output.
 */
import { cidrToMaskInt, ipToInt, isValidIPv4, parseCidrNotation } from './network'

export interface Route {
  /** "default" or "a.b.c.d/nn". */
  destination: string
  /** Next hop. Absent for directly connected routes. */
  via?: string
  dev: string
  metric: number
}

export interface RouteCandidate {
  route: Route
  prefix: number
  matches: boolean
}

export interface RouteLookup {
  match: Route | null
  candidates: RouteCandidate[]
}

/** "default" → 0.0.0.0/0; otherwise ip/cidr. Returns null for anything unparseable. */
export function routePrefix(destination: string): { network: number; cidr: number } | null {
  if (destination === 'default') return { network: 0, cidr: 0 }
  const parsed = parseCidrNotation(destination.includes('/') ? destination : `${destination}/32`)
  if (!parsed) return null
  return { network: (ipToInt(parsed.ip) & cidrToMaskInt(parsed.cidr)) >>> 0, cidr: parsed.cidr }
}

/**
 * Longest prefix match: of all routes containing the destination, the one with the most network
 * bits wins; ties go to the lowest metric.
 */
export function lookupRoute(routes: Route[], destinationIp: string): RouteLookup {
  if (!isValidIPv4(destinationIp)) throw new Error(`Invalid IPv4 address: ${destinationIp}`)
  const dst = ipToInt(destinationIp)
  const candidates: RouteCandidate[] = []
  for (const route of routes) {
    const prefix = routePrefix(route.destination)
    if (!prefix) continue
    const matches = ((dst & cidrToMaskInt(prefix.cidr)) >>> 0) === prefix.network
    candidates.push({ route, prefix: prefix.cidr, matches })
  }
  const match =
    candidates
      .filter((c) => c.matches)
      .sort((a, b) => b.prefix - a.prefix || a.route.metric - b.route.metric)[0]?.route ?? null
  return { match, candidates }
}

/**
 * Parses `ip route` output, e.g.
 *   default via 192.168.1.1 dev eth0 proto dhcp metric 100
 *   192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10
 * Unknown or malformed lines are skipped.
 */
export function parseIpRoute(text: string): Route[] {
  const routes: Route[] = []
  for (const raw of text.split('\n')) {
    const tokens = raw.trim().split(/\s+/)
    const destination = tokens[0]
    if (!destination || !routePrefix(destination)) continue
    const value = (key: string) => {
      const i = tokens.indexOf(key)
      return i >= 0 ? tokens[i + 1] : undefined
    }
    const dev = value('dev')
    if (!dev) continue
    const via = value('via')
    if (via !== undefined && !isValidIPv4(via)) continue
    const metric = Number(value('metric') ?? 0)
    routes.push({ destination, via, dev, metric: Number.isFinite(metric) ? metric : 0 })
  }
  return routes
}

export function formatRoute(route: Route): string {
  return [route.destination, route.via ? `via ${route.via}` : '', `dev ${route.dev}`, route.metric ? `metric ${route.metric}` : '']
    .filter(Boolean)
    .join(' ')
}
