<script setup lang="ts">
/**
 * Everything an installer fills in for one rack device: identity, position and power, IP addresses
 * (primary, BMC and further networks) and the port list with MAC addresses and what each port is cabled to.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, X } from 'lucide-vue-next'
import NumberInput from '@/components/common/NumberInput.vue'
import { useConfirm } from '@/composables/useConfirm'
import { deviceGuide } from '@/i18n/content'
import type { AppLocale } from '@/i18n'
import { useProjectStore } from '@/stores/project'
import type { AddressPurpose, RackItem } from '@/types/project'
import { MGMT_PORT } from '@/utils/configgen'
import { normalizeMac } from '@/utils/mac'
import { isValidIPv4 } from '@/utils/network'
import { ITEM_LIMITS, RACK_TEMPLATES } from '@/utils/rack'

const props = defineProps<{ itemId: string }>()
const emit = defineEmits<{ removed: [] }>()

const project = useProjectStore()
const { t, locale } = useI18n()
const { armed, confirm } = useConfirm()

const item = computed(() => project.rackItems.find((i) => i.id === props.itemId)!)
const rack = computed(() => project.racks.find((r) => r.id === item.value.rackId))

function patch<K extends keyof RackItem>(key: K, value: RackItem[K]): void {
  project.updateItem(item.value.id, { [key]: value } as Partial<RackItem>)
}
function removeDevice(): void {
  if (!confirm('item')) return
  project.removeItem(item.value.id)
  emit('removed')
}

// --- Identity ----------------------------------------------------------------------------
const identityFields = [
  ['name', 'col-span-2'],
  ['hostname', ''],
  ['serial', ''],
  ['model', 'col-span-2'],
  ['assetTag', ''],
  ['os', ''],
] as const

// --- Position & power ----------------------------------------------------------------------
const numberFields = ['uPosition', 'uHeight', 'powerW', 'weightKg', 'psus'] as const
/** A device must stay inside its rack: U position and height limit each other. */
function itemLimits(f: (typeof numberFields)[number]) {
  const r = rack.value
  if (!r) return ITEM_LIMITS[f]
  if (f === 'uPosition') return { ...ITEM_LIMITS.uPosition, max: Math.max(1, r.heightU - item.value.uHeight + 1) }
  if (f === 'uHeight') return { ...ITEM_LIMITS.uHeight, max: Math.max(1, Math.min(ITEM_LIMITS.uHeight.max, r.heightU - item.value.uPosition + 1)) }
  return ITEM_LIMITS[f]
}

// --- Addresses ------------------------------------------------------------------------------
const PURPOSES: AddressPurpose[] = ['vmotion', 'storage', 'cluster', 'backup', 'service', 'mgmt', 'other']
const badIp = (v: string) => v.trim() !== '' && !isValidIPv4(v.trim())

/** Cables on this device: port → "leaf01 Eth1/1 (C-003)", and the bonds they form. */
const links = computed(() => {
  const map = new Map<string, { peer: string; label: string; bond: string }>()
  const name = (id: string) => project.rackItems.find((i) => i.id === id)?.name ?? '?'
  for (const c of project.cables) {
    if (c.aItemId === item.value.id) map.set(c.aPort, { peer: `${name(c.bItemId)} ${c.bPort}`, label: c.label, bond: c.bond.trim() })
    if (c.bItemId === item.value.id) map.set(c.bPort, { peer: `${name(c.aItemId)} ${c.aPort}`, label: c.label, bond: c.bond.trim() })
  }
  return map
})
/** Where an extra address can live: bonds from the cabling first, then the data ports. */
const ifaceChoices = computed(() => {
  const bonds = [...new Set([...links.value.values()].map((l) => l.bond).filter(Boolean))].sort()
  const ports = item.value.ports.map((p) => p.name).filter((n) => !MGMT_PORT.test(n))
  return [...bonds, ...ports]
})

const vlanErrors = ref<Record<string, boolean>>({})
function setVlan(addressId: string, text: string): void {
  const v = text.trim()
  const n = Number(v)
  const ok = v === '' || (Number.isInteger(n) && n >= 1 && n <= 4094)
  vlanErrors.value = { ...vlanErrors.value, [addressId]: !ok }
  if (ok) project.updateAddress(item.value.id, addressId, { vlan: v === '' ? null : n })
}

