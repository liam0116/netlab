import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { planNetwork, type PlanOptions, type PlanRequirement } from '@/utils/planner'


export interface PlannerState {
  project: string
  options: PlanOptions
  requirements: PlanRequirement[]
}

let nextId = 1
const newId = () => `r${Date.now().toString(36)}${nextId++}`

/** Spec section 九: DGX Spark Lab, one VLAN per role, VLAN ID in the third octet. */
export function dgxPreset(): PlannerState {
  return {
    project: 'DGX Spark Lab',
    options: { base: '10.10.0.0/16', strategy: 'vlan-octet', gateway: 'first', growthPercent: 0, reserveGateway: true },
    requirements: [
      { id: newId(), name: 'Management', vlan: 10, hosts: 20 },
      { id: newId(), name: 'Server', vlan: 20, hosts: 50 },
      { id: newId(), name: 'Storage', vlan: 30, hosts: 30 },
      { id: newId(), name: 'VM', vlan: 40, hosts: 100 },
    ],
  }
}

/** A plan with nothing in it: where a new customer project starts. */
export function emptyPlan(): PlannerState {
  return {
    project: '',
    options: { base: '10.10.0.0/16', strategy: 'vlsm', gateway: 'first', growthPercent: 0, reserveGateway: true },
    requirements: [],
  }
}

/** True for the DGX example exactly as it was preset, i.e. nobody has edited it. */
export function isUntouchedDgxPreset(s: PlannerState): boolean {
  const preset = dgxPreset()
  const sig = (p: PlannerState) => JSON.stringify([p.project, p.options, p.requirements.map((r) => [r.name, r.vlan, r.hosts])])
  return sig(s) === sig(preset)
}

/** Spec section 十: one-click VLSM plan out of 10.10.0.0/16. */
export function vlsmPreset(): PlannerState {
  return {
    project: 'Datacenter',
    options: { base: '10.10.0.0/16', strategy: 'vlsm', gateway: 'first', growthPercent: 0, reserveGateway: true },
    requirements: [
      { id: newId(), name: 'Management', vlan: 10, hosts: 20 },
      { id: newId(), name: 'Server', vlan: 20, hosts: 100 },
      { id: newId(), name: 'Storage', vlan: 30, hosts: 50 },
      { id: newId(), name: 'VM', vlan: 40, hosts: 200 },
      { id: newId(), name: 'Backup', vlan: 50, hosts: 20 },
    ],
  }
}

function load(key: string, fallback: () => PlannerState): PlannerState {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const s = JSON.parse(raw) as Partial<PlannerState>
      if (typeof s.project === 'string' && s.options && Array.isArray(s.requirements)) return s as PlannerState
    }
  } catch {
    // fall through to the default
  }
  return fallback()
}

/**
 * One IP plan with its own saved state. Two instances exist so that the stand-alone calculator never
 * changes a customer project:
 *  - useProjectPlanStore: the current project's plan (Project → IP Plan; saved in project files)
 *  - useToolPlannerStore: the scratch plan of Tools → IP Planner
 */
const definePlannerStore = (id: string, storageKey: string, fallback: () => PlannerState) => defineStore(id, () => {
  const initial = load(storageKey, fallback)
  const project = ref(initial.project)
  const options = ref<PlanOptions>(initial.options)
  const requirements = ref<PlanRequirement[]>(initial.requirements)

  watch(
    [project, options, requirements],
    () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ project: project.value, options: options.value, requirements: requirements.value }))
      } catch {
        // storage unavailable: the plan just won't persist
      }
    },
    { deep: true },
  )

  const result = computed(() => planNetwork(requirements.value, options.value))

  function addRequirement(): void {
    const usedVlans = requirements.value.map((r) => r.vlan ?? 0)
    const vlan = usedVlans.length ? Math.max(...usedVlans) + 10 : 10
    requirements.value.push({ id: newId(), name: `VLAN ${vlan}`, vlan: vlan <= 4094 ? vlan : null, hosts: 10 })
  }

  function removeRequirement(id: string): void {
    requirements.value = requirements.value.filter((r) => r.id !== id)
  }

  function apply(state: PlannerState): void {
    project.value = state.project
    options.value = state.options
    requirements.value = state.requirements
  }

  /** A deep copy of the plan, e.g. to copy it from the calculator into the project. */
  function snapshot(): PlannerState {
    return JSON.parse(JSON.stringify({ project: project.value, options: options.value, requirements: requirements.value })) as PlannerState
  }

  return { project, options, requirements, result, addRequirement, removeRequirement, apply, snapshot }
})

// 'netlab.planner' already holds the current project's plan for existing users, so the project keeps that key.
// A new project starts with no plan; the stand-alone calculator starts with the DGX example to play with.
export const useProjectPlanStore = definePlannerStore('planner', 'netlab.planner', emptyPlan)
export const useToolPlannerStore = definePlannerStore('plannerTool', 'netlab.plannerTool', dgxPreset)
export type PlannerStore = ReturnType<typeof useProjectPlanStore>
