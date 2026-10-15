export type DeviceType = 'server' | 'switch' | 'router' | 'firewall' | 'storage' | 'client' | 'internet'

export interface TopoDevice {
  id: string
  type: DeviceType
  name: string
  /** Primary interface. Empty string = not configured. */
  ip: string
  cidr: number
  gateway: string
  /** VLAN the host's NIC is configured for (untagged), or null. */
  vlan: number | null
  mac: string
  /** Extra L3 interfaces for routers / firewalls, as "a.b.c.d/nn" (e.g. one per VLAN). */
  interfaces: string[]
  x: number
  y: number
}

export interface TopoLink {
  id: string
  a: string
  b: string
  /** Access VLAN of the switch port when one side is a switch; null = trunk / untagged default. */
  vlan: number | null
}

export type TopoIssueCode =
  | 'invalid-ip'
  | 'invalid-gateway'
  | 'invalid-mac'
  | 'invalid-vlan'
  | 'invalid-interface'
  | 'duplicate-ip'
  | 'duplicate-mac'
  | 'missing-gateway'
  | 'gateway-outside-subnet'
  | 'gateway-not-found'
  | 'gateway-not-adjacent'
  | 'vlan-mismatch'
  | 'subnet-mismatch-in-vlan'
  | 'not-connected'

export interface TopoIssue {
  level: 'error' | 'warning' | 'info'
  code: TopoIssueCode
  deviceIds: string[]
  linkId?: string
  params: Record<string, string>
}

/** What is selected on the topology canvas. */
export type Selection = { kind: 'device' | 'link'; id: string } | null
