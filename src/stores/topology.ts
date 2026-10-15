import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { DeviceType, TopoDevice, TopoLink } from '@/types/topology'
import { checkTopology } from '@/utils/topology'

const STORAGE_KEY = 'netlab.topology'

export const DEVICE_TYPES: DeviceType[] = ['server', 'switch', 'router', 'firewall', 'storage', 'client', 'internet']

const DEFAULT_NAMES: Record<DeviceType, string> = {
  server: 'Server',
  switch: 'Switch',
  router: 'Router',
  firewall: 'Firewall',
  storage: 'Storage',
  client: 'Client',
  internet: 'Internet',
}

function device(id: string, type: DeviceType, name: string, x: number, y: number, extra: Partial<TopoDevice> = {}): TopoDevice {
  return { id, type, name, ip: '', cidr: 24, gateway: '', vlan: null, mac: '', interfaces: [], x, y, ...extra }
}

/**
 * Spec example: Internet → Firewall → Core Switch → Access Switch → servers.
 * Server A is configured for VLAN 20 but plugged into a VLAN 30 port, so the checker flags it.
 */
export function exampleTopology(): { devices: TopoDevice[]; links: TopoLink[] } {
  return {
    devices: [
      device('internet-1', 'internet', 'Internet', 90, 280),
      device('firewall-1', 'firewall', 'Firewall', 260, 280, { ip: '10.10.20.1', interfaces: ['10.10.30.1/24'] }),
      device('switch-1', 'switch', 'Core Switch', 440, 280),
      device('switch-2', 'switch', 'Access Switch', 620, 280),
      device('server-1', 'server', 'Server A', 840, 140, { ip: '10.10.20.50', gateway: '10.10.20.1', vlan: 20, mac: '3c:ec:ef:00:20:50' }),
      device('server-2', 'server', 'Server B', 840, 280, { ip: '10.10.20.51', gateway: '10.10.20.1', vlan: 20, mac: '3c:ec:ef:00:20:51' }),
      device('storage-1', 'storage', 'Storage', 840, 420, { ip: '10.10.30.10', gateway: '10.10.30.1', vlan: 30, mac: '3c:ec:ef:00:30:10' }),
    ],
    links: [
      { id: 'link-1', a: 'internet-1', b: 'firewall-1', vlan: null },
      { id: 'link-2', a: 'firewall-1', b: 'switch-1', vlan: null },
      { id: 'link-3', a: 'switch-1', b: 'switch-2', vlan: null },
      { id: 'link-4', a: 'switch-2', b: 'server-1', vlan: 30 },
      { id: 'link-5', a: 'switch-2', b: 'server-2', vlan: 20 },
      { id: 'link-6', a: 'switch-2', b: 'storage-1', vlan: 30 },
    ],
  }
}

function load(): { devices: TopoDevice[]; links: TopoLink[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { devices?: unknown; links?: unknown }
      if (Array.isArray(parsed.devices) && Array.isArray(parsed.links)) {
        return { devices: parsed.devices as TopoDevice[], links: parsed.links as TopoLink[] }
      }
    }
  } catch {
    // fall back to the example
  }
  return exampleTopology()
}

export const useTopologyStore = defineStore('topology', () => {
  const initial = load()
  const devices = ref<TopoDevice[]>(initial.devices)
  const links = ref<TopoLink[]>(initial.links)

  watch(
    [devices, links],
    () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ devices: devices.value, links: links.value }))
      } catch {
        // storage unavailable: the topology just won't persist
      }
    },
    { deep: true },
  )

  const issues = computed(() => checkTopology(devices.value, links.value))

  function nextId(prefix: string, existing: { id: string }[]): string {
    let n = 1
    while (existing.some((x) => x.id === `${prefix}-${n}`)) n++
    return `${prefix}-${n}`
  }

  function addDevice(type: DeviceType, x = 500, y = 280): TopoDevice {
    const id = nextId(type, devices.value)
    const sameType = devices.value.filter((d) => d.type === type).length
    const name = type === 'internet' && sameType === 0 ? 'Internet' : `${DEFAULT_NAMES[type]} ${sameType + 1}`
    const d = device(id, type, name, x, y)
    devices.value.push(d)
    return d
  }

  function updateDevice(id: string, patch: Partial<TopoDevice>): void {
    const d = devices.value.find((x) => x.id === id)
    if (d) Object.assign(d, patch)
  }

  function removeDevice(id: string): void {
    devices.value = devices.value.filter((d) => d.id !== id)
    links.value = links.value.filter((l) => l.a !== id && l.b !== id)
  }

  /** Connects two devices. Returns null for self-links or duplicates. */
  function addLink(a: string, b: string): TopoLink | null {
    if (a === b || links.value.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return null
    const link: TopoLink = { id: nextId('link', links.value), a, b, vlan: null }
    links.value.push(link)
    return link
  }

  function updateLink(id: string, patch: Partial<TopoLink>): void {
    const l = links.value.find((x) => x.id === id)
    if (l) Object.assign(l, patch)
  }

  function removeLink(id: string): void {
    links.value = links.value.filter((l) => l.id !== id)
  }

  function loadExample(): void {
    const ex = exampleTopology()
    devices.value = ex.devices
    links.value = ex.links
  }

  function clear(): void {
    devices.value = []
    links.value = []
  }

  return { devices, links, issues, addDevice, updateDevice, removeDevice, addLink, updateLink, removeLink, loadExample, clear }
})
