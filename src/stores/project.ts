import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { demoProject } from '@/data/demoProject'
import type { AppLocale } from '@/i18n'
import { flowchartFromTemplate, type FlowchartTemplateId } from '@/i18n/content/flowcharts'
import type {
  AddressPurpose,
  Cable,
  DeviceAddress,
  Flowchart,
  ProjectData,
  ProjectMeta,
  Rack,
  RackItem,
  RackPort,
  ServiceFlow,
  ServiceNode,
} from '@/types/project'
import { checkCabling, nextCableLabel } from '@/utils/cabling'
import { checkFlows } from '@/utils/flows'
import { emptyMeta, emptyProject, parseProjectFile, serializeProject, type ParseError } from '@/utils/projectFile'
import { checkRack, firstFreeU, RACK_TEMPLATES } from '@/utils/rack'
import { gridRackName, nextFreeRow, rackGrid, rowLetter } from '@/utils/floor'
import { planArchitecture, type ArchitectureKind, type ArchitectureOptions } from '@/utils/architecture'
import { emptyPlan, isUntouchedDgxPreset, useProjectPlanStore } from './planner'

const CURRENT_KEY = 'netlab.project'
const LIBRARY_KEY = 'netlab.projects'
/** Which library entry the current project came from, and its content when last saved / opened. */
const OPEN_KEY = 'netlab.projectOpen'

interface OpenEntry {
  id: string
  fingerprint: string
}

function loadOpenEntry(): OpenEntry | null {
  try {
    const raw = JSON.parse(localStorage.getItem(OPEN_KEY) ?? 'null') as Partial<OpenEntry> | null
    return typeof raw?.id === 'string' && typeof raw.fingerprint === 'string' ? { id: raw.id, fingerprint: raw.fingerprint } : null
  } catch {
    return null
  }
}

export interface LibraryEntry {
  id: string
  name: string
  customer: string
  savedAt: string
  /** Serialized project file. */
  file: string
}

export type LibraryResult = { ok: true } | { ok: false; error: ParseError | 'storage' | 'not-found' }

export type ArchitecturePlan = ReturnType<typeof planArchitecture>

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

type Parts = Omit<ProjectData, 'planner'>

function loadParts(): Parts | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    if (!raw) return null
    // Reuse the import validator by wrapping the stored parts as a project file.
    const parsed = parseProjectFile(JSON.stringify({ app: 'netlab', formatVersion: 1, ...JSON.parse(raw) }))
    return parsed.ok ? parsed.data : null
  } catch {
    return null
  }
}

function loadLibrary(): LibraryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]') as unknown
    return Array.isArray(raw)
      ? raw.filter((e): e is LibraryEntry => typeof e?.id === 'string' && typeof e?.file === 'string' && typeof e?.name === 'string')
      : []
  } catch {
    return []
  }
}