// --- Ports -----------------------------------------------------------------------------------
const SPEEDS = [1, 10, 25, 40, 50, 100, 200, 400, 800, 8, 16, 32, 64, 12, 24]
const speedChoices = (current: number) => [...new Set([...SPEEDS, current])].sort((a, b) => a - b)
const portErrors = ref<Record<number, 'empty' | 'duplicate' | 'mac' | null>>({})

/** Port names are committed on change (not per keystroke), because a rename also renames the cables. */
function renamePort(index: number, event: Event): void {
  const input = event.target as HTMLInputElement
  const name = input.value.trim()
  const clash = item.value.ports.some((p, i) => i !== index && p.name === name)
  if (!name || clash) {
    portErrors.value = { ...portErrors.value, [index]: name ? 'duplicate' : 'empty' }
    input.value = item.value.ports[index]!.name
    return
  }
  portErrors.value = { ...portErrors.value, [index]: null }
  project.updatePort(item.value.id, index, { name: name.slice(0, 40) })
}

function setMac(index: number, event: Event): void {
  const input = event.target as HTMLInputElement
  const text = input.value.trim()
  if (text === '') {
    portErrors.value = { ...portErrors.value, [index]: null }
    project.updatePort(item.value.id, index, { mac: undefined })
    return
  }
  const mac = normalizeMac(text)
  if (!mac) {
    portErrors.value = { ...portErrors.value, [index]: 'mac' }
    return
  }
  portErrors.value = { ...portErrors.value, [index]: null }
  input.value = mac
  project.updatePort(item.value.id, index, { mac })
}

/** A port with a cable needs a second click: the cable is removed with it. */
function removePort(index: number): void {
  const port = item.value.ports[index]
  if (!port) return
  if (links.value.has(port.name) && !confirm(`port-${index}`)) return
  portErrors.value = {}
  project.removePort(item.value.id, index)
}

// --- Beginner explanation of the device type -------------------------------------------------
const guide = computed(() => deviceGuide[locale.value as AppLocale].devices)
const template = computed(() => {
  const it = item.value
  const key = Object.keys(RACK_TEMPLATES).find((k) => RACK_TEMPLATES[k]!.model === it.model) ?? Object.keys(RACK_TEMPLATES).find((k) => RACK_TEMPLATES[k]!.type === it.type)
  return key ? { key, text: guide.value[key]! } : null
})
</script>

