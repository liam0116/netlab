/**
 * Configuration generator: derives server, switch and BMC configuration from the project
 * (rack items + cabling + IP plan), so on-site work is copy-and-paste instead of retyping IPs.
 */
import type { Cable, RackItem } from '@/types/project'
import { isSwitch, parseVlanList } from './cabling'
import { cidrToMask, ipToInt, isInSubnet, isValidIPv4 } from './network'
import type { PlannedSubnet } from './planner'

export interface ConfigSource {
  rackItems: RackItem[]
  cables: Cable[]
  subnets: PlannedSubnet[]
}

export const MGMT_PORT = /^(bmc|idrac|ilo|ipmi|mgmt)/i
/** Fibre Channel HBAs and SAS ports carry no IP traffic, so they never become network interfaces. */
export const STORAGE_PORT = /^(vm)?hba\d|(^|-)fc\d|(^|-)sas/i

export function findSubnet(subnets: PlannedSubnet[], ip: string): PlannedSubnet | undefined {
  if (!isValidIPv4(ip)) return undefined
  return subnets.find((s) => isInSubnet(ipToInt(ip), ipToInt(s.network), s.cidr))
}

// --- Server --------------------------------------------------------------------------

export interface ServerIface {
  name: string
  kind: 'ethernet' | 'bond' | 'vlan'
  members: string[]
  parent?: string
  vlanId?: number
  address?: string
  gateway?: string
}

export type ServerWarning = 'no-ip' | 'no-subnet' | 'no-data-ports' | 'trunk-no-vlan' | 'extra-no-iface' | 'extra-conflict' | 'extra-no-subnet'

export interface ServerNetConfig {
  hostname: string
  interfaces: ServerIface[]
  mtu: number
  dns: string[]
  search: string[]
  warnings: ServerWarning[]
}

export interface ServerOptions {
  mtu: number
  dns: string[]
  search: string[]
}

function hostPort(c: Cable, itemId: string): string | null {
  if (c.aItemId === itemId) return c.aPort
  if (c.bItemId === itemId) return c.bPort
  return null
}

export function deriveServerConfig(src: ConfigSource, itemId: string, opts: ServerOptions): ServerNetConfig | null {
  const item = src.rackItems.find((i) => i.id === itemId)
  if (!item) return null
  const warnings: ServerWarning[] = []
  const dataCables = src.cables.filter((c) => {
    const p = hostPort(c, item.id)
    return p !== null && !MGMT_PORT.test(p) && !STORAGE_PORT.test(p)
  })

  const bonds = new Map<string, string[]>()
  const plain: string[] = []
  for (const c of dataCables) {
    const port = hostPort(c, item.id)!
    if (c.bond.trim()) bonds.set(c.bond.trim(), [...(bonds.get(c.bond.trim()) ?? []), port])
    else plain.push(port)
  }

  const interfaces: ServerIface[] = []
  for (const port of [...[...bonds.values()].flat(), ...plain]) interfaces.push({ name: port, kind: 'ethernet', members: [] })
  const bondNames = [...bonds.keys()].sort()
  for (const b of bondNames) interfaces.push({ name: b, kind: 'bond', members: bonds.get(b)! })

  const primary = bondNames[0] ?? plain[0]
  if (!primary) warnings.push('no-data-ports')
  if (!isValidIPv4(item.ip)) warnings.push('no-ip')
  const subnet = findSubnet(src.subnets, item.ip)
  if (isValidIPv4(item.ip) && !subnet) warnings.push('no-subnet')

  if (primary && isValidIPv4(item.ip)) {
    const primaryCables = dataCables.filter((c) => {
      const p = hostPort(c, item.id)!
      return p === primary || bonds.get(primary)?.includes(p)
    })
    const trunk = primaryCables.some((c) => c.mode === 'trunk')
    const address = `${item.ip}/${subnet?.cidr ?? 24}`
    const gateway = subnet?.gateway
    if (trunk && subnet?.vlan) {
      interfaces.push({ name: `${primary}.${subnet.vlan}`, kind: 'vlan', members: [], parent: primary, vlanId: subnet.vlan, address, gateway })
    } else {
      if (trunk) warnings.push('trunk-no-vlan')
      const target = interfaces.find((i) => i.name === primary)!
      target.address = address
      target.gateway = gateway
    }
  }

  // Further addresses (vMotion, storage …): a VLAN interface on their port / bond, or the port itself when untagged.
  // Only the primary IP carries the default gateway.
  for (const extra of item.addresses) {
    if (!isValidIPv4(extra.address)) continue
    const parent = extra.iface.trim() || primary
    const parentIface = parent ? interfaces.find((i) => i.name === parent && i.kind !== 'vlan') : undefined
    if (!parent || !parentIface) {
      if (!warnings.includes('extra-no-iface')) warnings.push('extra-no-iface')
      continue
    }
    const extraSubnet = findSubnet(src.subnets, extra.address)
    if (!extraSubnet && !warnings.includes('extra-no-subnet')) warnings.push('extra-no-subnet')
    const address = `${extra.address}/${extraSubnet?.cidr ?? 24}`
    const vlanId = extra.vlan ?? extraSubnet?.vlan ?? null
    if (vlanId) {
      const name = `${parent}.${vlanId}`
      if (interfaces.some((i) => i.name === name)) {
        if (!warnings.includes('extra-conflict')) warnings.push('extra-conflict')
        continue
      }
      interfaces.push({ name, kind: 'vlan', members: [], parent, vlanId, address })
    } else if (parentIface.address) {
      if (!warnings.includes('extra-conflict')) warnings.push('extra-conflict')
    } else {
      parentIface.address = address
    }
  }

  return { hostname: item.hostname || item.name, interfaces, mtu: opts.mtu, dns: opts.dns, search: opts.search, warnings }
}

