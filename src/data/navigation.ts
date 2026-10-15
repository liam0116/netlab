import {
  ArrowLeftRight,
  Binary,
  BookOpen,
  Boxes,
  Cable,
  ClipboardList,
  FileText,
  FolderKanban,
  GitBranch,
  Server,
  Settings2,
  Sigma,
  Calculator,
  Database,
  GitCompareArrows,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  ListTree,
  Map as MapIcon,
  MapPinned,
  Network,
  Route,
  Router,
  Send,
  SquareTerminal,
  Workflow,
  Wrench,
} from 'lucide-vue-next'
import type { NavItem, NavSection } from '@/types/app'

export const dashboardItem: NavItem = { id: 'dashboard', label: 'Dashboard', to: '/', icon: LayoutDashboard, phase: 1 }

export const navSections: NavSection[] = [
  // Field work first: projects and service are what the sidebar is used for most on-site.
  {
    id: 'project',
    title: 'Project',
    items: [
      { id: 'project', label: 'Projects', to: '/project', icon: FolderKanban, phase: 4 },
      { id: 'ip-plan', label: 'IP Plan', to: '/project/ip-plan', icon: MapPinned, phase: 4 },
      { id: 'rack', label: 'Rack Elevation', to: '/project/rack', icon: Server, phase: 4 },
      { id: 'cabling', label: 'Cabling', to: '/project/cabling', icon: Cable, phase: 4 },
      { id: 'flows', label: 'Service Flows', to: '/project/flows', icon: GitBranch, phase: 4 },
      { id: 'flowcharts', label: 'Flowcharts', to: '/project/flowcharts', icon: ClipboardList, phase: 4 },
      { id: 'config', label: 'Config Generator', to: '/project/config', icon: Settings2, phase: 4 },
      { id: 'report', label: 'Handover Report', to: '/project/report', icon: FileText, phase: 4 },
    ],
  },
  {
    // Service on machines already running; kept apart from projects, which are new builds.
    id: 'service',
    title: 'Service',
    items: [{ id: 'maintenance', label: 'Maintenance', to: '/service/maintenance', icon: Wrench, phase: 4 }],
  },
  {
    id: 'learn',
    title: 'Learn',
    items: [
      { id: 'learn-binary', label: 'Binary', to: '/learn/binary', icon: Binary, phase: 1 },
      { id: 'learn-ipv4', label: 'IPv4', to: '/learn/ipv4', icon: BookOpen, phase: 1 },
      { id: 'learn-subnet', label: 'Subnet', to: '/learn/subnet-mask', icon: Layers, phase: 1 },
      { id: 'learn-routing', label: 'Routing', to: '/learn/routing', icon: Route, phase: 2 },
      { id: 'learn-vlan', label: 'VLAN', to: '/learn/vlan', icon: Network, phase: 2 },
      { id: 'learn-tcpip', label: 'TCP/IP', to: '/learn/tcp-handshake', icon: Workflow, phase: 2 },
      { id: 'learn-raid', label: 'RAID', to: '/learn/raid', icon: Database, phase: 4 },
    ],
  },
  {
    id: 'tools',
    title: 'Tools',
    items: [
      { id: 'subnet', label: 'Subnet Calculator', to: '/tools/subnet', icon: Calculator, phase: 1 },
      { id: 'cidr', label: 'CIDR Converter', to: '/tools/cidr', icon: ArrowLeftRight, phase: 1 },
      { id: 'binary', label: 'Binary Calculator', to: '/tools/binary', icon: Binary, phase: 1 },
      { id: 'same-subnet', label: 'Same Subnet', to: '/tools/same-subnet', icon: GitCompareArrows, phase: 1 },
      { id: 'gateway', label: 'Gateway Checker', to: '/tools/gateway', icon: Router, phase: 1 },
      { id: 'ip-planner', label: 'IP Planner', to: '/tools/ip-planner', icon: MapIcon, phase: 4 },
      { id: 'calculators', label: 'Calculators', to: '/tools/calculators', icon: Sigma, phase: 4 },
    ],
  },
  {
    id: 'lab',
    title: 'Lab',
    items: [
      { id: 'network-simulator', label: 'Network Simulator', to: '/lab/network', icon: Network, phase: 2 },
      { id: 'packet-simulator', label: 'Packet Simulator', to: '/lab/packet', icon: Send, phase: 2 },
    ],
  },
  {
    id: 'reference',
    title: 'Reference',
    items: [
      { id: 'device-guide', label: 'Device Guide', to: '/reference/devices', icon: Boxes, phase: 4 },
      { id: 'linux-commands', label: 'Linux Commands', to: '/reference/linux', icon: SquareTerminal, phase: 2 },
      { id: 'port-reference', label: 'Port Reference', to: '/reference/ports', icon: ListTree, phase: 2 },
      { id: 'troubleshooting', label: 'Troubleshooting', to: '/reference/troubleshooting', icon: LifeBuoy, phase: 2 },
    ],
  },
]

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items)

/** Where a nav item links to: the tool itself, or its intro page while it is still being built. */
export function navTarget(item: NavItem): string {
  return item.to ?? `/features/${item.id}`
}

export function findNavItem(id: string): NavItem | undefined {
  return allNavItems.find((i) => i.id === id)
}
