/**
 * Work-order file (de)serialization. Work orders are kept apart from projects: a project is a new build,
 * a work order is service on machines that are already running. Imported files are untrusted.
 */
import type { MaintenanceFile, MaintenanceJob, PartKind, PartOp, PartOpKind } from '@/types/project'
import { id, isObj, list, MAX_FILE_BYTES, oneOf, str, type Obj, type ParseError } from './projectFile'

const OP_KINDS: PartOpKind[] = ['move', 'swap', 'remove', 'install', 'replace']
const PART_KINDS: PartKind[] = ['dimm', 'disk', 'nic', 'gpu', 'cpu', 'psu', 'fan', 'other']

const partOp = (o: Obj): PartOp | null => {
  const oid = id(o.id)
  return oid
    ? {
        id: oid,
        kind: oneOf(o.kind, OP_KINDS, 'move'),
        part: oneOf(o.part, PART_KINDS, 'other'),
        fromHost: str(o.fromHost, 80),
        fromSlots: str(o.fromSlots, 200),
        toHost: str(o.toHost, 80),
        toSlots: str(o.toSlots, 200),
        spec: str(o.spec, 120),
        serial: str(o.serial, 200),
        done: o.done === true,
        notes: str(o.notes, 400),
      }
    : null
}

const time = (v: unknown): string => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '')

export const maintenanceJob = (j: Obj): MaintenanceJob | null => {
  const jid = id(j.id)
  return jid
    ? {
        id: jid,
        title: str(j.title, 120),
        customer: str(j.customer, 120),
        site: str(j.site, 120),
        engineer: str(j.engineer, 120),
        ticket: str(j.ticket, 80),
        date: /^\d{4}-\d{2}-\d{2}$/.test(str(j.date)) ? str(j.date) : '',
        notes: str(j.notes, 4000),
        ops: list(j.ops, partOp).slice(0, 500),
        startTime: time(j.startTime),
        endTime: time(j.endTime),
        fieldNotes: str(j.fieldNotes, 4000),
        actual: isObj(j.actual)
          ? Object.fromEntries(
              Object.entries(j.actual)
                .slice(0, 500)
                .filter((e): e is [string, string] => typeof e[1] === 'string' && e[0].length <= 80)
                .map(([k, v]) => [k, v.slice(0, 200)]),
            )
          : {},
      }
    : null
}

export const parseJobs = (v: unknown): MaintenanceJob[] => list(v, maintenanceJob)

export function serializeJobs(jobs: MaintenanceJob[], savedAt = new Date().toISOString()): string {
  const file: MaintenanceFile = { app: 'netlab-maintenance', formatVersion: 1, savedAt, jobs }
  return JSON.stringify(file, null, 2)
}

/**
 * Reads a work-order file. Project files from v1.3.0, which still held work orders, are accepted too
 * so those orders are not lost; a project file without any is reported as not a work-order file.
 */
export function parseMaintenanceFile(text: string): { ok: true; jobs: MaintenanceJob[] } | { ok: false; error: ParseError | 'no-jobs' } {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'too-large' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'not-json' }
  }
  if (!isObj(raw) || (raw.app !== 'netlab-maintenance' && raw.app !== 'netlab')) return { ok: false, error: 'not-netlab' }
  if (raw.formatVersion !== 1) return { ok: false, error: 'unsupported-version' }
  const jobs = parseJobs(raw.app === 'netlab' ? raw.maintenance : raw.jobs)
  return jobs.length ? { ok: true, jobs } : { ok: false, error: 'no-jobs' }
}
