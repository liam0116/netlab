/**
 * Flowchart templates per locale. Node ids and wiring are shared; only the text differs.
 */
import type { AppLocale } from '@/i18n'
import type { FlowNode, FlowNodeType } from '@/types/project'

/** Most used first: installation, hardware maintenance, VM migration, data migration, troubleshooting. */
export const FLOWCHART_TEMPLATES = ['install', 'maintenance', 'vm-migration', 'migration', 'troubleshoot'] as const
export type FlowchartTemplateId = (typeof FLOWCHART_TEMPLATES)[number]

type Row = [id: string, type: FlowNodeType, next: string | null, yes?: string, no?: string]

const WIRING: Record<FlowchartTemplateId, Row[]> = {
  install: [
    ['s', 'start', 'n1'],
    ['n1', 'step', 'n2'],
    ['n2', 'step', 'n3'],
    ['n3', 'step', 'n4'],
    ['n4', 'step', 'd1'],
    ['d1', 'decision', null, 'n5', 'f1'],
    ['f1', 'step', 'd1'],
    ['n5', 'step', 'n6'],
    ['n6', 'step', 'n7'],
    ['n7', 'step', 'd2'],
    ['d2', 'decision', null, 'e', 'f2'],
    ['f2', 'step', 'd2'],
    ['e', 'end', null],
  ],
  maintenance: [
    ['s', 'start', 'n1'],
    ['n1', 'step', 'n2'],
    ['n2', 'step', 'd1'],
    ['d1', 'decision', null, 'n3', 'n4'],
    ['n3', 'step', 'n4'],
    ['n4', 'step', 'n5'],
    ['n5', 'step', 'n6'],
    ['n6', 'step', 'n7'],
    ['n7', 'step', 'd2'],
    ['d2', 'decision', null, 'n8', 'f1'],
    ['f1', 'step', 'd2'],
    ['n8', 'step', 'n9'],
    ['n9', 'step', 'e'],
    ['e', 'end', null],
  ],
  'vm-migration': [
    ['s', 'start', 'n1'],
    ['n1', 'step', 'n2'],
    ['n2', 'step', 'd1'],
    ['d1', 'decision', null, 'n3', 'n4'],
    ['n3', 'step', 'd2'],
    ['n4', 'step', 'd2'],
    ['d2', 'decision', null, 'd3', 'f1'],
    ['f1', 'step', 'd2'],
    ['d3', 'decision', null, 'n2', 'n5'],
    ['n5', 'step', 'e'],
    ['e', 'end', null],
  ],
  migration: [
    ['s', 'start', 'n1'],
    ['n1', 'step', 'n2'],
    ['n2', 'step', 'd1'],
    ['d1', 'decision', null, 'n4', 'n3'],
    ['n3', 'step', 'n4'],
    ['n4', 'step', 'n5'],
    ['n5', 'step', 'd2'],
    ['d2', 'decision', null, 'n6', 'r'],
    ['n6', 'step', 'e'],
    ['r', 'step', 'e2'],
    ['e', 'end', null],
    ['e2', 'end', null],
  ],
  troubleshoot: [
    ['s', 'start', 'd1'],
    ['d1', 'decision', null, 'd2', 'a1'],
    ['a1', 'step', 'd1'],
    ['d2', 'decision', null, 'd3', 'a2'],
    ['a2', 'step', 'd2'],
    ['d3', 'decision', null, 'd4', 'a3'],
    ['a3', 'step', 'd3'],
    ['d4', 'decision', null, 'd5', 'a4'],
    ['a4', 'step', 'd4'],
    ['d5', 'decision', null, 'e', 'a5'],
    ['a5', 'step', 'd5'],
    ['e', 'end', null],
  ],
}

