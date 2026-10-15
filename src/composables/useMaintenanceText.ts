import { useI18n } from 'vue-i18n'
import type { MaintenanceJob, PartOp } from '@/types/project'
import { jobToFlowchart, parseSlots, type HostSummary } from '@/utils/maintenance'

/** Work-order sentences in the UI language, shared by the editor, the printed sheet and the generated flowchart. */
export function useMaintenanceText() {
  const { t } = useI18n()

  const slots = (text: string) => parseSlots(text).join(t('maintenancePage.listSep'))
  const sameHost = (op: PartOp) => !op.toHost.trim() || op.toHost.trim().toLowerCase() === op.fromHost.trim().toLowerCase()

  /** "從 esx01 的 B1、B2 拆下 → 插到 esx04 的 A3、A4" */
  function opText(op: PartOp): string {
    const p = { from: op.fromHost.trim() || '?', fromSlots: slots(op.fromSlots) || '?', to: op.toHost.trim() || '?', toSlots: slots(op.toSlots) || '?' }
    const key = op.kind === 'swap' && sameHost(op) ? 'swapSame' : op.kind
    return t(`maintenancePage.sentence.${key}`, p)
  }

  /** "2 × 記憶體 · 32GB RDIMM" */
  function opDetail(op: PartOp): string {
    const n = parseSlots(op.kind === 'install' ? op.toSlots : op.fromSlots).length
    const part = t(`maintenancePage.parts.${op.part}`)
    return [n ? `${n} × ${part}` : part, op.spec.trim()].filter(Boolean).join(' · ')
  }

  const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

  /** "+4（+128 GB）", or a reminder to check the event log when nothing was added or removed. */
  function changeText(h: HostSummary): string {
    const n = h.in - h.out
    if (!h.in && !h.out) return t('maintenancePage.noCountChange')
    const gb = h.deltaGb ? t('maintenancePage.gb', { gb: signed(h.deltaGb) }) : ''
    return t('maintenancePage.countChange', { n: signed(n), in: h.in, out: h.out }) + gb
  }

  function hostUpText(h: HostSummary | string): string {
    // A machine that only had swaps / replacements keeps its count: just check for errors.
    return typeof h === 'string' || (!h.in && !h.out)
      ? t('maintenancePage.flow.hostUpPlain', { host: typeof h === 'string' ? h : h.host })
      : t('maintenancePage.flow.hostUp', { host: h.host, change: changeText(h) })
  }

  function toFlowchart(job: MaintenanceJob, id: string) {
    return jobToFlowchart(job, id, {
      start: t('maintenancePage.flow.start', { title: job.title || t('maintenancePage.untitled') }),
      prepare: t('maintenancePage.flow.prepare'),
      hostDown: (host) => t('maintenancePage.flow.hostDown', { host }),
      op: (op) => t('maintenancePage.flow.op', { text: opText(op), detail: opDetail(op) }),
      hostUp: hostUpText,
      check: t('maintenancePage.flow.check'),
      fix: t('maintenancePage.flow.fix'),
      end: t('maintenancePage.flow.end'),
    })
  }

  return { opText, opDetail, changeText, toFlowchart, slots }
}
