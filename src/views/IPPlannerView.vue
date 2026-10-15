<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Check, ClipboardCopy, Download, FileJson, Map as MapIcon, MapPinned, Network, Plus, Trash2 } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import LearnNote from '@/components/common/LearnNote.vue'
import RichText from '@/components/common/RichText.vue'
import { dgxPreset, useProjectPlanStore, useToolPlannerStore, vlsmPreset } from '@/stores/planner'
import { useProjectStore } from '@/stores/project'
import StatusBanner from '@/components/common/StatusBanner.vue'
import { ipPlanUsage, type IpUse } from '@/utils/ipPlan'
import { useTopologyStore } from '@/stores/topology'
import { useSettingsStore } from '@/stores/settings'
import { downloadText, slugify } from '@/utils/download'
import { getUsableHosts, hostsToCidr, ipToInt } from '@/utils/network'
import { planToCsv, planToJson, planToTopology, planToTsv, requiredAddresses, type PlannedSubnet } from '@/utils/planner'

/**
 * tool:    Tools → IP Planner, a stand-alone calculator with its own saved plan.
 * project: Project → IP Plan, the current project's plan, cross-checked against the rack devices.
 */
const props = defineProps<{ mode: 'tool' | 'project' }>()
const isProject = props.mode === 'project'
const store = isProject ? useProjectPlanStore() : useToolPlannerStore()
const project = useProjectStore()
const topology = useTopologyStore()
const settings = useSettingsStore()
const router = useRouter()
const { t } = useI18n()

const result = computed(() => store.result)
const issuesFor = (id: string) => result.value.issues.filter((i) => i.requirementId === id)
const generalIssues = computed(() => result.value.issues.filter((i) => !i.requirementId))

/** Live CIDR suggestion next to each requirement row. */
function suggested(hosts: number): string {
  if (!Number.isInteger(hosts) || hosts < 1) return '—'
  const cidr = hostsToCidr(requiredAddresses(hosts, store.options.growthPercent, store.options.reserveGateway))
  return cidr === null ? '—' : `/${cidr}`
}

function why(s: PlannedSubnet): string {
  const extra = `${store.options.growthPercent > 0 ? t('plannerPage.whyGrowth', { growth: store.options.growthPercent }) : ''}${store.options.reserveGateway ? t('plannerPage.whyGateway') : ''}`
  return t('plannerPage.why', { hosts: s.requestedHosts, extra, needed: s.requiredAddresses, cidr: s.cidr, bits: s.hostBits, usable: getUsableHosts(s.cidr) })
}

// Distinct hues for the utilization bar, cycled.
const COLORS = ['bg-net', 'bg-host', 'bg-ok', 'bg-accent', 'bg-warn', 'bg-err']
const color = (i: number) => COLORS[i % COLORS.length]!

/** Places each subnet at its real offset inside the base network (VLAN-aligned plans are not contiguous). */
function segmentStyle(s: PlannedSubnet): Record<string, string> {
  const base = result.value.base
  if (!base) return {}
  const offset = ipToInt(s.network) - ipToInt(base.network)
  return {
    left: `${(offset / base.totalAddresses) * 100}%`,
    width: `max(3px, ${(s.totalAddresses / base.totalAddresses) * 100}%)`,
  }
}

// --- Export -------------------------------------------------------------------
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined
async function copyTable(): Promise<void> {
  const text = planToTsv(result.value.subnets)
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = false), 1500)
}
const fileBase = computed(() => slugify(isProject ? project.title : store.project))

// --- Project mode: which devices use each subnet --------------------------------
const usage = computed(() => (isProject ? ipPlanUsage(result.value.subnets, project.rackItems) : null))
/** "Data IP", "BMC", or what a further address is for ("vMotion", "Storage" …). */
const useLabel = (u: IpUse) => (u.field === 'extra' ? t(`projectCommon.purposes.${u.purpose ?? 'other'}`) : t(`plannerPage.inProject.roles.${u.field}`))