const yamlList = (items: string[]) => `[${items.join(', ')}]`

export function toNetplan(cfg: ServerNetConfig): string {
  const lines = ['# /etc/netplan/60-netlab.yaml', `# ${cfg.hostname}`, 'network:', '  version: 2', '  renderer: networkd']
  const addressing = (i: ServerIface, indent: string) => {
    if (!i.address) return
    lines.push(`${indent}addresses: ${yamlList([i.address])}`)
    if (i.gateway) lines.push(`${indent}routes:`, `${indent}  - to: default`, `${indent}    via: ${i.gateway}`)
    if (cfg.dns.length || cfg.search.length) {
      lines.push(`${indent}nameservers:`)
      if (cfg.dns.length) lines.push(`${indent}  addresses: ${yamlList(cfg.dns)}`)
      if (cfg.search.length) lines.push(`${indent}  search: ${yamlList(cfg.search)}`)
    }
  }
  const eth = cfg.interfaces.filter((i) => i.kind === 'ethernet')
  const bonds = cfg.interfaces.filter((i) => i.kind === 'bond')
  const vlans = cfg.interfaces.filter((i) => i.kind === 'vlan')
  if (eth.length) {
    lines.push('  ethernets:')
    for (const i of eth) {
      lines.push(`    ${i.name}:`, '      dhcp4: false')
      if (cfg.mtu !== 1500) lines.push(`      mtu: ${cfg.mtu}`)
      addressing(i, '      ')
    }
  }
  if (bonds.length) {
    lines.push('  bonds:')
    for (const b of bonds) {
      lines.push(`    ${b.name}:`, `      interfaces: ${yamlList(b.members)}`, '      dhcp4: false')
      if (cfg.mtu !== 1500) lines.push(`      mtu: ${cfg.mtu}`)
      lines.push('      parameters:', '        mode: 802.3ad', '        lacp-rate: fast', '        mii-monitor-interval: 100', '        transmit-hash-policy: layer3+4')
      addressing(b, '      ')
    }
  }
  if (vlans.length) {
    lines.push('  vlans:')
    for (const v of vlans) {
      lines.push(`    ${v.name}:`, `      id: ${v.vlanId}`, `      link: ${v.parent}`)
      if (cfg.mtu !== 1500) lines.push(`      mtu: ${cfg.mtu}`)
      addressing(v, '      ')
    }
  }
  lines.push('', '# Apply: sudo netplan try   (auto-reverts if you lose access)')
  return lines.join('\n')
}

