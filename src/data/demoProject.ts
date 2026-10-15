/**
 * A complete sample customer project in the most common enterprise layout, a three-tier vSphere
 * platform: four ESXi hosts, a dual-controller FC SAN array with an expansion shelf, two FC switches
 * (fabric A / B), an MLAG leaf pair for the data networks, an out-of-band switch and the firewall that
 * routes every VLAN. Full cabling, service flows and flowcharts are included.
 * Every check in the app should come back clean for it, which the tests verify.
 */
import type { AppLocale } from '@/i18n'
import { flowchartFromTemplate } from '@/i18n/content/flowcharts'
import type { Cable, ProjectData, RackItem, RackPort } from '@/types/project'
import type { PlanOptions, PlanRequirement } from '@/utils/planner'
import { RACK_TEMPLATES } from '@/utils/rack'

const PLAN_OPTIONS: PlanOptions = { base: '10.10.0.0/16', strategy: 'vlan-octet', gateway: 'first', growthPercent: 0, reserveGateway: true }
const REQUIREMENTS: PlanRequirement[] = [
  { id: 'req-oob', name: 'OOB / BMC', vlan: 10, hosts: 50 },
  { id: 'req-esxi', name: 'ESXi Mgmt', vlan: 20, hosts: 30 },
  { id: 'req-vmotion', name: 'vMotion', vlan: 30, hosts: 30 },
  { id: 'req-vm', name: 'VM Network', vlan: 40, hosts: 200 },
]

/** ESXi host: 2 × 25G uplinks (vmnic) to the leaf pair, 2 × 32G FC HBAs to fabric A / B. */
const ESX_PORTS: RackPort[] = [
  { name: 'BMC', speed: 1 },
  { name: 'vmnic0', speed: 25 },
  { name: 'vmnic1', speed: 25 },
  { name: 'vmhba1', speed: 32 },
  { name: 'vmhba2', speed: 32 },
]

function item(id: string, rackId: string, template: string, name: string, uPosition: number, extra: Partial<RackItem> = {}): RackItem {
  const t = RACK_TEMPLATES[template]!
  return {
    id,
    rackId,
    name,
    model: t.model,
    type: t.type,
    uHeight: t.uHeight,
    uPosition,
    powerW: t.powerW,
    weightKg: t.weightKg,
    psus: t.psus,
    hostname: name,
    ip: '',
    mgmtIp: '',
    addresses: [],
    serial: '',
    assetTag: '',
    os: '',
    notes: '',
    ports: t.ports.map((p) => ({ ...p })),
    ...extra,
  }
}

let cableNo = 0
function cable(a: string, aPort: string, b: string, bPort: string, extra: Partial<Cable> = {}): Cable {
  cableNo++
  return {
    id: `cable-${cableNo}`,
    label: `C-${String(cableNo).padStart(3, '0')}`,
    aItemId: a,
    aPort,
    bItemId: b,
    bPort,
    type: 'DAC',
    lengthM: 2,
    mode: 'access',
    vlan: null,
    allowedVlans: '',
    bond: '',
    notes: '',
    ...extra,
  }
}

