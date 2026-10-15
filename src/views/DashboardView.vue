<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from 'lucide-vue-next'
import CopyButton from '@/components/common/CopyButton.vue'
import RichText from '@/components/common/RichText.vue'
import { allNavItems, navSections, navTarget } from '@/data/navigation'
import type { NavItem } from '@/types/app'
import { calculateSubnet, parseCidrNotation } from '@/utils/network'

const { t } = useI18n()

const quick = ref('192.168.50.137/27')
const quickResult = computed(() => {
  const parsed = parseCidrNotation(quick.value)
  return parsed ? calculateSubnet(parsed.ip, parsed.cidr) : null
})
const quickText = computed(() => {
  const r = quickResult.value
  if (!r) return ''
  return [
    `Network      ${r.networkAddress}/${r.cidr}`,
    `First Host   ${r.firstHost}`,
    `Last Host    ${r.lastHost}`,
    `Broadcast    ${r.broadcastAddress}`,
    `Mask         ${r.subnetMask}`,
    `Hosts        ${r.usableHosts.toLocaleString()}`,
  ].join('\n')
})

const readyCount = allNavItems.filter((i) => i.to).length

function localName(item: NavItem): string {
  const name = t(`nav.items.${item.id}.name`)
  return name === item.label ? '' : name
}
</script>

<template>
  <div class="space-y-10">
    <section class="grid gap-6 lg:grid-cols-[1fr_26rem]">
      <div class="flex flex-col justify-center">
        <p class="font-mono text-xs text-accent">{{ t('app.tagline') }}</p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{{ t('app.name') }}</h1>
        <p class="mt-3 max-w-xl text-sm leading-relaxed text-muted">{{ t('dashboard.intro') }}</p>
        <p class="mt-2 max-w-xl text-sm leading-relaxed text-muted">{{ t('dashboard.modesIntro') }}</p>
        <div class="mt-4 font-mono text-xs text-muted">
          {{ t('dashboard.modulesOnline', { ready: readyCount, total: allNavItems.length }) }}
        </div>
      </div>

      <!-- Quick subnet calc -->
      <div class="card overflow-hidden">
        <div class="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2">
          <span class="size-2.5 rounded-full bg-err/70" />
          <span class="size-2.5 rounded-full bg-warn/70" />
          <span class="size-2.5 rounded-full bg-ok/70" />
          <span class="ml-2 font-mono text-xs text-muted">{{ t('dashboard.quickTitle') }}</span>
        </div>
        <div class="space-y-3 p-4 font-mono text-sm">
          <label class="flex items-center gap-2">
            <span class="text-accent">$</span>
            <span class="text-muted">ipcalc</span>
            <input
              v-model.trim="quick"
              class="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted/50"
              placeholder="10.0.0.5/24"
              spellcheck="false"
              aria-label="IP/CIDR"
            />
          </label>
          <pre v-if="quickResult" class="leading-relaxed whitespace-pre">{{ quickText }}</pre>
          <p v-else class="text-err">{{ t('dashboard.quickFormat') }}</p>
          <div v-if="quickResult" class="flex justify-between">
            <RouterLink
              :to="{ path: '/tools/subnet', query: { ip: quickResult.ip, cidr: String(quickResult.cidr) } }"
              class="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              {{ t('dashboard.quickDetail') }} <ArrowRight class="size-3" />
            </RouterLink>
            <CopyButton :text="quickText" :label="t('common.copy')" />
          </div>
        </div>
      </div>
    </section>

    <section v-for="section in navSections" :key="section.id">
      <div class="mb-3">
        <h2 class="flex items-baseline gap-2">
          <span class="text-xs font-semibold tracking-wider text-muted uppercase">{{ section.title }}</span>
          <span v-if="t(`sections.${section.id}.name`) !== section.title" class="text-sm font-medium">
            {{ t(`sections.${section.id}.name`) }}
          </span>
        </h2>
        <p class="mt-0.5 text-sm text-muted">{{ t(`sections.${section.id}.desc`) }}</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <RouterLink
          v-for="item in section.items"
          :key="item.id"
          :to="navTarget(item)"
          class="card group flex flex-col gap-3 p-4 transition-colors hover:border-accent"
          :class="{ 'border-dashed': !item.to }"
        >
          <div class="flex items-start gap-3">
            <div
              class="rounded-md border border-line bg-surface-2 p-2"
              :class="item.to ? 'text-accent' : 'text-muted'"
            >
              <component :is="item.icon" class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 font-medium">
                {{ item.label }}
                <span v-if="localName(item)" class="text-sm font-normal text-muted">{{ localName(item) }}</span>
              </div>
              <p class="mt-0.5 text-sm text-muted">{{ t(`nav.items.${item.id}.short`) }}</p>
            </div>
            <ArrowRight
              class="size-4 shrink-0 -translate-x-1 text-accent opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
            />
          </div>

          <dl class="space-y-2 border-t border-line pt-3 text-xs leading-relaxed">
            <div>
              <dt class="font-medium text-fg/80">{{ t('dashboard.what') }}</dt>
              <dd class="text-muted"><RichText :text="t(`nav.items.${item.id}.what`)" /></dd>
            </div>
            <div>
              <dt class="font-medium text-fg/80">{{ t('dashboard.when') }}</dt>
              <dd class="text-muted"><RichText :text="t(`nav.items.${item.id}.when`)" /></dd>
            </div>
          </dl>

          <div v-if="!item.to" class="mt-auto flex items-center justify-between text-xs">
            <span class="rounded border border-line px-1.5 py-0.5 font-mono text-muted">
              {{ t('dashboard.plannedPhase', { phase: item.phase }) }}
            </span>
            <span class="text-accent">{{ t('dashboard.learnMore') }} →</span>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