export function toNmcli(cfg: ServerNetConfig): string {
  const out = [`# ${cfg.hostname} (NetworkManager / RHEL / Rocky)`, `hostnamectl set-hostname ${cfg.hostname}`]
  const ip = (i: ServerIface) => {
    if (!i.address) return 'ipv4.method disabled ipv6.method ignore'
    const parts = [`ipv4.method manual ipv4.addresses ${i.address}`]
    if (i.gateway) parts.push(`ipv4.gateway ${i.gateway}`)
    if (cfg.dns.length) parts.push(`ipv4.dns "${cfg.dns.join(' ')}"`)
    if (cfg.search.length) parts.push(`ipv4.dns-search "${cfg.search.join(' ')}"`)
    return parts.join(' ')
  }
  const mtu = cfg.mtu !== 1500 ? ` 802-3-ethernet.mtu ${cfg.mtu}` : ''
  const enslaved = new Set(cfg.interfaces.filter((i) => i.kind === 'bond').flatMap((b) => b.members))
  for (const b of cfg.interfaces.filter((i) => i.kind === 'bond')) {
    out.push(`nmcli con add type bond con-name ${b.name} ifname ${b.name} bond.options "mode=802.3ad,miimon=100,lacp_rate=fast,xmit_hash_policy=layer3+4" ${ip(b)}${mtu}`)
    for (const m of b.members) out.push(`nmcli con add type ethernet con-name ${b.name}-${m} ifname ${m} master ${b.name} slave-type bond${mtu}`)
  }
  for (const e of cfg.interfaces.filter((i) => i.kind === 'ethernet' && !enslaved.has(i.name))) {
    out.push(`nmcli con add type ethernet con-name ${e.name} ifname ${e.name} ${ip(e)}${mtu}`)
  }
  for (const v of cfg.interfaces.filter((i) => i.kind === 'vlan')) {
    out.push(`nmcli con add type vlan con-name ${v.name} ifname ${v.name} dev ${v.parent} id ${v.vlanId} ${ip(v)}${mtu}`)
  }
  const up = cfg.interfaces.filter((i) => i.kind !== 'ethernet' || !enslaved.has(i.name)).map((i) => i.name)
  for (const name of up) out.push(`nmcli con up ${name}`)
  return out.join('\n')
}

export function toEtcHosts(items: RackItem[]): string {
  const rows = items.filter((i) => isValidIPv4(i.ip) && (i.hostname || i.name)).map((i) => `${i.ip.padEnd(16)}${i.hostname || i.name}`)
  const bmc = items.filter((i) => isValidIPv4(i.mgmtIp) && (i.hostname || i.name)).map((i) => `${i.mgmtIp.padEnd(16)}${i.hostname || i.name}-bmc`)
  // e.g. "10.10.40.11  esx01-vmotion"; several addresses with the same purpose get -2, -3 …
  const extra = items.flatMap((i) => {
    const host = i.hostname || i.name
    if (!host) return []
    const seen = new Map<string, number>()
    return i.addresses
      .filter((a) => isValidIPv4(a.address))
      .map((a) => {
        const n = (seen.get(a.purpose) ?? 0) + 1
        seen.set(a.purpose, n)
        return `${a.address.padEnd(16)}${host}-${a.purpose}${n > 1 ? `-${n}` : ''}`
      })
  })
  return ['# /etc/hosts (generated by netlab)', ...rows, ...(extra.length ? ['', '# Other networks', ...extra] : []), ...(bmc.length ? ['', '# BMC', ...bmc] : [])].join('\n')
}

// --- BMC -----------------------------------------------------------------------------

