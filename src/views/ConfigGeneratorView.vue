<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Settings2 } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import CopyButton from '@/components/common/CopyButton.vue'
import RichText from '@/components/common/RichText.vue'
import { useProjectStore } from '@/stores/project'
import { isSwitch } from '@/utils/cabling'
import {
  deriveServerConfig,
  deriveSwitchConfig,
  toCiscoLike,
  toEtcHosts,
  toHuawei,
  toIpmitool,
  toNetplan,
  toNmcli,
  type ConfigSource,
} from '@/utils/configgen'
import { downloadText, slugify } from '@/utils/download'
import { isValidIPv4 } from '@/utils/network'

type ServerFormat = 'netplan' | 'nmcli' | 'ipmitool' | 'hosts'
type SwitchFormat = 'cisco' | 'huawei'

const project = useProjectStore()
const { t } = useI18n()

const HOST_TYPES = ['server', 'gpu-server', 'storage']
const servers = computed(() => project.rackItems.filter((i) => HOST_TYPES.includes(i.type)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))
const switches = computed(() => project.rackItems.filter((i) => isSwitch(i)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))

const deviceId = ref<string>(servers.value[0]?.id ?? switches.value[0]?.id ?? '')
const serverFormat = ref<ServerFormat>('netplan')
const switchFormat = ref<SwitchFormat>('cisco')
const mtu = ref(9000)
const switchMtu = ref(9216)
const dns = ref('')
const search = ref('')

watch([servers, switches], () => {
  if (!project.rackItems.some((i) => i.id === deviceId.value)) deviceId.value = servers.value[0]?.id ?? switches.value[0]?.id ?? ''
})

const device = computed(() => project.rackItems.find((i) => i.id === deviceId.value) ?? null)
const deviceIsSwitch = computed(() => isSwitch(device.value ?? undefined))
const source = computed<ConfigSource>(() => ({ rackItems: project.rackItems, cables: project.cables, subnets: project.subnets }))
const serverOpts = computed(() => ({
  mtu: mtu.value,
  dns: dns.value.split(/[,\s]+/).filter(isValidIPv4),
  search: search.value.split(/[,\s]+/).filter((s) => /^[\w.-]+$/.test(s)),
}))

const serverCfg = computed(() => (device.value && !deviceIsSwitch.value ? deriveServerConfig(source.value, device.value.id, serverOpts.value) : null))

function render(id: string, format: ServerFormat | SwitchFormat): string {
  const item = project.rackItems.find((i) => i.id === id)
  if (!item) return ''
  if (isSwitch(item)) {
    const cfg = deriveSwitchConfig(source.value, id, switchMtu.value)
    return cfg ? (format === 'huawei' ? toHuawei(cfg) : toCiscoLike(cfg)) : ''
  }
  if (format === 'hosts') return toEtcHosts(project.rackItems)
  if (format === 'ipmitool') return toIpmitool(source.value, id) ?? `# ${t('configPage.noBmc')}`
  const cfg = deriveServerConfig(source.value, id, serverOpts.value)
  if (!cfg) return ''
  return format === 'nmcli' ? toNmcli(cfg) : toNetplan(cfg)
}

const output = computed(() => (device.value ? render(device.value.id, deviceIsSwitch.value ? switchFormat.value : serverFormat.value) : ''))
const ext = computed(() => (deviceIsSwitch.value ? 'txt' : serverFormat.value === 'netplan' ? 'yaml' : serverFormat.value === 'hosts' ? 'txt' : 'sh'))

function downloadOne(): void {
  if (!device.value) return
  downloadText(`${slugify(device.value.hostname || device.value.name, 'device')}-${deviceIsSwitch.value ? switchFormat.value : serverFormat.value}.${ext.value}`, output.value + '\n', 'text/plain')
}