<template>
  <section class="card space-y-4 p-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="min-w-0 truncate font-semibold">{{ t('rackPage.device') }} · {{ item.name }}</h2>
      <button class="btn shrink-0 px-2 py-1 text-xs" :class="{ 'border-err bg-err-soft text-err': armed === 'item' }" @click="removeDevice">
        <Trash2 class="size-3.5" /> {{ armed === 'item' ? t('projectCommon.confirmAgain') : t('rackPage.removeDevice') }}
      </button>
    </div>

    <!-- Identity -->
    <fieldset class="space-y-2">
      <legend class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{{ t('rackPage.deviceSections.identity') }}</legend>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="[f, span] in identityFields" :key="f" :class="span">
          <label :for="`ri-${f}`" class="label normal-case">{{ t(`rackPage.deviceFields.${f}`) }}</label>
          <input :id="`ri-${f}`" class="field py-1.5" :value="item[f]" maxlength="120" spellcheck="false" :placeholder="f === 'os' ? 'ESXi 8.0 U3' : ''" @input="patch(f, ($event.target as HTMLInputElement).value)" />
        </div>
      </div>
    </fieldset>

    <!-- Position & power -->
    <fieldset class="space-y-2">
      <legend class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{{ t('rackPage.deviceSections.position') }}</legend>
      <div class="grid grid-cols-2 gap-2">
        <NumberInput
          v-for="f in numberFields"
          :id="`ri-${f}`"
          :key="f"
          :model-value="item[f]"
          :label="t(`rackPage.deviceFields.${f}`)"
          v-bind="itemLimits(f)"
          @update:model-value="(v) => patch(f, v)"
        />
      </div>
    </fieldset>

    <!-- Addresses -->
    <fieldset class="space-y-2">
      <legend class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{{ t('rackPage.deviceSections.addresses') }}</legend>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="f in ['ip', 'mgmtIp'] as const" :key="f">
          <label :for="`ri-${f}`" class="label normal-case">{{ t(`rackPage.deviceFields.${f}`) }}</label>
          <input
            :id="`ri-${f}`"
            class="field py-1.5 font-mono"
            :class="{ 'field-invalid': badIp(item[f]) }"
            :value="item[f]"
            maxlength="45"
            spellcheck="false"
            inputmode="decimal"
            :placeholder="f === 'ip' ? '10.10.20.11' : '10.10.10.21'"
            @input="patch(f, ($event.target as HTMLInputElement).value.trim())"
          />
          <p v-if="badIp(item[f])" class="mt-1 text-xs text-err">{{ t('rackPage.deviceErrors.ip') }}</p>
        </div>
      </div>
      <p class="text-xs text-muted">{{ t('rackPage.addressHint') }}</p>

      <ul v-if="item.addresses.length" class="space-y-2">
        <li v-for="a in item.addresses" :key="a.id" class="space-y-1.5 rounded-md border border-line p-2">
          <div class="flex gap-1.5">
            <select
              class="field w-44 shrink-0 py-1 text-xs"
              :value="a.purpose"
              :aria-label="t('rackPage.addressCols.purpose')"
              @change="project.updateAddress(item.id, a.id, { purpose: ($event.target as HTMLSelectElement).value as AddressPurpose })"
            >
              <option v-for="p in PURPOSES" :key="p" :value="p">{{ t(`projectCommon.purposes.${p}`) }}</option>
            </select>
            <input
              class="field min-w-0 flex-1 py-1 font-mono text-xs"
              :class="{ 'field-invalid': badIp(a.address) }"
              :value="a.address"
              maxlength="45"
              spellcheck="false"
              inputmode="decimal"
              placeholder="10.10.40.11"
              :aria-label="t('rackPage.addressCols.address')"
              @input="project.updateAddress(item.id, a.id, { address: ($event.target as HTMLInputElement).value.trim() })"
            />
            <button class="rounded p-1 text-muted hover:text-err" :aria-label="t('projectCommon.remove')" @click="project.removeAddress(item.id, a.id)"><X class="size-4" /></button>
          </div>
          <div class="flex gap-1.5">
            <select
              class="field min-w-0 flex-1 py-1 text-xs"
              :value="a.iface"
              :aria-label="t('rackPage.addressCols.iface')"
              @change="project.updateAddress(item.id, a.id, { iface: ($event.target as HTMLSelectElement).value })"
            >
              <option value="">{{ t('rackPage.ifacePrimary') }}</option>
              <option v-if="a.iface && !ifaceChoices.includes(a.iface)" :value="a.iface">{{ a.iface }}</option>
              <option v-for="n in ifaceChoices" :key="n" :value="n">{{ n }}</option>
            </select>
            <input
              class="field w-24 shrink-0 py-1 font-mono text-xs"
              :class="{ 'field-invalid': vlanErrors[a.id] }"
              :value="a.vlan ?? ''"
              inputmode="numeric"
              :placeholder="t('rackPage.vlanAuto')"
              :aria-label="t('rackPage.addressCols.vlan')"
              @input="setVlan(a.id, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <p v-if="badIp(a.address)" class="text-xs text-err">{{ t('rackPage.deviceErrors.ip') }}</p>
          <p v-if="vlanErrors[a.id]" class="text-xs text-err">{{ t('rackPage.deviceErrors.vlan') }}</p>
        </li>
      </ul>
      <button class="btn w-full justify-center px-2 py-1 text-xs" @click="project.addAddress(item.id)"><Plus class="size-3.5" /> {{ t('rackPage.addAddress') }}</button>
    </fieldset>

    <!-- Ports -->
    <fieldset class="space-y-2">
      <legend class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{{ t('rackPage.deviceSections.ports', { count: item.ports.length }) }}</legend>
      <div class="overflow-x-auto rounded-md border border-line">
        <table class="w-full text-xs">
          <thead class="bg-surface-2 text-left text-muted">
            <tr>
              <th class="px-2 py-1.5 font-medium">{{ t('rackPage.portCols.name') }}</th>
              <th class="px-2 py-1.5 font-medium">{{ t('rackPage.portCols.speed') }}</th>
              <th class="px-2 py-1.5 font-medium">MAC</th>
              <th class="w-8"><span class="sr-only">{{ t('projectCommon.remove') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(p, i) in item.ports" :key="`${item.id}-${i}`">
              <tr class="border-t border-line">
                <td class="px-1 py-1">
                  <input
                    class="cell w-20 font-mono"
                    :class="{ 'field-invalid': portErrors[i] === 'empty' || portErrors[i] === 'duplicate' }"
                    :value="p.name"
                    maxlength="40"
                    spellcheck="false"
                    :aria-label="t('rackPage.portCols.name')"
                    @change="renamePort(i, $event)"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                  />
                </td>
                <td class="px-1 py-1">
                  <select class="cell w-16" :value="p.speed" :aria-label="t('rackPage.portCols.speed')" @change="project.updatePort(item.id, i, { speed: Number(($event.target as HTMLSelectElement).value) })">
                    <option v-for="s in speedChoices(p.speed)" :key="s" :value="s">{{ s }}G</option>
                  </select>
                </td>
                <td class="px-1 py-1">
                  <input
                    class="cell w-full min-w-28 font-mono"
                    :class="{ 'field-invalid': portErrors[i] === 'mac' }"
                    :value="p.mac ?? ''"
                    maxlength="17"
                    spellcheck="false"
                    placeholder="aa:bb:cc:dd:ee:ff"
                    aria-label="MAC"
                    @change="setMac(i, $event)"
                  />
                </td>
                <td class="px-1 py-1 text-right">
                  <button
                    class="rounded p-1"
                    :class="armed === `port-${i}` ? 'bg-err-soft text-err' : 'text-muted hover:text-err'"
                    :aria-label="armed === `port-${i}` ? t('projectCommon.confirmAgain') : t('projectCommon.remove')"
                    :title="armed === `port-${i}` ? t('rackPage.portRemoveCabled') : ''"
                    @click="removePort(i)"
                  >
                    <X class="size-3.5" />
                  </button>
                </td>
              </tr>
              <tr v-if="links.get(p.name) || portErrors[i] || armed === `port-${i}`">
                <td colspan="4" class="px-2 pb-1.5 text-[11px]">
                  <span v-if="portErrors[i]" class="text-err">{{ t(`rackPage.deviceErrors.${portErrors[i]}`) }} </span>
                  <span v-if="armed === `port-${i}`" class="text-err">{{ t('rackPage.portRemoveCabled') }} </span>
                  <span v-else-if="links.get(p.name)" class="text-muted">
                    → {{ links.get(p.name)!.peer }} <span class="font-mono">({{ links.get(p.name)!.label }}{{ links.get(p.name)!.bond ? ` · ${links.get(p.name)!.bond}` : '' }})</span>
                  </span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <p v-if="!item.ports.length" class="px-2 py-2 text-xs text-muted">{{ t('rackPage.noPorts') }}</p>
      </div>
      <button class="btn w-full justify-center px-2 py-1 text-xs" @click="project.addPort(item.id)"><Plus class="size-3.5" /> {{ t('rackPage.addPort') }}</button>
    </fieldset>

    <!-- Notes -->
    <div>
      <label for="ri-notes" class="label normal-case">{{ t('rackPage.deviceFields.notes') }}</label>
      <textarea id="ri-notes" class="field min-h-16 font-sans text-xs" :value="item.notes" maxlength="1000" @input="patch('notes', ($event.target as HTMLTextAreaElement).value)" />
    </div>

    <div v-if="template" class="rounded-md border border-line bg-surface-2 p-3 text-xs">
      <div class="font-semibold">{{ t('rackPage.whatIsThis', { name: template.text.name }) }}</div>
      <p class="mt-1 text-muted">{{ template.text.what }}</p>
      <p class="mt-1"><span class="font-semibold">{{ t('devicePage.placement') }}：</span>{{ template.text.placement }}</p>
      <p class="mt-1"><span class="font-semibold">{{ t('devicePage.cabling') }}：</span>{{ template.text.cabling }}</p>
      <div class="mt-2 flex flex-wrap gap-3">
        <RouterLink :to="`/reference/devices#${template.key}`" class="text-accent hover:underline">{{ t('rackPage.readMore') }} →</RouterLink>
        <RouterLink v-if="item.type === 'storage'" to="/learn/raid" class="text-accent hover:underline">{{ t('rackPage.raidLink') }} →</RouterLink>
      </div>
    </div>
  </section>
</template>
