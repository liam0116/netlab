<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cable, Download, Eraser, Globe, HardDrive, LayoutTemplate, Monitor, Network, Router, Server, Shield, Trash2 } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import IpInput from '@/components/common/IpInput.vue'
import CidrSelect from '@/components/common/CidrSelect.vue'
import TopologyCanvas from '@/components/lab/TopologyCanvas.vue'
import { DEVICE_TYPES, useTopologyStore } from '@/stores/topology'
import type { DeviceType, Selection, TopoDevice, TopoIssue } from '@/types/topology'
import { macFromIp } from '@/utils/mac'
import { isValidIPv4 } from '@/utils/network'
import { downloadText } from '@/utils/download'

const store = useTopologyStore()
const { t } = useI18n()

const ICONS: Record<DeviceType, Component> = {
  server: Server,
  switch: Network,
  router: Router,
  firewall: Shield,
  storage: HardDrive,
  client: Monitor,
  internet: Globe,
}

const selection = ref<Selection>(null)
const connecting = ref(false)
const connectFrom = ref<string | null>(null)

const selectedDevice = computed(() =>
  selection.value?.kind === 'device' ? store.devices.find((d) => d.id === selection.value!.id) ?? null : null,
)
const selectedLink = computed(() =>
  selection.value?.kind === 'link' ? store.links.find((l) => l.id === selection.value!.id) ?? null : null,
)
const nameOf = (id: string) => store.devices.find((d) => d.id === id)?.name ?? id
const typeOf = (id: string) => store.devices.find((d) => d.id === id)?.type

// --- Issues -----------------------------------------------------------------
const rank = { error: 0, warning: 1, info: 2 } as const
function worst<K>(entries: [K, TopoIssue['level']][]): Map<K, TopoIssue['level']> {
  const map = new Map<K, TopoIssue['level']>()
  for (const [key, level] of entries) {
    const prev = map.get(key)
    if (!prev || rank[level] < rank[prev]) map.set(key, level)
  }
  return map
}
const deviceLevels = computed(() => worst(store.issues.flatMap((i) => i.deviceIds.map((id) => [id, i.level] as [string, TopoIssue['level']]))))
const linkLevels = computed(() =>
  worst(store.issues.filter((i) => i.linkId).map((i) => [i.linkId!, i.level] as [string, TopoIssue['level']])),
)
const errorCount = computed(() => store.issues.filter((i) => i.level === 'error').length)
const warningCount = computed(() => store.issues.filter((i) => i.level === 'warning').length)
const selectedIssues = computed(() =>
  selection.value ? store.issues.filter((i) => (selection.value!.kind === 'device' ? i.deviceIds.includes(selection.value!.id) : i.linkId === selection.value!.id)) : [],
)

function focusIssue(issue: TopoIssue): void {
  selection.value = issue.linkId ? { kind: 'link', id: issue.linkId } : { kind: 'device', id: issue.deviceIds[0]! }
}

// --- Actions ----------------------------------------------------------------
function addDevice(type: DeviceType): void {
  const n = store.devices.length
  const d = store.addDevice(type, 160 + ((n * 150) % 700), 90 + ((Math.floor(n / 5) * 110) % 380))
  selection.value = { kind: 'device', id: d.id }
}

function toggleConnect(): void {
  connecting.value = !connecting.value
  connectFrom.value = null
}

function onDeviceClick(id: string): void {
  if (!connectFrom.value) {
    connectFrom.value = id
    return
  }
  const link = store.addLink(connectFrom.value, id)
  connecting.value = false
  connectFrom.value = null
  if (link) selection.value = { kind: 'link', id: link.id }
}

function deleteSelection(): void {
  if (selectedDevice.value) store.removeDevice(selectedDevice.value.id)
  else if (selectedLink.value) store.removeLink(selectedLink.value.id)
  selection.value = null
}

function clearAll(): void {
  store.clear()
  selection.value = null
}

function loadExample(): void {
  store.loadExample()
  selection.value = null
}

function exportJson(): void {
  downloadText('topology.json', JSON.stringify({ devices: store.devices, links: store.links }, null, 2), 'application/json')
}