function downloadAll(): void {
  const sections: string[] = []
  for (const s of servers.value) {
    sections.push(`######## ${s.hostname || s.name} — netplan ########`, render(s.id, 'netplan'), '')
    sections.push(`######## ${s.hostname || s.name} — nmcli ########`, render(s.id, 'nmcli'), '')
    if (isValidIPv4(s.mgmtIp)) sections.push(`######## ${s.hostname || s.name} — BMC ########`, render(s.id, 'ipmitool'), '')
  }
  for (const sw of switches.value) sections.push(`######## ${sw.hostname || sw.name} — ${switchFormat.value} ########`, render(sw.id, switchFormat.value), '')
  sections.push('######## /etc/hosts ########', toEtcHosts(project.rackItems))
  downloadText(`${slugify(project.title, 'project')}-configs.txt`, sections.join('\n') + '\n', 'text/plain')
}
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('configPage.title')" :description="t('configPage.desc')" :icon="Settings2">
      <template #actions>
        <button class="btn px-2 py-1 text-xs" :disabled="!project.rackItems.length" @click="downloadAll"><Download class="size-3.5" /> {{ t('configPage.downloadAll') }}</button>
      </template>
    </PageHeader>

    <p v-if="!servers.length && !switches.length" class="card p-6 text-center text-sm text-muted">{{ t('configPage.empty') }}</p>

    <div v-else class="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside class="card space-y-4 p-4">
        <div>
          <label for="cg-device" class="label">{{ t('configPage.device') }}</label>
          <select id="cg-device" v-model="deviceId" class="field">
            <optgroup v-if="servers.length" :label="t('configPage.servers')">
              <option v-for="s in servers" :key="s.id" :value="s.id">{{ s.name }}{{ s.ip ? ` · ${s.ip}` : '' }}</option>
            </optgroup>
            <optgroup v-if="switches.length" :label="t('configPage.switches')">
              <option v-for="s in switches" :key="s.id" :value="s.id">{{ s.name }}</option>
            </optgroup>
          </select>
        </div>
        <div>
          <span class="label">{{ t('configPage.format') }}</span>
          <div class="flex flex-col gap-1" role="radiogroup">
            <template v-if="deviceIsSwitch">
              <button v-for="f in ['cisco', 'huawei'] as const" :key="f" role="radio" :aria-checked="switchFormat === f" class="rounded-md border px-3 py-1.5 text-left text-sm" :class="switchFormat === f ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-accent/50'" @click="switchFormat = f">
                {{ t(`configPage.formats.${f}`) }}
              </button>
            </template>
            <template v-else>
              <button v-for="f in ['netplan', 'nmcli', 'ipmitool', 'hosts'] as const" :key="f" role="radio" :aria-checked="serverFormat === f" class="rounded-md border px-3 py-1.5 text-left text-sm" :class="serverFormat === f ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-accent/50'" @click="serverFormat = f">
                {{ t(`configPage.formats.${f}`) }}
              </button>
            </template>
          </div>
        </div>
        <div>
          <label for="cg-mtu" class="label normal-case">{{ t('configPage.mtu') }}</label>
          <select v-if="deviceIsSwitch" id="cg-mtu" v-model.number="switchMtu" class="field">
            <option :value="1500">1500</option>
            <option :value="9216">9216 (jumbo)</option>
          </select>
          <select v-else id="cg-mtu" v-model.number="mtu" class="field">
            <option :value="1500">1500</option>
            <option :value="9000">9000 (jumbo)</option>
          </select>
        </div>
        <template v-if="!deviceIsSwitch">
          <div>
            <label for="cg-dns" class="label normal-case">{{ t('configPage.dns') }}</label>
            <input id="cg-dns" v-model="dns" class="field" placeholder="10.10.10.53" spellcheck="false" />
          </div>
          <div>
            <label for="cg-search" class="label normal-case">{{ t('configPage.search') }}</label>
            <input id="cg-search" v-model="search" class="field" placeholder="corp.local" spellcheck="false" />
          </div>
        </template>
      </aside>

      <section class="space-y-3">
        <ul v-if="serverCfg?.warnings.length" class="space-y-1 rounded-lg border border-warn/40 bg-warn-soft px-4 py-2 text-sm text-warn">
          <li v-for="w in serverCfg.warnings" :key="w">⚠ {{ t(`configPage.warnings.${w}`) }}</li>
        </ul>
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-2">
            <span class="font-mono text-sm">{{ device?.hostname || device?.name }} · {{ t(`configPage.formats.${deviceIsSwitch ? switchFormat : serverFormat}`) }}</span>
            <div class="flex gap-2">
              <CopyButton :text="output" :label="t('common.copy')" />
              <button class="btn px-2 py-1 text-xs" @click="downloadOne"><Download class="size-3.5" /> {{ t('configPage.download') }}</button>
            </div>
          </div>
          <pre class="max-h-[36rem] overflow-auto p-4 font-mono text-xs leading-relaxed">{{ output }}</pre>
        </div>
        <p class="text-xs text-muted"><RichText :text="t('configPage.reviewNote')" /></p>
      </section>
    </div>
  </div>
</template>