// --- Tool mode: copy the scratch plan into the current project -------------------
const confirmApply = ref(false)
const appliedTo = ref<string | null>(null)
let applyTimer: ReturnType<typeof setTimeout> | undefined
function applyToProject(): void {
  if (!confirmApply.value) {
    confirmApply.value = true
    clearTimeout(applyTimer)
    applyTimer = setTimeout(() => (confirmApply.value = false), 4000)
    return
  }
  confirmApply.value = false
  useProjectPlanStore().apply(store.snapshot())
  appliedTo.value = project.title
}
const exportCsv = () => downloadText(`${fileBase.value}.csv`, planToCsv(result.value.subnets), 'text/csv', true)
const exportJson = () => downloadText(`${fileBase.value}.json`, planToJson(store.project, store.options, result.value), 'application/json')

// Two-step confirm instead of a browser dialog, since it replaces the current topology.
const confirmSim = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | undefined
function sendToSimulator(): void {
  if (!confirmSim.value) {
    confirmSim.value = true
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => (confirmSim.value = false), 4000)
    return
  }
  const topo = planToTopology(store.project, result.value.subnets)
  topology.devices = topo.devices
  topology.links = topo.links
  confirmSim.value = false
  void router.push('/lab/network')
}
onBeforeUnmount(() => {
  clearTimeout(copyTimer)
  clearTimeout(confirmTimer)
  clearTimeout(applyTimer)
})

