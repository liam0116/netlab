/**
 * A sample work order: rebalancing memory between ESXi hosts and swapping two DIMMs to find out whether an
 * ECC error follows the module or stays with the slot. Every check in the work-order page passes for it.
 */
import type { AppLocale } from '@/i18n'
import type { MaintenanceJob } from '@/types/project'

export function demoMaintenanceJob(locale: AppLocale, id = 'job-sample'): MaintenanceJob {
  const zh = locale === 'zh-TW'
  return {
    id,
    title: zh ? '記憶體調整與 ECC 排查' : 'Memory rebalance and ECC check',
    customer: zh ? 'ACME 精密工業' : 'ACME Precision Industries',
    site: zh ? '新竹廠 機房 B1' : 'Hsinchu plant, server room B1',
    engineer: '',
    ticket: 'SR-20261015-001',
    date: new Date().toISOString().slice(0, 10),
    notes: zh
      ? '把 esx01、esx02 各 2 條記憶體移到 esx04；esx03 BMC 回報 A1 ECC 錯誤，A1 與 B1 左右對調，看錯誤跟著 DIMM 還是留在插槽。'
      : 'Move 2 DIMMs each from esx01 and esx02 to esx04; esx03 BMC reports ECC errors on A1, so swap A1 and B1 to see whether the error follows the DIMM or stays with the slot.',
    ops: [
      { id: 'op-1', kind: 'move', part: 'dimm', fromHost: 'esx01', fromSlots: 'B7, B8', toHost: 'esx04', toSlots: 'A7, A8', spec: '32GB DDR5-4800 RDIMM', serial: '', done: false, notes: '' },
      { id: 'op-2', kind: 'move', part: 'dimm', fromHost: 'esx02', fromSlots: 'B7, B8', toHost: 'esx04', toSlots: 'B7, B8', spec: '32GB DDR5-4800 RDIMM', serial: '', done: false, notes: '' },
      { id: 'op-3', kind: 'swap', part: 'dimm', fromHost: 'esx03', fromSlots: 'A1', toHost: '', toSlots: 'B1', spec: '32GB DDR5-4800 RDIMM', serial: '', done: false, notes: zh ? '開機後看 BMC 事件紀錄，錯誤若變成 B1 就是 DIMM 壞' : 'After power-on, if the BMC now reports B1 the DIMM is faulty' },
    ],
    startTime: '',
    endTime: '',
    fieldNotes: '',
    actual: {},
  }
}
