import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { demoMaintenanceJob } from '@/data/demoMaintenance'
import type { AppLocale } from '@/i18n'
import type { MaintenanceJob, PartOp } from '@/types/project'
import { parseJobs, parseMaintenanceFile, serializeJobs } from '@/utils/maintenanceFile'
import type { ParseError } from '@/utils/projectFile'

const KEY = 'netlab.maintenance'
/** v1.3.0 kept work orders inside the current project. */
const LEGACY_PROJECT_KEY = 'netlab.project'

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

function loadJobs(): MaintenanceJob[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null) return parseJobs(JSON.parse(raw))
    const legacy = JSON.parse(localStorage.getItem(LEGACY_PROJECT_KEY) ?? 'null') as { maintenance?: unknown } | null
    return parseJobs(legacy?.maintenance)
  } catch {
    return []
  }
}

/** Maintenance work orders: service on machines already in use, kept apart from projects (new builds). */
export const useMaintenanceStore = defineStore('maintenance', () => {
  const jobs = ref<MaintenanceJob[]>(loadJobs())
  const storageError = ref(false)

  watch(
    jobs,
    (v) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(v))
        storageError.value = false
      } catch {
        storageError.value = true
      }
    },
    { deep: true, immediate: true },
  )

  const find = (jobId: string) => jobs.value.find((j) => j.id === jobId)

  function addJob(title: string, from?: MaintenanceJob): MaintenanceJob {
    const job: MaintenanceJob = {
      id: uid('job'),
      title,
      // A new order for the same customer usually keeps the customer, site and engineer.
      customer: from?.customer ?? '',
      site: from?.site ?? '',
      engineer: from?.engineer ?? '',
      ticket: '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
      ops: [],
      startTime: '',
      endTime: '',
      fieldNotes: '',
      actual: {},
    }
    jobs.value.push(job)
    return job
  }

  function addSample(locale: AppLocale): MaintenanceJob {
    const job = demoMaintenanceJob(locale, uid('job'))
    jobs.value.push(job)
    return job
  }

  function removeJob(jobId: string): void {
    jobs.value = jobs.value.filter((j) => j.id !== jobId)
  }

  function addPartOp(jobId: string, op: (id: string) => PartOp): void {
    find(jobId)?.ops.push(op(uid('op')))
  }

  function removePartOp(jobId: string, opId: string): void {
    const job = find(jobId)
    if (job) job.ops = job.ops.filter((o) => o.id !== opId)
  }

  /** Moves a line up (-1) or down (+1) in its work order. */
  function movePartOp(jobId: string, index: number, delta: -1 | 1): void {
    const ops = find(jobId)?.ops
    const to = index + delta
    if (!ops || to < 0 || to >= ops.length) return
    ;[ops[index], ops[to]] = [ops[to]!, ops[index]!]
  }

  /** Every machine name used so far, offered as suggestions when typing a host. */
  function knownHosts(): string[] {
    const names = jobs.value.flatMap((j) => j.ops.flatMap((o) => [o.fromHost.trim(), o.toHost.trim()])).filter(Boolean)
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  }

  function exportJobs(ids?: string[]): string {
    return serializeJobs(jobs.value.filter((j) => !ids || ids.includes(j.id)))
  }

  /** Adds the orders from a file with fresh ids, so importing the same file twice never clashes. Returns them. */
  function importFile(text: string): { ok: true; jobs: MaintenanceJob[] } | { ok: false; error: ParseError | 'no-jobs' } {
    const parsed = parseMaintenanceFile(text)
    if (!parsed.ok) return parsed
    const added = parsed.jobs.map((j) => ({ ...j, id: uid('job'), ops: j.ops.map((o) => ({ ...o, id: uid('op') })) }))
    jobs.value.push(...added)
    return { ok: true, jobs: added }
  }

  return { jobs, storageError, addJob, addSample, removeJob, addPartOp, removePartOp, movePartOp, knownHosts, exportJobs, importFile }
})