const TEXT: Record<AppLocale, Record<FlowchartTemplateId, { title: string; nodes: Record<string, string> }>> = {
  'zh-TW': {
    install: {
      title: '設備安裝流程',
      nodes: {
        s: '開始：設備到貨',
        n1: '開箱點收：核對序號與裝箱單',
        n2: '上架：依機櫃圖安裝到指定 U 位',
        n3: '接電：A / B 兩路 PDU',
        n4: '接線：依佈線表接線並貼標籤',
        d1: '所有網路燈號正常？',
        f1: '檢查線材 / 光模組 / Switch Port',
        n5: '設定 BIOS / BMC（IP、帳號）',
        n6: '安裝 OS 與驅動',
        n7: '套用網路設定（Bond / VLAN）',
        d2: '驗收測試全部通過？',
        f2: '依結果排除問題',
        e: '完成：交付文件給客戶簽收',
      },
    },
    maintenance: {
      title: '主機硬體維修 / 零件更換',
      nodes: {
        s: '開始：收到維修工單（Case / RMA）',
        n1: '核對機器序號、故障零件與新品料號',
        n2: '與客戶確認維護時間窗',
        d1: '主機上有執行中的 VM？',
        n3: '遷移 VM（vMotion），主機進入維護模式',
        n4: '正常關機、拔電源線，戴防靜電手環',
        n5: '拍照記錄原本的插槽位置',
        n6: '依工單拆裝零件，逐一核對插槽號碼',
        n7: '接電開機，進 BIOS / BMC 檢查',
        d2: '容量與零件狀態正確、沒有錯誤訊息？',
        f1: '重新確認插槽、插緊，查 BMC 事件紀錄',
        n8: '退出維護模式，VM 遷回',
        n9: '填寫維修紀錄（舊品 / 新品序號）',
        e: '完成：客戶簽收',
      },
    },
    'vm-migration': {
      title: 'VM 遷移（逐台進行）',
      nodes: {
        s: '開始：列出要遷移的 VM 清單',
        n1: '確認目標主機 / Datastore 容量與網路（Port Group / VLAN）',
        n2: '取清單中的下一台 VM',
        d1: '可以線上遷移（vMotion / Live Migration）？',
        n3: '線上遷移（運算 + 儲存）',
        n4: '與 AP 負責人約停機，關機後冷遷移',
        d2: 'VM 開機後網路與服務正常？',
        f1: '檢查 Port Group、VLAN、IP 與 VMware Tools',
        d3: '清單上還有 VM？',
        n5: '更新 CMDB / 交付文件',
        e: '完成遷移',
      },
    },
    migration: {
      title: '資料搬移流程',
      nodes: {
        s: '開始：確認搬移範圍',
        n1: '計算資料量與搬移時間',
        n2: '與客戶確認停機時間窗',
        d1: '停機時間窗足夠全量搬移？',
        n3: '先線上全量同步，停機時只做增量',
        n4: '停止寫入並做最後同步',
        n5: '驗證資料（筆數 / 校驗碼）',
        d2: '驗證通過？',
        n6: '切換服務到新設備',
        r: '回復舊系統並排查原因',
        e: '完成搬移',
        e2: '延期再執行',
      },
    },
    troubleshoot: {
      title: 'Server 無法上網排查',
      nodes: {
        s: '開始：Server 無法上網',
        d1: '網卡 UP？（ip link）',
        a1: '檢查線材 / 光模組 / Switch Port',
        d2: '有正確的 IP？（ip addr）',
        a2: '檢查 DHCP / 靜態設定 / VLAN',
        d3: 'Ping Gateway 通？',
        a3: '檢查 VLAN、Mask、Gateway',
        d4: 'Ping 8.8.8.8 通？',
        a4: '檢查 Routing / Firewall / NAT',
        d5: 'DNS 正常？（dig）',
        a5: '檢查 resolv.conf 與 DNS Server',
        e: '網路正常，檢查應用程式',
      },
    },
  },
  en: {
    install: {
      title: 'Equipment installation',
      nodes: {
        s: 'Start: equipment delivered',
        n1: 'Unbox and check serials against the packing list',
        n2: 'Rack it at the planned U position',
        n3: 'Power: PDU feeds A and B',
        n4: 'Cable and label per the cabling plan',
        d1: 'All link lights OK?',
        f1: 'Check cable / optic / switch port',
        n5: 'Configure BIOS / BMC (IP, accounts)',
        n6: 'Install OS and drivers',
        n7: 'Apply network config (bond / VLAN)',
        d2: 'All acceptance tests pass?',
        f2: 'Fix issues found',
        e: 'Done: hand over documents for sign-off',
      },
    },
    maintenance: {
      title: 'Hardware maintenance / part replacement',
      nodes: {
        s: 'Start: work order received (case / RMA)',
        n1: 'Check the serial, the faulty part and the new part number',
        n2: 'Agree the maintenance window with the customer',
        d1: 'VMs running on the host?',
        n3: 'Migrate VMs (vMotion), enter maintenance mode',
        n4: 'Shut down, unplug power, wear an ESD strap',
        n5: 'Photograph the original slot layout',
        n6: 'Swap parts per the work order, checking each slot number',
        n7: 'Power on, check BIOS / BMC',
        d2: 'Capacity and part status correct, no errors?',
        f1: 'Reseat, check slot numbers and the BMC event log',
        n8: 'Exit maintenance mode, migrate VMs back',
        n9: 'Fill in the service record (old / new serials)',
        e: 'Done: customer sign-off',
      },
    },
    'vm-migration': {
      title: 'VM migration (one by one)',
      nodes: {
        s: 'Start: list the VMs to migrate',
        n1: 'Check target host / datastore capacity and networks (port group / VLAN)',
        n2: 'Take the next VM on the list',
        d1: 'Can it move live (vMotion / live migration)?',
        n3: 'Migrate live (compute + storage)',
        n4: 'Agree downtime with the app owner, cold-migrate',
        d2: 'VM network and services OK after power-on?',
        f1: 'Check port group, VLAN, IP and VMware Tools',
        d3: 'More VMs on the list?',
        n5: 'Update the CMDB / handover documents',
        e: 'Migration complete',
      },
    },
    migration: {
      title: 'Data migration',
      nodes: {
        s: 'Start: confirm migration scope',
        n1: 'Estimate data size and transfer time',
        n2: 'Agree the downtime window with the customer',
        d1: 'Window long enough for a full copy?',
        n3: 'Full sync online first; only deltas during downtime',
        n4: 'Stop writes and run the final sync',
        n5: 'Verify data (counts / checksums)',
        d2: 'Verification passed?',
        n6: 'Switch services to the new system',
        r: 'Roll back and investigate',
        e: 'Migration complete',
        e2: 'Reschedule',
      },
    },
    troubleshoot: {
      title: 'Server has no network',
      nodes: {
        s: 'Start: server has no network',
        d1: 'NIC up? (ip link)',
        a1: 'Check cable / optic / switch port',
        d2: 'Correct IP? (ip addr)',
        a2: 'Check DHCP / static config / VLAN',
        d3: 'Gateway pings?',
        a3: 'Check VLAN, mask, gateway',
        d4: '8.8.8.8 pings?',
        a4: 'Check routing / firewall / NAT',
        d5: 'DNS works? (dig)',
        a5: 'Check resolv.conf and DNS server',
        e: 'Network OK; check the application',
      },
    },
  },
}

/** Builds a fresh flowchart from a template; `prefix` keeps node ids unique across charts. */
export function flowchartFromTemplate(locale: AppLocale, template: FlowchartTemplateId, id: string): { id: string; title: string; scope: string; nodes: FlowNode[] } {
  const text = TEXT[locale][template]
  return {
    id,
    title: text.title,
    scope: '',
    nodes: WIRING[template].map(([nid, type, next, yes, no]) => ({ id: nid, type, text: text.nodes[nid] ?? nid, next, yes: yes ?? null, no: no ?? null })),
  }
}

export function templateTitle(locale: AppLocale, template: FlowchartTemplateId): string {
  return TEXT[locale][template].title
}

/** Test helper: every node id in the wiring has text in every locale. */
export function templateTextCoverage(): { locale: AppLocale; template: FlowchartTemplateId; missing: string[] }[] {
  return (Object.keys(TEXT) as AppLocale[]).flatMap((locale) =>
    FLOWCHART_TEMPLATES.map((template) => ({ locale, template, missing: WIRING[template].map((r) => r[0]).filter((nid) => !TEXT[locale][template].nodes[nid]) })),
  )
}