export function toIpmitool(src: ConfigSource, itemId: string): string | null {
  const item = src.rackItems.find((i) => i.id === itemId)
  if (!item || !isValidIPv4(item.mgmtIp)) return null
  const subnet = findSubnet(src.subnets, item.mgmtIp)
  const lines = [
    `# ${item.hostname || item.name} BMC (run on the host, channel 1)`,
    'ipmitool lan set 1 ipsrc static',
    `ipmitool lan set 1 ipaddr ${item.mgmtIp}`,
    `ipmitool lan set 1 netmask ${cidrToMask(subnet?.cidr ?? 24)}`,
  ]
  if (subnet) lines.push(`ipmitool lan set 1 defgw ipaddr ${subnet.gateway}`)
  lines.push('ipmitool lan print 1')
  return lines.join('\n')
}

// --- Switch -------------------------------------------------------------------------

export interface SwitchPortConfig {
  name: string
  description: string
  mode: 'access' | 'trunk'
  vlan: number | null
  allowed: number[]
  channelGroup: number | null
}

export interface PortChannelConfig {
  id: number
  description: string
  mode: 'access' | 'trunk'
  vlan: number | null
  allowed: number[]
  /** The bond also lands on another switch: needs MLAG / vPC. */
  mlag: boolean
}

export interface SwitchConfig {
  hostname: string
  vlans: { id: number; name: string }[]
  ports: SwitchPortConfig[]
  portChannels: PortChannelConfig[]
  mtu: number
}

/** Port-channel numbers per host bond, the same on both switches of an MLAG pair. */
export function portChannelIds(src: ConfigSource): Map<string, number> {
  const byId = new Map(src.rackItems.map((i) => [i.id, i]))
  const keys = new Set<string>()
  for (const c of src.cables) {
    if (!c.bond.trim()) continue
    const a = byId.get(c.aItemId)
    const b = byId.get(c.bItemId)
    if (!a || !b) continue
    const host = isSwitch(a) ? b : a
    keys.add(`${host.id}::${c.bond.trim()}`)
  }
  const sorted = [...keys].sort((x, y) => {
    const [hx, bx] = x.split('::') as [string, string]
    const [hy, by] = y.split('::') as [string, string]
    return (byId.get(hx)?.name ?? '').localeCompare(byId.get(hy)?.name ?? '') || bx.localeCompare(by)
  })
  return new Map(sorted.map((k, i) => [k, 10 + i]))
}

export function deriveSwitchConfig(src: ConfigSource, switchId: string, mtu: number): SwitchConfig | null {
  const sw = src.rackItems.find((i) => i.id === switchId)
  if (!sw) return null
  const byId = new Map(src.rackItems.map((i) => [i.id, i]))
  const channelIds = portChannelIds(src)
  const vlanNames = new Map(src.subnets.filter((s) => s.vlan !== null).map((s) => [s.vlan!, s.name]))
  const vlanSet = new Set<number>()
  const ports: SwitchPortConfig[] = []
  const channels = new Map<number, PortChannelConfig>()

  for (const c of src.cables) {
    const local = c.aItemId === sw.id ? { port: c.aPort } : c.bItemId === sw.id ? { port: c.bPort } : null
    if (!local) continue
    const peerId = c.aItemId === sw.id ? c.bItemId : c.aItemId
    const peerPort = c.aItemId === sw.id ? c.bPort : c.aPort
    const peer = byId.get(peerId)
    const allowed = c.mode === 'trunk' ? (parseVlanList(c.allowedVlans) ?? []) : []
    if (c.vlan !== null) vlanSet.add(c.vlan)
    allowed.forEach((v) => vlanSet.add(v))
    const channel = c.bond.trim() && peer && !isSwitch(peer) ? (channelIds.get(`${peer.id}::${c.bond.trim()}`) ?? null) : null
    ports.push({ name: local.port, description: `${peer?.hostname || peer?.name || peerId} ${peerPort}`, mode: c.mode, vlan: c.vlan, allowed, channelGroup: channel })
    if (channel !== null && !channels.has(channel)) {
      const otherSwitches = src.cables.some(
        (o) => o.bond.trim() === c.bond.trim() && (o.aItemId === peerId || o.bItemId === peerId) && o.aItemId !== sw.id && o.bItemId !== sw.id,
      )
      channels.set(channel, { id: channel, description: `${peer?.hostname || peer?.name} ${c.bond.trim()}`, mode: c.mode, vlan: c.vlan, allowed, mlag: otherSwitches })
    }
  }

  const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })
  return {
    hostname: sw.hostname || sw.name,
    vlans: [...vlanSet].sort((a, b) => a - b).map((id) => ({ id, name: (vlanNames.get(id) ?? `VLAN${id}`).replace(/[^\w-]/g, '_') })),
    ports: ports.sort((a, b) => natural(a.name, b.name)),
    portChannels: [...channels.values()].sort((a, b) => a.id - b.id),
    mtu,
  }
}

