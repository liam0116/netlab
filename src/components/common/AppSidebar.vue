<script setup lang="ts">
/** From package.json at build time (vite.config.ts `define`). */
const APP_VERSION = __APP_VERSION__
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { dashboardItem, navSections, navTarget } from '@/data/navigation'
import type { NavItem } from '@/types/app'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

/** Localized name shown under the English label; hidden when it would just repeat the label. */
function localName(item: NavItem): string {
  const name = t(`nav.items.${item.id}.name`)
  return name === item.label ? '' : name
}
</script>

<template>
  <!-- Backdrop for tablet / mobile drawer -->
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-30 bg-black/50 lg:hidden" @click="emit('close')" />
  </Transition>

  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="flex h-14 items-center justify-between border-b border-line px-4">
      <RouterLink to="/" class="flex items-center gap-2 font-mono text-sm font-semibold">
        <span class="text-accent">$</span>
        <span>netlab</span>
        <span class="text-muted">~/server-engineer</span>
      </RouterLink>
      <button class="rounded p-1 text-muted hover:text-fg lg:hidden" :aria-label="t('common.closeMenu')" @click="emit('close')">
        <X class="size-5" />
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto px-2 py-3 text-sm">
      <RouterLink :to="navTarget(dashboardItem)" class="nav-link" exact-active-class="nav-link-active">
        <component :is="dashboardItem.icon" class="size-4 shrink-0" />
        <span class="nav-text">
          <span>{{ dashboardItem.label }}</span>
          <span v-if="localName(dashboardItem)" class="nav-sub">{{ localName(dashboardItem) }}</span>
        </span>
      </RouterLink>

      <div v-for="section in navSections" :key="section.id" class="mt-4">
        <div class="flex items-baseline gap-1.5 px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
          {{ section.title }}
          <span v-if="t(`sections.${section.id}.name`) !== section.title" class="font-normal tracking-normal normal-case">
            · {{ t(`sections.${section.id}.name`) }}
          </span>
        </div>
        <RouterLink
          v-for="item in section.items"
          :key="item.id"
          :to="navTarget(item)"
          class="nav-link"
          :class="{ 'nav-link-planned': !item.to }"
          active-class="nav-link-active"
          :title="t(`nav.items.${item.id}.short`)"
        >
          <component :is="item.icon" class="size-4 shrink-0" />
          <span class="nav-text">
            <span>{{ item.label }}</span>
            <span v-if="localName(item)" class="nav-sub">{{ localName(item) }}</span>
          </span>
          <span v-if="!item.to" class="rounded border border-line px-1 font-mono text-[10px]">P{{ item.phase }}</span>
        </RouterLink>
      </div>
    </nav>

    <div class="border-t border-line px-4 py-3 font-mono text-[11px] text-muted">{{ t('app.version', { version: APP_VERSION }) }}</div>
  </aside>
</template>

<style scoped>
@reference '../../style.css';

.nav-link {
  @apply flex items-center gap-2.5 rounded-md px-3 py-1.5 text-fg/80 transition-colors hover:bg-surface-2 hover:text-fg;
}
.nav-text {
  @apply flex min-w-0 flex-1 flex-col leading-tight;
}
.nav-sub {
  @apply truncate text-[11px] text-muted;
}
.nav-link-planned {
  @apply text-fg/50;
}
.nav-link-active {
  @apply bg-accent-soft font-medium text-accent hover:bg-accent-soft hover:text-accent;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
