<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ListTree, Search } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import LearnNote from '@/components/common/LearnNote.vue'
import TerminalBlock from '@/components/common/TerminalBlock.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import { PORTS } from '@/data/ports'
import { portDescriptions } from '@/i18n/content'
import { useSettingsStore } from '@/stores/settings'
import { isValidPort, portCommands, portRange, searchPorts, type PortEntry } from '@/utils/ports'

const settings = useSettingsStore()
const { t } = useI18n()

const query = ref('')
const host = ref('')
const selectedId = ref<string | null>('ssh')

const describe = (entry: PortEntry) => portDescriptions[settings.locale][entry.id] ?? ''
const results = computed(() => searchPorts(PORTS, query.value, describe))

/** A number that is not in the built-in list still gets its IANA range and generic commands. */
const numericQuery = computed(() => {
  const q = query.value.trim().replace(/^(tcp|udp)\s*[/:]?\s*/i, '')
  return /^\d+$/.test(q) ? Number(q) : null
})
const unknownPort = computed(() => {
  const n = numericQuery.value
  return n !== null && !PORTS.some((p) => p.port === n) ? n : null
})

const selected = computed<PortEntry | null>(() => {
  if (unknownPort.value !== null && isValidPort(unknownPort.value) && results.value.length === 0) {
    return { id: 'custom', port: unknownPort.value, protocols: ['TCP'], service: '', aliases: [] }
  }
  return results.value.find((p) => p.id === selectedId.value) ?? results.value[0] ?? null
})
const commands = computed(() => (selected.value ? portCommands(selected.value, host.value.trim() || '<host>') : []))
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('portsPage.title')" :description="t('portsPage.desc')" :icon="ListTree" />

    <div class="card flex items-center gap-2 px-3">
      <Search class="size-4 text-muted" />
      <input
        v-model="query"
        class="w-full bg-transparent py-3 font-mono text-sm outline-none placeholder:text-muted/60"
        :placeholder="t('portsPage.placeholder')"
        spellcheck="false"
        autocomplete="off"
        :aria-label="t('portsPage.placeholder')"
      />
      <span class="shrink-0 text-xs text-muted">{{ t('portsPage.results', { count: results.length }) }}</span>
    </div>

    <StatusBanner v-if="unknownPort !== null && !isValidPort(unknownPort)" variant="err" :title="t('portsPage.invalidPort')" />
    <StatusBanner
      v-else-if="unknownPort !== null"
      variant="info"
      :title="t('portsPage.unknownPort', { port: unknownPort, range: t(`portsPage.ranges.${portRange(unknownPort)}`) })"
    />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section class="card overflow-hidden">
        <div class="max-h-[34rem] overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th class="px-4 py-2 font-medium">{{ t('portsPage.colPort') }}</th>
                <th class="px-4 py-2 font-medium">{{ t('portsPage.colProtocol') }}</th>
                <th class="px-4 py-2 font-medium">{{ t('portsPage.colService') }}</th>
                <th v-if="settings.mode === 'learning'" class="hidden px-4 py-2 font-medium md:table-cell">
                  {{ t('portsPage.colDesc') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in results"
                :key="p.id"
                class="cursor-pointer border-t border-line align-top transition-colors hover:bg-surface-2"
                :class="selected?.id === p.id ? 'bg-accent-soft' : ''"
                @click="selectedId = p.id"
              >
                <td class="px-4 py-2 font-mono font-semibold" :class="selected?.id === p.id ? 'text-accent' : ''">{{ p.port }}</td>
                <td class="px-4 py-2">
                  <span v-for="proto in p.protocols" :key="proto" class="mr-1 rounded border border-line px-1 font-mono text-[11px]">
                    {{ proto }}
                  </span>
                </td>
                <td class="px-4 py-2 font-medium">{{ p.service }}</td>
                <td v-if="settings.mode === 'learning'" class="hidden px-4 py-2 text-muted md:table-cell">{{ describe(p) }}</td>
              </tr>
              <tr v-if="results.length === 0">
                <td colspan="4" class="px-4 py-6 text-center text-muted">{{ t('portsPage.noResults') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="space-y-4">
        <div v-if="selected" class="card space-y-3 p-4">
          <div class="flex items-baseline gap-2">
            <span class="font-mono text-2xl font-bold text-accent">{{ selected.port }}</span>
            <span class="font-medium">{{ selected.service }}</span>
            <span class="ml-auto font-mono text-xs text-muted">{{ selected.protocols.join(' / ') }}</span>
          </div>
          <p v-if="describe(selected)" class="text-sm text-fg/85">{{ describe(selected) }}</p>
          <p class="text-xs text-muted">{{ t(`portsPage.ranges.${portRange(selected.port)}`) }}</p>

          <div>
            <label for="port-host" class="label">{{ t('portsPage.hostLabel') }}</label>
            <input id="port-host" v-model.trim="host" class="field" placeholder="10.0.0.5" spellcheck="false" />
          </div>
          <h3 class="pt-1 text-sm font-semibold">{{ t('portsPage.commands') }}</h3>
          <div v-for="(cmd, i) in commands" :key="cmd" class="space-y-1">
            <p class="text-xs text-muted">{{ t(`portsPage.commandNotes.${i}`) }}</p>
            <TerminalBlock :command="cmd" />
          </div>
        </div>
        <p v-else class="text-sm text-muted">{{ t('portsPage.selectHint') }}</p>

        <LearnNote>{{ t('portsPage.rangeNote') }}</LearnNote>
      </aside>
    </div>
  </div>
</template>