function numberOrNull(raw: string): number | null {
  return raw.trim() === '' ? null : Number(raw)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      v-if="isProject"
      :title="t('plannerPage.inProject.title')"
      :description="t('plannerPage.inProject.desc', { name: project.title })"
      :icon="MapPinned"
    />
    <PageHeader v-else :title="t('plannerPage.title')" :description="t('plannerPage.desc')" :icon="MapIcon" />

    <!-- Project mode: what this plan feeds -->
    <nav v-if="isProject" class="flex flex-wrap items-center gap-2 text-xs text-muted">
      {{ t('plannerPage.inProject.usedBy') }}
      <RouterLink v-for="(to, key) in { rack: '/project/rack', config: '/project/config', report: '/project/report' }" :key="key" :to="to" class="kbd hover:text-accent">
        {{ t(`plannerPage.inProject.links.${key}`) }}
      </RouterLink>
    </nav>

    <!-- Tool mode: stand-alone, with a way to hand the plan to the project -->
    <div v-else class="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm">
      <p class="min-w-60 flex-1 text-muted">{{ t('plannerPage.tool.note') }}</p>
      <button class="btn px-2 py-1 text-xs" :class="{ 'border-warn bg-warn-soft text-warn hover:text-warn': confirmApply }" :disabled="!result.subnets.length" @click="applyToProject">
        <MapPinned class="size-3.5" /> {{ confirmApply ? t('plannerPage.tool.applyConfirm') : t('plannerPage.tool.apply') }}
      </button>
    </div>
    <StatusBanner v-if="appliedTo !== null" variant="ok" :title="t('plannerPage.tool.applied', { name: appliedTo })">
      <RouterLink to="/project/ip-plan" class="btn mt-1 px-2 py-1 text-xs"><ArrowRight class="size-3.5" /> {{ t('plannerPage.tool.openProject') }}</RouterLink>
    </StatusBanner>

    <!-- Settings -->
    <section class="card space-y-4 p-4">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div v-if="!isProject">
          <label for="pl-project" class="label">{{ t('plannerPage.project') }}</label>
          <input id="pl-project" v-model="store.project" class="field" :placeholder="t('plannerPage.projectPlaceholder')" maxlength="60" />
        </div>
        <div>
          <label for="pl-base" class="label">{{ t('plannerPage.base') }}</label>
          <input id="pl-base" v-model.trim="store.options.base" class="field" placeholder="10.10.0.0/16" spellcheck="false" />
        </div>
        <div>
          <label for="pl-gw" class="label">{{ t('plannerPage.gateway') }}</label>
          <select id="pl-gw" v-model="store.options.gateway" class="field">
            <option value="first">{{ t('plannerPage.gateways.first') }}</option>
            <option value="last">{{ t('plannerPage.gateways.last') }}</option>
          </select>
        </div>
        <div class="grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <label for="pl-growth" class="label">{{ t('plannerPage.growth') }}</label>
            <select id="pl-growth" v-model.number="store.options.growthPercent" class="field">
              <option v-for="g in [0, 10, 20, 30, 50, 100]" :key="g" :value="g">{{ g }}%</option>
            </select>
          </div>
          <label class="flex h-[38px] items-center gap-2 text-xs text-muted">
            <input v-model="store.options.reserveGateway" type="checkbox" class="accent-[var(--accent)]" />
            {{ t('plannerPage.reserveGateway') }}
          </label>
        </div>
      </div>

      <div>
        <div class="label">{{ t('plannerPage.strategy') }}</div>
        <div class="grid gap-2 sm:grid-cols-2" role="radiogroup">
          <button
            v-for="s in ['vlsm', 'vlan-octet'] as const"
            :key="s"
            role="radio"
            :aria-checked="store.options.strategy === s"
            class="rounded-md border px-3 py-2 text-left text-sm transition-colors"
            :class="store.options.strategy === s ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'"
            @click="store.options.strategy = s"
          >
            <div class="font-medium" :class="store.options.strategy === s ? 'text-accent' : ''">{{ t(`plannerPage.strategies.${s}`) }}</div>
            <div class="mt-0.5 text-xs text-muted">{{ t(`plannerPage.strategyHint.${s}`) }}</div>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
        {{ t('plannerPage.presets') }}
        <button class="kbd hover:text-accent" @click="store.apply(dgxPreset())">{{ t('plannerPage.presetDgx') }}</button>
        <button class="kbd hover:text-accent" @click="store.apply(vlsmPreset())">{{ t('plannerPage.presetVlsm') }}</button>
      </div>
    </section>

    <!-- Requirements -->
    <section class="card overflow-hidden">
      <div class="border-b border-line px-4 py-3 font-semibold">{{ t('plannerPage.requirements') }}</div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">{{ t('plannerPage.colName') }}</th>
              <th class="w-28 px-2 py-2 font-medium">{{ t('plannerPage.colVlan') }}</th>
              <th class="w-36 px-2 py-2 font-medium">{{ t('plannerPage.colHosts') }}</th>
              <th class="w-24 px-2 py-2 font-medium">{{ t('plannerPage.colSuggested') }}</th>
              <th class="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <template v-for="r in store.requirements" :key="r.id">
              <tr class="border-t border-line">
                <td class="px-4 py-1.5">
                  <input v-model="r.name" class="field py-1.5" maxlength="40" :aria-label="t('plannerPage.colName')" />
                </td>
                <td class="px-2 py-1.5">
                  <input
                    :value="r.vlan ?? ''"
                    type="number"
                    min="1"
                    max="4094"
                    class="field py-1.5"
                    :aria-label="t('plannerPage.colVlan')"
                    @input="r.vlan = numberOrNull(($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="px-2 py-1.5">
                  <input v-model.number="r.hosts" type="number" min="1" class="field py-1.5" :aria-label="t('plannerPage.colHosts')" />
                </td>
                <td class="px-2 py-1.5 font-mono text-accent">{{ suggested(r.hosts) }}</td>
                <td class="px-2 py-1.5 text-right">
                  <button class="rounded p-1.5 text-muted hover:text-err" :title="t('plannerPage.remove')" @click="store.removeRequirement(r.id)">
                    <Trash2 class="size-4" />
                  </button>
                </td>
              </tr>
              <tr v-for="(issue, i) in issuesFor(r.id)" :key="`${r.id}-${i}`">
                <td colspan="5" class="px-4 pb-2 text-xs" :class="issue.level === 'error' ? 'text-err' : 'text-warn'">
                  {{ t(`plannerPage.issues.${issue.code}`, issue.params) }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div class="border-t border-line p-3">
        <button class="btn px-2 py-1 text-xs" @click="store.addRequirement()"><Plus class="size-3.5" /> {{ t('plannerPage.addRow') }}</button>
      </div>
    </section>

    <ul v-if="generalIssues.length" class="space-y-1 text-sm">
      <li v-for="(issue, i) in generalIssues" :key="i" :class="issue.level === 'error' ? 'text-err' : 'text-warn'">
        {{ t(`plannerPage.issues.${issue.code}`, issue.params) }}
      </li>
    </ul>

    <!-- Result -->
    <section class="card overflow-hidden">
      <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 class="mr-auto font-semibold">
          {{ t('plannerPage.result') }}
          <span v-if="result.base" class="ml-1 font-mono text-sm font-normal text-muted">{{ result.base.network }}/{{ result.base.cidr }}</span>
        </h2>
        <template v-if="result.subnets.length">
          <button class="btn px-2 py-1 text-xs" @click="copyTable">
            <Check v-if="copied" class="size-3.5 text-ok" />
            <ClipboardCopy v-else class="size-3.5" />
            {{ copied ? t('common.copied') : t('plannerPage.copy') }}
          </button>
          <button class="btn px-2 py-1 text-xs" @click="exportCsv"><Download class="size-3.5" /> {{ t('plannerPage.exportCsv') }}</button>
          <button class="btn px-2 py-1 text-xs" @click="exportJson"><FileJson class="size-3.5" /> {{ t('plannerPage.exportJson') }}</button>
          <button
            class="btn px-2 py-1 text-xs"
            :class="{ 'border-warn bg-warn-soft text-warn hover:text-warn': confirmSim }"
            @click="sendToSimulator"
          >
            <Network class="size-3.5" /> {{ confirmSim ? t('plannerPage.toSimulatorConfirm') : t('plannerPage.toSimulator') }}
          </button>
        </template>
      </div>

      <p v-if="!result.subnets.length" class="p-6 text-center text-sm text-muted">{{ t('plannerPage.empty') }}</p>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full font-mono text-xs">
            <thead class="bg-surface-2 text-left font-sans text-muted">
              <tr>
                <th class="px-3 py-2 font-medium">{{ t('plannerPage.cols.name') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('plannerPage.cols.vlan') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('plannerPage.cols.network') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('plannerPage.cols.mask') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('plannerPage.cols.gateway') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('plannerPage.cols.first') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('plannerPage.cols.last') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('plannerPage.cols.broadcast') }}</th>
                <th class="px-3 py-2 text-right font-medium">{{ t('plannerPage.cols.total') }}</th>
                <th class="px-3 py-2 text-right font-medium">{{ t('plannerPage.cols.available') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(s, i) in result.subnets" :key="s.requirementId">
                <tr class="border-t border-line">
                  <td class="px-3 py-2 font-sans font-medium whitespace-nowrap">
                    <span class="mr-1.5 inline-block size-2 rounded-full" :class="color(i)" />{{ s.name }}
                  </td>
                  <td class="px-3 py-2">{{ s.vlan ?? '—' }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    <RouterLink
                      :to="{ path: '/tools/subnet', query: { ip: s.network, cidr: String(s.cidr) } }"
                      class="text-accent hover:underline"
                      :title="t('plannerPage.openSubnet')"
                    >
                      {{ s.network }}/{{ s.cidr }}
                    </RouterLink>
                  </td>
                  <td class="px-3 py-2">{{ s.subnetMask }}</td>
                  <td class="px-3 py-2 text-ok">{{ s.gateway }}</td>
                  <td class="px-3 py-2">{{ s.firstIp }}</td>
                  <td class="px-3 py-2">{{ s.lastIp }}</td>
                  <td class="px-3 py-2 text-host">{{ s.broadcast }}</td>
                  <td class="px-3 py-2 text-right">{{ s.totalHosts.toLocaleString() }}</td>
                  <td class="px-3 py-2 text-right whitespace-nowrap">
                    {{ s.availableHosts.toLocaleString() }}
                    <span class="font-sans text-muted">· {{ t('plannerPage.spare', { spare: s.spare.toLocaleString() }) }}</span>
                  </td>
                </tr>
                <tr v-if="settings.mode === 'learning'">
                  <td colspan="10" class="px-3 pb-2 font-sans text-[11px] text-muted">↳ {{ why(s) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div v-if="result.base" class="space-y-3 border-t border-line p-4">
          <div class="relative h-4 overflow-hidden rounded bg-surface-2" role="img" :aria-label="`${result.utilization}%`">
            <div
              v-for="(s, i) in result.subnets"
              :key="s.requirementId"
              class="absolute inset-y-0"
              :class="color(i)"
              :style="segmentStyle(s)"
              :title="`${s.name} ${s.network}/${s.cidr}`"
            />
          </div>
          <p class="text-xs text-muted">
            {{ t('plannerPage.utilization', { used: result.usedAddresses.toLocaleString(), total: result.base.totalAddresses.toLocaleString(), percent: result.utilization }) }}
          </p>
          <div v-if="store.options.strategy === 'vlsm'">
            <div class="label">{{ t('plannerPage.free') }}</div>
            <div class="flex flex-wrap gap-1.5 font-mono text-xs">
              <span v-for="f in result.free" :key="f.network" class="rounded border border-line px-2 py-0.5 text-muted">{{ f.network }}/{{ f.cidr }}</span>
              <span v-if="!result.free.length" class="text-muted">{{ t('plannerPage.noFree') }}</span>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- Project mode: device IP map -->
    <section v-if="usage" class="card overflow-hidden">
      <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 class="mr-auto font-semibold">{{ t('plannerPage.inProject.devices') }}</h2>
        <span v-if="usage.problems" class="rounded-full bg-err-soft px-2 py-0.5 text-xs text-err">{{ t('plannerPage.inProject.problems', { count: usage.problems }) }}</span>
        <span v-else-if="project.rackItems.length" class="text-xs text-ok">✓ {{ t('plannerPage.inProject.allGood') }}</span>
        <RouterLink to="/project/rack" class="btn px-2 py-1 text-xs">{{ t('plannerPage.inProject.editInRack') }}</RouterLink>
      </div>
      <p class="border-b border-line px-4 py-2 text-xs text-muted">{{ t('plannerPage.inProject.devicesHint') }}</p>
      <div class="divide-y divide-line">
        <div v-for="(s, i) in usage.subnets" :key="s.subnet.requirementId" class="px-4 py-3">
          <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span class="font-medium"><span class="mr-1.5 inline-block size-2 rounded-full" :class="color(i)" />{{ s.subnet.name }}</span>
            <span class="font-mono text-xs text-muted">VLAN {{ s.subnet.vlan ?? '—' }} · {{ s.subnet.network }}/{{ s.subnet.cidr }} · GW {{ s.subnet.gateway }}</span>
            <span class="text-xs text-muted">{{ t('plannerPage.inProject.used', { count: s.uses.length }) }} / {{ s.subnet.availableHosts }}</span>
            <span class="ml-auto text-xs">
              {{ t('plannerPage.inProject.nextFree') }}:
              <code class="font-mono text-ok">{{ s.nextFree ?? t('plannerPage.inProject.full') }}</code>
            </span>
          </div>
          <p v-if="!s.uses.length" class="text-xs text-muted">{{ t('plannerPage.inProject.noDevices') }}</p>
          <ul v-else class="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
            <li v-for="u in s.uses" :key="u.key" class="flex flex-wrap items-center gap-2 rounded border px-2 py-1 text-xs" :class="u.issue ? 'border-err/50 bg-err-soft' : 'border-line'">
              <span class="font-medium">{{ u.name }}</span>
              <code class="font-mono">{{ u.address }}</code>
              <span class="text-muted">{{ u.isGateway && !u.issue ? t('plannerPage.inProject.roles.gateway') : useLabel(u) }}</span>
              <span v-if="u.issue" class="w-full text-err">{{ t(`plannerPage.inProject.issues.${u.issue}`) }}</span>
            </li>
          </ul>
        </div>
      </div>
      <div v-for="list in (['outside', 'invalid'] as const)" :key="list">
        <div v-if="usage[list].length" class="border-t border-line bg-err-soft/40 px-4 py-3">
          <div class="mb-2 text-sm font-medium text-err">{{ t(`plannerPage.inProject.${list}`) }}</div>
          <ul class="flex flex-wrap gap-2 text-xs">
            <li v-for="u in usage[list]" :key="u.key" class="rounded border border-err/50 px-2 py-1">
              <span class="font-medium">{{ u.name }}</span> <code class="font-mono">{{ u.address }}</code>
              <span class="text-muted">· {{ useLabel(u) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <LearnNote :title="t('plannerPage.noteTitle')"><RichText :text="t('plannerPage.note')" /></LearnNote>
  </div>
</template>