export function demoProject(locale: AppLocale): ProjectData {
  cableNo = 0
  const zh = locale === 'zh-TW'
  const firewallPorts: RackPort[] = [
    { name: 'port1', speed: 25 },
    { name: 'port2', speed: 25 },
    { name: 'port3', speed: 1 },
    { name: 'wan1', speed: 10 },
  ]
  const esx = (n: number, u: number) =>
    item(`esx0${n}`, 'rack-1', 'server-1u', `esx0${n}`, u, {
      model: '1U Server (2× Xeon, 512 GB)',
      ip: `10.10.20.1${n}`,
      mgmtIp: `10.10.10.2${n}`,
      addresses: [{ id: `esx0${n}-vmotion`, purpose: 'vmotion', iface: 'lag1', vlan: null, address: `10.10.30.1${n}` }],
      serial: `SRV-000${n}`,
      os: 'VMware ESXi 8.0 U3',
      ports: ESX_PORTS.map((p) => ({ ...p })),
    })
  const rackItems: RackItem[] = [
    // Top of rack: patch panel, OOB switch, leaf pair, FC fabric A / B, firewall
    item('patch01', 'rack-1', 'patch-panel', 'patch01', 42, { hostname: '' }),
    item('oob-sw01', 'rack-1', 'mgmt-switch', 'oob-sw01', 41, { psus: 2, serial: 'OOB-0001' }),
    item('leaf01', 'rack-1', 'switch-25g', 'leaf01', 40, { serial: 'LF-0001' }),
    item('leaf02', 'rack-1', 'switch-25g', 'leaf02', 39, { serial: 'LF-0002' }),
    item('fc-sw01', 'rack-1', 'fc-switch', 'fc-sw01', 38, { serial: 'FC-0001', notes: zh ? 'Fabric A' : 'Fabric A' }),
    item('fc-sw02', 'rack-1', 'fc-switch', 'fc-sw02', 37, { serial: 'FC-0002', notes: zh ? 'Fabric B' : 'Fabric B' }),
    item('fw01', 'rack-1', 'firewall', 'fw01', 36, { ip: '10.10.10.1', ports: firewallPorts, serial: 'FW-0001' }),
    // Compute in the middle
    esx(1, 23),
    esx(2, 22),
    esx(3, 21),
    esx(4, 20),
    // Heavy storage at the bottom
    item('shelf01', 'rack-1', 'disk-shelf-2u', 'shelf01', 3, { serial: 'SHF-0001', notes: zh ? 'SAS 線由原廠隨貨附，接到 san01 兩個控制器' : 'SAS cables ship with the array; connect to both san01 controllers' }),
    item('san01', 'rack-1', 'san-array-2u', 'san01', 1, {
      ip: '10.10.10.31',
      addresses: [{ id: 'san01-ctrl-b', purpose: 'mgmt', iface: 'B-MGMT', vlan: null, address: '10.10.10.32' }],
      serial: 'SAN-0001',
      notes: zh ? '控制器 A 管理 IP 10.10.10.31、控制器 B 10.10.10.32' : 'Controller A management 10.10.10.31, controller B 10.10.10.32',
    }),
  ]

  const trunkAll = { mode: 'trunk' as const, allowedVlans: '10,20,30,40' }
  const esxTrunk = { mode: 'trunk' as const, allowedVlans: '20,30,40', bond: 'lag1', lengthM: 3 }
  const fc = { type: 'MMF-SR' as const, lengthM: 3 }
  const cables: Cable[] = [
    // MLAG peer link
    cable('leaf01', 'Eth1/56', 'leaf02', 'Eth1/56', { ...trunkAll, lengthM: 1, notes: 'MLAG peer-link' }),
    // Firewall (gateways for every VLAN) dual-homed with LACP
    cable('fw01', 'port1', 'leaf01', 'Eth1/48', { ...trunkAll, bond: 'ae0' }),
    cable('fw01', 'port2', 'leaf02', 'Eth1/48', { ...trunkAll, bond: 'ae0' }),
    cable('fw01', 'port3', 'oob-sw01', 'Gi1/0/48', { type: 'Cat6', vlan: 10 }),
    // ESXi uplinks: one vmnic to each leaf, LACP (vDS LAG) carrying ESXi Mgmt, vMotion and VM Network
    ...[1, 2, 3, 4].flatMap((n) => [
      cable(`esx0${n}`, 'vmnic0', 'leaf01', `Eth1/${n}`, esxTrunk),
      cable(`esx0${n}`, 'vmnic1', 'leaf02', `Eth1/${n}`, esxTrunk),
    ]),
    // FC: every host and both array controllers on fabric A (fc-sw01) and fabric B (fc-sw02)
    ...[1, 2, 3, 4].flatMap((n) => [
      cable(`esx0${n}`, 'vmhba1', 'fc-sw01', `fc${n - 1}`, { ...fc, notes: 'Fabric A' }),
      cable(`esx0${n}`, 'vmhba2', 'fc-sw02', `fc${n - 1}`, { ...fc, notes: 'Fabric B' }),
    ]),
    cable('san01', 'A-FC0', 'fc-sw01', 'fc20', { ...fc, notes: 'Fabric A' }),
    cable('san01', 'B-FC0', 'fc-sw01', 'fc21', { ...fc, notes: 'Fabric A' }),
    cable('san01', 'A-FC1', 'fc-sw02', 'fc20', { ...fc, notes: 'Fabric B' }),
    cable('san01', 'B-FC1', 'fc-sw02', 'fc21', { ...fc, notes: 'Fabric B' }),
    // BMCs and array management on the out-of-band switch
    ...[1, 2, 3, 4].map((n) => cable(`esx0${n}`, 'BMC', 'oob-sw01', `Gi1/0/${n}`, { type: 'Cat6', vlan: 10 })),
    cable('san01', 'A-MGMT', 'oob-sw01', 'Gi1/0/5', { type: 'Cat6', vlan: 10 }),
    cable('san01', 'B-MGMT', 'oob-sw01', 'Gi1/0/6', { type: 'Cat6', vlan: 10 }),
  ]

  const svcTexts = zh
    ? { admins: 'IT 管理員', users: '使用者', vc: 'vCenter Server', esxi: 'ESXi 主機', apps: '業務系統 VM（ERP / AP）', oob: 'BMC / SAN 管理' }
    : { admins: 'IT admins', users: 'Users', vc: 'vCenter Server', esxi: 'ESXi hosts', apps: 'Business VMs (ERP / apps)', oob: 'BMC / SAN management' }
  return {
    meta: {
      customer: zh ? 'ACME 精密工業' : 'ACME Precision Industries',
      project: zh ? 'vSphere 虛擬化平台建置' : 'vSphere platform build',
      site: zh ? '新竹廠 機房 B1' : 'Hsinchu plant, server room B1',
      engineer: '',
      company: '',
      date: new Date().toISOString().slice(0, 10),
      notes: zh
        ? '三層式架構：4 台 ESXi 主機、雙控制器 FC SAN 儲存（加 1 台擴充櫃）、FC Switch 雙 Fabric、Leaf 交換器 MLAG；Firewall 作為各 VLAN 的 Gateway。'
        : 'Three-tier: four ESXi hosts, a dual-controller FC SAN array with one expansion shelf, dual FC fabrics, an MLAG leaf pair; the firewall is the gateway for every VLAN.',
      logo: null,
    },
    planner: { project: zh ? 'vSphere 虛擬化平台' : 'vSphere platform', options: PLAN_OPTIONS, requirements: REQUIREMENTS },
    racks: [{ id: 'rack-1', name: 'R01', location: zh ? 'Row A, 第 1 櫃' : 'Row A, rack 1', heightU: 42, pduCapacityW: 7000, voltage: 230, maxWeightKg: 1200, row: 0, col: 1 }],
    rackItems,
    cables,
    services: [
      { id: 'svc-admins', name: svcTexts.admins, kind: 'client', zone: 'Office', addresses: '10.1.5.0/24' },
      { id: 'svc-users', name: svcTexts.users, kind: 'client', zone: 'Office', addresses: '10.1.0.0/16' },
      { id: 'svc-vc', name: svcTexts.vc, kind: 'mgmt', zone: 'ESXi Mgmt VLAN 20', addresses: '10.10.20.10' },
      { id: 'svc-esxi', name: svcTexts.esxi, kind: 'app', zone: 'ESXi Mgmt VLAN 20', addresses: '10.10.20.11, 10.10.20.12, 10.10.20.13, 10.10.20.14' },
      { id: 'svc-apps', name: svcTexts.apps, kind: 'app', zone: 'VM Network VLAN 40', addresses: '10.10.40.0/24' },
      { id: 'svc-oob', name: svcTexts.oob, kind: 'mgmt', zone: 'OOB VLAN 10', addresses: '10.10.10.21, 10.10.10.22, 10.10.10.23, 10.10.10.24, 10.10.10.31, 10.10.10.32' },
    ],
    flows: [
      { id: 'flow-1', from: 'svc-admins', to: 'svc-vc', protocol: 'TCP', ports: '443', purpose: zh ? 'vSphere Client 管理' : 'vSphere Client' },
      { id: 'flow-2', from: 'svc-vc', to: 'svc-esxi', protocol: 'TCP', ports: '443,902', purpose: zh ? 'vCenter 管理主機' : 'vCenter host management' },
      { id: 'flow-3', from: 'svc-esxi', to: 'svc-vc', protocol: 'UDP', ports: '902', purpose: zh ? '主機 Heartbeat' : 'Host heartbeat' },
      { id: 'flow-4', from: 'svc-users', to: 'svc-apps', protocol: 'TCP', ports: '443', purpose: zh ? '業務系統（HTTPS）' : 'Business apps (HTTPS)' },
      { id: 'flow-5', from: 'svc-admins', to: 'svc-oob', protocol: 'TCP', ports: '443', purpose: zh ? 'BMC 與 SAN 網頁管理' : 'BMC and SAN web UI' },
      { id: 'flow-6', from: 'svc-admins', to: 'svc-esxi', protocol: 'TCP', ports: '22', purpose: zh ? 'SSH 疑難排解（平時關閉）' : 'SSH troubleshooting (off by default)' },
    ],
    flowcharts: [
      flowchartFromTemplate(locale, 'install', 'fc-install'),
      { ...flowchartFromTemplate(locale, 'vm-migration', 'fc-vm-migration'), scope: zh ? 'ERP-AP01、ERP-AP02\nERP-DB01' : 'ERP-AP01, ERP-AP02\nERP-DB01' },
    ],
  }
}