function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (event.key === 'Escape') {
    connecting.value = false
    connectFrom.value = null
    selection.value = null
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selection.value) {
    event.preventDefault()
    deleteSelection()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// --- Field helpers ----------------------------------------------------------
function patch(d: TopoDevice, values: Partial<TopoDevice>): void {
  store.updateDevice(d.id, values)
}
function vlanValue(raw: string): number | null {
  const v = raw.trim()
  return v === '' ? null : Number(v)
}
const optionalIp = (v: string) => (v.trim() === '' ? null : isValidIPv4(v) ? null : { key: 'validation.ipFormat' })
const hasIp = (d: TopoDevice) => d.type !== 'internet'
const isL3 = (d: TopoDevice) => d.type === 'router' || d.type === 'firewall'
const isHost = (d: TopoDevice) => d.type === 'server' || d.type === 'storage' || d.type === 'client'
</script>

<template>
  <div class="space-y-4">
    <PageHeader :title="t('topoPage.title')" :description="t('topoPage.desc')" :icon="Network" />

    <!-- Toolbar -->
    <div class="card flex flex-wrap items-center gap-2 p-2">
      <span class="px-1 text-xs text-muted">{{ t('topoPage.add') }}</span>
      <button v-for="type in DEVICE_TYPES" :key="type" class="btn px-2 py-1 text-xs" @click="addDevice(type)">
        <component :is="ICONS[type]" class="size-3.5" />
        {{ t(`topoPage.types.${type}`) }}
      </button>
      <span class="mx-1 h-5 w-px bg-line" />
      <button class="btn px-2 py-1 text-xs" :class="{ 'border-accent bg-accent-soft text-accent': connecting }" @click="toggleConnect">
        <Cable class="size-3.5" /> {{ t('topoPage.connect') }}
      </button>
      <button class="btn px-2 py-1 text-xs" :disabled="!selection" @click="deleteSelection">
        <Trash2 class="size-3.5" /> {{ t('topoPage.delete') }}
      </button>
      <div class="ml-auto flex flex-wrap gap-2">
        <button class="btn px-2 py-1 text-xs" @click="loadExample"><LayoutTemplate class="size-3.5" /> {{ t('topoPage.example') }}</button>
        <button class="btn px-2 py-1 text-xs" @click="exportJson"><Download class="size-3.5" /> {{ t('topoPage.exportJson') }}</button>
        <button class="btn px-2 py-1 text-xs" @click="clearAll"><Eraser class="size-3.5" /> {{ t('topoPage.clear') }}</button>
      </div>
    </div>


    <section class="card relative overflow-hidden">
      <!-- Overlay so the canvas does not shift while connecting -->
      <p
        v-if="connecting"
        class="pointer-events-none absolute inset-x-3 top-3 z-10 rounded-md border border-accent/40 bg-surface/95 px-3 py-2 text-sm text-accent"
      >
        {{ connectFrom ? t('topoPage.connectFrom', { name: nameOf(connectFrom) }) : t('topoPage.connectHint') }}
      </p>
        <TopologyCanvas
          :devices="store.devices"
          :links="store.links"
          :selection="selection"
          :connect-from="connectFrom"
          :connecting="connecting"
          :device-levels="deviceLevels"
          :link-levels="linkLevels"
          @select="selection = $event"
          @move="(id, x, y) => store.updateDevice(id, { x, y })"
          @device-click="onDeviceClick"
        />
    </section>

    <div class="grid gap-4 lg:grid-cols-2">
      <!-- Inspector -->
      <aside class="space-y-4">
        <div class="card space-y-3 p-4">
          <template v-if="selectedDevice">
            <div class="flex items-center gap-2">
              <component :is="ICONS[selectedDevice.type]" class="size-4 text-accent" />
              <span class="text-xs text-muted">{{ t(`topoPage.types.${selectedDevice.type}`) }}</span>
            </div>
            <div>
              <label class="label" for="topo-name">{{ t('topoPage.fields.name') }}</label>
              <input
                id="topo-name"
                class="field"
                :value="selectedDevice.name"
                @input="patch(selectedDevice, { name: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <template v-if="hasIp(selectedDevice)">
              <div class="grid grid-cols-[1fr_7.5rem] gap-2">
                <IpInput
                  :model-value="selectedDevice.ip"
                  :label="t('topoPage.fields.ip')"
                  :validator="optionalIp"
                  :placeholder="t('topoPage.fields.optional')"
                  @update:model-value="patch(selectedDevice, { ip: $event })"
                />
                <CidrSelect
                  :model-value="selectedDevice.cidr"
                  :label="t('topoPage.fields.cidr')"
                  @update:model-value="patch(selectedDevice, { cidr: $event })"
                />
              </div>
              <IpInput
                v-if="isHost(selectedDevice)"
                :model-value="selectedDevice.gateway"
                :label="t('topoPage.fields.gateway')"
                :validator="optionalIp"
                :placeholder="t('topoPage.fields.optional')"
                @update:model-value="patch(selectedDevice, { gateway: $event })"
              />
              <div v-if="selectedDevice.type !== 'switch'" class="grid grid-cols-2 gap-2">
                <div>
                  <label class="label" for="topo-vlan">{{ t('topoPage.fields.vlan') }}</label>
                  <input
                    id="topo-vlan"
                    class="field"
                    type="number"
                    min="1"
                    max="4094"
                    :value="selectedDevice.vlan ?? ''"
                    :placeholder="t('topoPage.fields.optional')"
                    @input="patch(selectedDevice, { vlan: vlanValue(($event.target as HTMLInputElement).value) })"
                  />
                </div>
              </div>
              <div v-if="selectedDevice.type !== 'switch'">
                <label class="label" for="topo-mac">{{ t('topoPage.fields.mac') }}</label>
                <div class="flex gap-2">
                  <input
                    id="topo-mac"
                    class="field"
                    :value="selectedDevice.mac"
                    placeholder="3c:ec:ef:12:34:56"
                    spellcheck="false"
                    @input="patch(selectedDevice, { mac: ($event.target as HTMLInputElement).value })"
                  />
                  <button
                    class="btn shrink-0 px-2 text-xs"
                    :disabled="!isValidIPv4(selectedDevice.ip)"
                    @click="patch(selectedDevice, { mac: macFromIp(selectedDevice.ip) })"
                  >
                    {{ t('topoPage.fields.autoMac') }}
                  </button>
                </div>
              </div>
              <div v-if="isL3(selectedDevice)">
                <label class="label" for="topo-if">{{ t('topoPage.fields.interfaces') }}</label>
                <textarea
                  id="topo-if"
                  class="field min-h-20"
                  :value="selectedDevice.interfaces.join('\n')"
                  placeholder="10.10.30.1/24"
                  spellcheck="false"
                  @input="
                    patch(selectedDevice, {
                      interfaces: ($event.target as HTMLTextAreaElement).value
                        .split('\n')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  "
                />
              </div>
            </template>
          </template>

          <template v-else-if="selectedLink">
            <div class="text-xs text-muted">{{ t('topoPage.link') }}</div>
            <div class="font-medium">{{ nameOf(selectedLink.a) }} ↔ {{ nameOf(selectedLink.b) }}</div>
            <div v-if="typeOf(selectedLink.a) === 'switch' || typeOf(selectedLink.b) === 'switch'">
              <label class="label" for="topo-port-vlan">{{ t('topoPage.fields.portVlan') }}</label>
              <input
                id="topo-port-vlan"
                class="field"
                type="number"
                min="1"
                max="4094"
                :value="selectedLink.vlan ?? ''"
                @input="store.updateLink(selectedLink.id, { vlan: vlanValue(($event.target as HTMLInputElement).value) })"
              />
              <p class="mt-1 text-xs text-muted">{{ t('topoPage.fields.portVlanHint') }}</p>
            </div>
          </template>

          <p v-else class="text-sm text-muted">{{ t('topoPage.selectHint') }}</p>

          <ul v-if="selectedIssues.length" class="space-y-1.5 border-t border-line pt-3 text-xs">
            <li v-for="(issue, i) in selectedIssues" :key="i" :class="issue.level === 'error' ? 'text-err' : issue.level === 'warning' ? 'text-warn' : 'text-muted'">
              {{ t(`topoPage.issues.${issue.code}`, issue.params) }}
            </li>
          </ul>
        </div>
      </aside>

    <!-- All issues -->
    <section class="card self-start p-4">
      <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-semibold">{{ t('topoPage.issuesTitle') }}</h2>
        <span class="text-xs text-muted">{{ t('topoPage.counts', { errors: errorCount, warnings: warningCount }) }}</span>
      </div>
      <p v-if="store.issues.length === 0" class="text-sm text-ok">{{ t('topoPage.noIssues') }}</p>
      <ul v-else class="space-y-1">
        <li v-for="(issue, i) in store.issues" :key="i">
          <button class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2" @click="focusIssue(issue)">
            <span
              class="mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-semibold"
              :class="issue.level === 'error' ? 'bg-err-soft text-err' : issue.level === 'warning' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted'"
            >
              {{ t(`topoPage.levels.${issue.level}`) }}
            </span>
            <span>{{ t(`topoPage.issues.${issue.code}`, issue.params) }}</span>
          </button>
        </li>
      </ul>
    </section>
    </div>
  </div>
</template>
