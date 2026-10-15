import { describe, expect, it } from 'vitest'
import { demoProject } from './demoProject'
import { checkRack, rackTotals } from '@/utils/rack'
import { checkCabling } from '@/utils/cabling'
import { checkFlows } from '@/utils/flows'
import { checkFlowchart } from '@/utils/flowchart'
import { planNetwork } from '@/utils/planner'
import { deriveServerConfig, deriveSwitchConfig } from '@/utils/configgen'
import { ipPlanUsage } from '@/utils/ipPlan'
import { parseProjectFile, serializeProject } from '@/utils/projectFile'

describe('demo project', () => {
  for (const locale of ['zh-TW', 'en'] as const) {
    it(`${locale}: every checker comes back clean`, () => {
      const p = demoProject(locale)
      const plan = planNetwork(p.planner.requirements, p.planner.options)
      expect(plan.ok).toBe(true)
      for (const r of p.racks) expect(checkRack(r, p.rackItems), r.name).toEqual([])
      expect(checkCabling(p.rackItems, p.cables)).toEqual([])
      expect(checkFlows(p.services, p.flows)).toEqual([])
      for (const fc of p.flowcharts) expect(checkFlowchart(fc), fc.title).toEqual([])
    })
  }

  it('every IP sits in a planned subnet and power fits the PDUs', () => {
    const p = demoProject('en')
    const plan = planNetwork(p.planner.requirements, p.planner.options)
    expect(ipPlanUsage(plan.subnets, p.rackItems).problems).toBe(0)
    const src = { rackItems: p.rackItems, cables: p.cables, subnets: plan.subnets }
    for (const id of ['esx01', 'esx02', 'esx03', 'esx04']) {
      const cfg = deriveServerConfig(src, id, { mtu: 9000, dns: [], search: [] })!
      expect(cfg.warnings, id).toEqual([])
      // FC HBAs are not network interfaces; ESXi Mgmt on lag1.20, vMotion on lag1.30.
      expect(cfg.interfaces.map((i) => i.name).sort(), id).toEqual(['lag1', 'lag1.20', 'lag1.30', 'vmnic0', 'vmnic1'])
    }
    const leaf = deriveSwitchConfig(src, 'leaf01', 9216)!
    expect(leaf.portChannels.map((pc) => pc.mlag)).toEqual([true, true, true, true, true])
    const r1 = rackTotals(p.racks[0]!, p.rackItems)
    expect(Math.max(r1.failoverA, r1.failoverB)).toBeLessThanOrEqual(p.racks[0]!.pduCapacityW)
  })

  it('round-trips through the project file', () => {
    const p = demoProject('zh-TW')
    const parsed = parseProjectFile(serializeProject(p))
    expect(parsed.ok && parsed.data).toEqual(p)
  })
})