export const useProjectStore = defineStore('project', () => {
  const planner = useProjectPlanStore()

  const initial = loadParts() ?? emptyProject()
  // Up to v1.3.4 an empty project silently got the DGX example plan, which then showed up as the project
  // name in the handover report. Drop it when it was never edited and the project has nothing else.
  const m0 = initial.meta
  if (!m0.customer && !m0.project && !initial.racks.length && isUntouchedDgxPreset(planner.snapshot())) planner.apply(emptyPlan())
  const meta = ref<ProjectMeta>(initial.meta)
  const racks = ref<Rack[]>(initial.racks)
  const rackItems = ref<RackItem[]>(initial.rackItems)
  const cables = ref<Cable[]>(initial.cables)
  const services = ref<ServiceNode[]>(initial.services)
  const flows = ref<ServiceFlow[]>(initial.flows)
  const flowcharts = ref<Flowchart[]>(initial.flowcharts)
  /** Projects saved in this browser. Exported .netlab.json files are the backup. */
  const library = ref<LibraryEntry[]>(loadLibrary())
  /** Last storage error, e.g. the browser quota was exceeded. */
  const storageError = ref(false)
  const openEntry = ref<OpenEntry | null>(loadOpenEntry())
  watch(openEntry, (v) => {
    try {
      if (v) localStorage.setItem(OPEN_KEY, JSON.stringify(v))
      else localStorage.removeItem(OPEN_KEY)
    } catch {
      // only a convenience; the project itself is saved separately
    }
  }, { flush: 'sync' })

  watch(
    [meta, racks, rackItems, cables, services, flows, flowcharts],
    () => {
      try {
        const parts: Parts = {
          meta: meta.value,
          racks: racks.value,
          rackItems: rackItems.value,
          cables: cables.value,
          services: services.value,
          flows: flows.value,
          flowcharts: flowcharts.value,
        }
        localStorage.setItem(CURRENT_KEY, JSON.stringify(parts))
        storageError.value = false
      } catch {
        storageError.value = true
      }
    },
    { deep: true },
  )

  // --- Derived ------------------------------------------------------------------
  const subnets = computed(() => planner.result.subnets)
  const rackIssues = computed(() => new Map(racks.value.map((r) => [r.id, checkRack(r, rackItems.value)])))
  const cableIssues = computed(() => checkCabling(rackItems.value, cables.value))
  const flowIssues = computed(() => checkFlows(services.value, flows.value))
  const title = computed(() => meta.value.project || planner.project || '—')

  // --- Whole project --------------------------------------------------------------
  function snapshot(): ProjectData {
    return JSON.parse(
      JSON.stringify({
        meta: meta.value,
        planner: { project: planner.project, options: planner.options, requirements: planner.requirements },
        racks: racks.value,
        rackItems: rackItems.value,
        cables: cables.value,
        services: services.value,
        flows: flows.value,
        flowcharts: flowcharts.value,
      }),
    ) as ProjectData
  }

  function load(data: ProjectData): void {
    meta.value = data.meta
    racks.value = data.racks
    rackItems.value = data.rackItems
    cables.value = data.cables
    services.value = data.services
    flows.value = data.flows
    flowcharts.value = data.flowcharts
    planner.apply({ project: data.planner.project, options: data.planner.options, requirements: data.planner.requirements })
  }

  /** Project content without timestamps, to tell whether it changed since it was saved. */
  const fingerprint = computed(() => JSON.stringify(snapshot()))
  /** The library entry the current project is linked to (opened from, or last saved as). */
  const openLibraryId = computed(() => (openEntry.value && library.value.some((e) => e.id === openEntry.value!.id) ? openEntry.value.id : null))
  /** True when the current project has changes that are not in the library. */
  const unsaved = computed(() => {
    if (openLibraryId.value) return openEntry.value!.fingerprint !== fingerprint.value
    const m = meta.value
    return Boolean(m.customer || m.project || m.site || m.notes || racks.value.length || cables.value.length || services.value.length || flowcharts.value.length || planner.requirements.length)
  })

  function newProject(): void {
    const empty = emptyProject()
    empty.meta = emptyMeta()
    load(empty)
    openEntry.value = null
  }

  function loadDemo(locale: AppLocale): void {
    load(demoProject(locale))
    openEntry.value = null
  }

  function exportFile(): string {
    return serializeProject(snapshot())
  }

  function importFile(text: string): ParseError | null {
    const parsed = parseProjectFile(text)
    if (!parsed.ok) return parsed.error
    load(parsed.data)
    // A file from disk is not linked to a library entry until it is saved.
    openEntry.value = null
    return null
  }

  function persistLibrary(next: LibraryEntry[]): boolean {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next))
      library.value = next
      return true
    } catch {
      storageError.value = true
      return false
    }
  }

  function saveToLibrary(): LibraryResult {
    const name = meta.value.project || planner.project || 'Untitled'
    const customer = meta.value.customer
    // Saving updates the entry this project was opened from (even after a rename), otherwise one with the same name and customer.
    const list = library.value
    const linked = list.findIndex((e) => e.id === openLibraryId.value)
    const existing = linked >= 0 ? linked : list.findIndex((e) => e.name === name && e.customer === customer)
    const entry: LibraryEntry = { id: existing >= 0 ? list[existing]!.id : uid('proj'), name, customer, savedAt: new Date().toISOString(), file: exportFile() }
    const next = existing >= 0 ? list.map((e, i) => (i === existing ? entry : e)) : [entry, ...list]
    if (!persistLibrary(next)) return { ok: false, error: 'storage' }
    openEntry.value = { id: entry.id, fingerprint: fingerprint.value }
    return { ok: true }
  }

  function openFromLibrary(id: string): LibraryResult {
    const text = library.value.find((e) => e.id === id)?.file
    if (text === undefined) return { ok: false, error: 'not-found' }
    const error = importFile(text)
    if (error) return { ok: false, error }
    openEntry.value = { id, fingerprint: fingerprint.value }
    return { ok: true }
  }

  function removeFromLibrary(id: string): LibraryResult {
    return persistLibrary(library.value.filter((e) => e.id !== id)) ? { ok: true } : { ok: false, error: 'storage' }
  }

  // --- Racks ----------------------------------------------------------------------
  function addRack(): Rack {
    // Place it next to the last rack of the last row on the floor plan.
    const placed = racks.value.filter((r) => r.row !== null && r.col !== null)
    const row = placed.length ? Math.max(...placed.map((r) => r.row!)) : 0
    const col = Math.max(0, ...placed.filter((r) => r.row === row).map((r) => r.col!)) + 1
    const rack: Rack = { id: uid('rack'), name: `R${String(racks.value.length + 1).padStart(2, '0')}`, location: '', heightU: 42, pduCapacityW: 7000, voltage: 230, maxWeightKg: 1200, row, col }
    racks.value.push(rack)
    return rack
  }

  /**
   * Adds a rows × cols block of identical racks (e.g. a 3 × 4 room: A01…C04) after the rows already in use.
   * `location` turns a row letter and slot into the human-readable location text.
   */
  function addRackGrid(
    opts: { rows: number; cols: number; heightU: number; pduCapacityW: number; voltage: number; maxWeightKg: number },
    location: (letter: string, col: number) => string,
  ): Rack[] {
    const startRow = nextFreeRow(racks.value)
    const created = rackGrid({ rows: opts.rows, cols: opts.cols, startRow }).map(
      (g): Rack => ({
        id: uid('rack'),
        name: g.name,
        location: location(rowLetter(g.row), g.col),
        heightU: opts.heightU,
        pduCapacityW: opts.pduCapacityW,
        voltage: opts.voltage,
        maxWeightKg: opts.maxWeightKg,
        row: g.row,
        col: g.col,
      }),
    )
    racks.value.push(...created)
    return created
  }

  /** Adds the racks and devices of an architecture template after the rows already in use. */
  function addArchitecture(kind: ArchitectureKind, opts: ArchitectureOptions, location: (letter: string, col: number) => string): ArchitecturePlan {
    const plan = planArchitecture(kind, opts, {
      existingRacks: racks.value,
      existingItems: rackItems.value,
      row: nextFreeRow(racks.value),
      newId: uid,
      location: (row, col) => location(rowLetter(row), col),
      rackName: gridRackName,
    })
    if (plan.ok) {
      racks.value.push(...plan.racks)
      rackItems.value.push(...plan.items)
    }
    return plan
  }

  function updateRack(id: string, patch: Partial<Rack>): void {
    const r = racks.value.find((x) => x.id === id)
    if (r) Object.assign(r, patch)
  }

  function removeRack(id: string): void {
    const itemIds = new Set(rackItems.value.filter((i) => i.rackId === id).map((i) => i.id))
    racks.value = racks.value.filter((r) => r.id !== id)
    rackItems.value = rackItems.value.filter((i) => i.rackId !== id)
    cables.value = cables.value.filter((c) => !itemIds.has(c.aItemId) && !itemIds.has(c.bItemId))
  }

  /** Adds a device from a template at the lowest free U. Returns null if the rack is full. */
  function addItem(rackId: string, templateKey: string): RackItem | null {
    const rack = racks.value.find((r) => r.id === rackId)
    const t = RACK_TEMPLATES[templateKey]
    if (!rack || !t) return null
    const u = firstFreeU(rack, rackItems.value, t.uHeight)
    if (u === null) return null
    const sameType = rackItems.value.filter((i) => i.type === t.type).length + 1
    const base = t.type === 'blank' ? 'blank' : t.type.replace('-server', '').replace('mgmt-switch', 'oob-sw').replace('switch', 'sw')
    const name = `${base}${String(sameType).padStart(2, '0')}`
    const item: RackItem = {
      id: uid('item'),
      rackId,
      name,
      model: t.model,
      type: t.type,
      uHeight: t.uHeight,
      uPosition: u,
      powerW: t.powerW,
      weightKg: t.weightKg,
      psus: t.psus,
      hostname: t.type === 'blank' || t.type === 'patch-panel' ? '' : name,
      ip: '',
      mgmtIp: '',
      addresses: [],
      serial: '',
      assetTag: '',
      os: '',
      notes: '',
      ports: t.ports.map((p) => ({ ...p })),
    }
    rackItems.value.push(item)
    return item
  }

  function updateItem(id: string, patch: Partial<RackItem>): void {
    const it = rackItems.value.find((x) => x.id === id)
    if (it) Object.assign(it, patch)
  }

  // --- Device ports & addresses -------------------------------------------------------
  /** Adds a port named after the last one (eth1 → eth2), with the same speed. */
  function addPort(itemId: string): void {
    const it = rackItems.value.find((x) => x.id === itemId)
    if (!it) return
    const last = it.ports.at(-1)
    const taken = new Set(it.ports.map((p) => p.name))
    const m = last?.name.match(/^(.*?)(\d+)$/)
    let name = 'eth0'
    if (m) for (let n = Number(m[2]) + 1; ; n++) if (!taken.has((name = `${m[1]}${n}`))) break
    for (let n = 1; taken.has(name); n++) name = `port${n}`
    it.ports.push({ name, speed: last?.speed ?? 25 })
  }

  /** Updates a port; a rename is carried over to the cables that use it, so the cabling stays connected. */
  function updatePort(itemId: string, index: number, patch: Partial<RackPort>): void {
    const it = rackItems.value.find((x) => x.id === itemId)
    const port = it?.ports[index]
    if (!it || !port) return
    if (patch.name !== undefined && patch.name !== port.name) {
      for (const c of cables.value) {
        if (c.aItemId === itemId && c.aPort === port.name) c.aPort = patch.name
        if (c.bItemId === itemId && c.bPort === port.name) c.bPort = patch.name
      }
      for (const a of it.addresses) if (a.iface === port.name) a.iface = patch.name
    }
    Object.assign(port, patch)
  }

  /** Removes a port and the cables plugged into it. */
  function removePort(itemId: string, index: number): void {
    const it = rackItems.value.find((x) => x.id === itemId)
    const port = it?.ports[index]
    if (!it || !port) return
    cables.value = cables.value.filter((c) => !((c.aItemId === itemId && c.aPort === port.name) || (c.bItemId === itemId && c.bPort === port.name)))
    it.ports.splice(index, 1)
  }

  function addAddress(itemId: string, purpose: AddressPurpose = 'vmotion'): void {
    rackItems.value.find((x) => x.id === itemId)?.addresses.push({ id: uid('ip'), purpose, iface: '', vlan: null, address: '' })
  }

  function updateAddress(itemId: string, addressId: string, patch: Partial<Omit<DeviceAddress, 'id'>>): void {
    const a = rackItems.value.find((x) => x.id === itemId)?.addresses.find((x) => x.id === addressId)
    if (a) Object.assign(a, patch)
  }

  function removeAddress(itemId: string, addressId: string): void {
    const it = rackItems.value.find((x) => x.id === itemId)
    if (it) it.addresses = it.addresses.filter((a) => a.id !== addressId)
  }

  function removeItem(id: string): void {
    rackItems.value = rackItems.value.filter((i) => i.id !== id)
    cables.value = cables.value.filter((c) => c.aItemId !== id && c.bItemId !== id)
  }

  // --- Cables ---------------------------------------------------------------------
  function addCable(partial: Partial<Cable> = {}): Cable {
    const c: Cable = {
      id: uid('cable'),
      label: nextCableLabel(cables.value),
      aItemId: '',
      aPort: '',
      bItemId: '',
      bPort: '',
      type: 'DAC',
      lengthM: 3,
      mode: 'access',
      vlan: null,
      allowedVlans: '',
      bond: '',
      notes: '',
      ...partial,
    }
    cables.value.push(c)
    return c
  }

  function updateCable(id: string, patch: Partial<Cable>): void {
    const c = cables.value.find((x) => x.id === id)
    if (c) Object.assign(c, patch)
  }

  function removeCable(id: string): void {
    cables.value = cables.value.filter((c) => c.id !== id)
  }

  // --- Services & flows --------------------------------------------------------------
  function addService(): ServiceNode {
    const s: ServiceNode = { id: uid('svc'), name: `Service ${services.value.length + 1}`, kind: 'app', zone: 'Server', addresses: '' }
    services.value.push(s)
    return s
  }

  function removeService(id: string): void {
    services.value = services.value.filter((s) => s.id !== id)
    flows.value = flows.value.filter((f) => f.from !== id && f.to !== id)
  }

  function addFlow(): ServiceFlow | null {
    const [a, b] = services.value
    if (!a) return null
    const f: ServiceFlow = { id: uid('flow'), from: a.id, to: (b ?? a).id, protocol: 'TCP', ports: '443', purpose: '' }
    flows.value.push(f)
    return f
  }

  function removeFlow(id: string): void {
    flows.value = flows.value.filter((f) => f.id !== id)
  }

  // --- Flowcharts --------------------------------------------------------------------
  function addFlowchart(locale: AppLocale, template: FlowchartTemplateId | 'blank', blankTitle: string): Flowchart {
    const id = uid('fc')
    const fc: Flowchart =
      template === 'blank'
        ? {
            id,
            title: blankTitle,
            scope: '',
            nodes: [
              { id: 'n1', type: 'start', text: 'Start', next: 'n2', yes: null, no: null },
              { id: 'n2', type: 'end', text: 'End', next: null, yes: null, no: null },
            ],
          }
        : flowchartFromTemplate(locale, template, id)
    flowcharts.value.push(fc)
    return fc
  }

  function removeFlowchart(id: string): void {
    flowcharts.value = flowcharts.value.filter((f) => f.id !== id)
  }

  /** Adds a ready-made chart (a copy, or one built from a work order) with a fresh id; returns it. */
  function insertFlowchart(fc: Omit<Flowchart, 'id'>): Flowchart {
    const copy: Flowchart = { ...JSON.parse(JSON.stringify(fc)), id: uid('fc') }
    flowcharts.value.push(copy)
    return copy
  }

  return {
    meta,
    racks,
    rackItems,
    cables,
    services,
    flows,
    flowcharts,
    library,
    storageError,
    openLibraryId,
    unsaved,
    subnets,
    rackIssues,
    cableIssues,
    flowIssues,
    title,
    snapshot,
    load,
    newProject,
    loadDemo,
    exportFile,
    importFile,
    saveToLibrary,
    openFromLibrary,
    removeFromLibrary,
    addRack,
    addRackGrid,
    addArchitecture,
    updateRack,
    removeRack,
    addItem,
    updateItem,
    removeItem,
    addPort,
    updatePort,
    removePort,
    addAddress,
    updateAddress,
    removeAddress,
    addCable,
    updateCable,
    removeCable,
    addService,
    removeService,
    addFlow,
    removeFlow,
    addFlowchart,
    removeFlowchart,
    insertFlowchart,
  }
})