/** Cisco NX-OS / Arista EOS style. */
export function toCiscoLike(cfg: SwitchConfig): string {
  const out = [`hostname ${cfg.hostname}`, '!']
  for (const v of cfg.vlans) out.push(`vlan ${v.id}`, `  name ${v.name}`, '!')
  const l2 = (mode: 'access' | 'trunk', vlan: number | null, allowed: number[]) =>
    mode === 'access'
      ? ['  switchport mode access', ...(vlan !== null ? [`  switchport access vlan ${vlan}`] : [])]
      : ['  switchport mode trunk', ...(vlan !== null ? [`  switchport trunk native vlan ${vlan}`] : []), ...(allowed.length ? [`  switchport trunk allowed vlan ${allowed.join(',')}`] : [])]
  for (const pc of cfg.portChannels) {
    out.push(`interface Port-Channel${pc.id}`, `  description ${pc.description}`, ...l2(pc.mode, pc.vlan, pc.allowed))
    if (pc.mlag) out.push(`  mlag ${pc.id}`, `  ! Cisco NX-OS: use "vpc ${pc.id}" instead of mlag`)
    out.push('!')
  }
  for (const p of cfg.ports) {
    out.push(`interface ${p.name}`, `  description ${p.description}`)
    if (cfg.mtu !== 1500) out.push(`  mtu ${cfg.mtu}`)
    if (p.channelGroup !== null) out.push(`  channel-group ${p.channelGroup} mode active`)
    else out.push(...l2(p.mode, p.vlan, p.allowed))
    out.push('  no shutdown', '!')
  }
  return out.join('\n')
}

/** Huawei VRP style. */
export function toHuawei(cfg: SwitchConfig): string {
  const out = ['system-view', `sysname ${cfg.hostname}`]
  if (cfg.vlans.length) out.push(`vlan batch ${cfg.vlans.map((v) => v.id).join(' ')}`)
  for (const v of cfg.vlans) out.push(`vlan ${v.id}`, ` description ${v.name}`, ' quit')
  const l2 = (mode: 'access' | 'trunk', vlan: number | null, allowed: number[]) =>
    mode === 'access'
      ? [' port link-type access', ...(vlan !== null ? [` port default vlan ${vlan}`] : [])]
      : [' port link-type trunk', ...(vlan !== null ? [` port trunk pvid vlan ${vlan}`] : []), ...(allowed.length ? [` port trunk allow-pass vlan ${allowed.join(' ')}`] : [])]
  for (const pc of cfg.portChannels) {
    out.push(`interface Eth-Trunk${pc.id}`, ` description ${pc.description}`, ' mode lacp', ...l2(pc.mode, pc.vlan, pc.allowed))
    if (pc.mlag) out.push(` dfs-group 1 m-lag ${pc.id}`)
    out.push(' quit')
  }
  for (const p of cfg.ports) {
    out.push(`interface ${p.name}`, ` description ${p.description}`)
    if (cfg.mtu !== 1500) out.push(` jumboframe enable ${cfg.mtu}`)
    if (p.channelGroup !== null) out.push(` eth-trunk ${p.channelGroup}`)
    else out.push(...l2(p.mode, p.vlan, p.allowed))
    out.push(' undo shutdown', ' quit')
  }
  out.push('return', 'save')
  return out.join('\n')
}
