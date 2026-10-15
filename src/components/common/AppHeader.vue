<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Menu, Monitor, MonitorOff, Moon, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import ModeSwitch from './ModeSwitch.vue'
import LanguageSwitch from './LanguageSwitch.vue'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits<{ 'toggle-sidebar': [] }>()
const settings = useSettingsStore()
const route = useRoute()
const { t } = useI18n()
const title = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : ''))
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6 lg:px-8"
  >
    <button v-if="!settings.presentation" class="rounded p-1 text-muted hover:text-fg lg:hidden" :aria-label="t('common.openMenu')" @click="emit('toggle-sidebar')">
      <Menu class="size-5" />
    </button>
    <div class="min-w-0 flex-1 truncate font-mono text-sm text-muted">
      <span class="text-accent">~</span>/{{ title.toLowerCase().replace(/\s+/g, '-') }}
    </div>
    <ModeSwitch v-if="!settings.presentation" />
    <LanguageSwitch />
    <button
      class="btn gap-1.5 px-2"
      :class="{ 'border-accent bg-accent-soft text-accent': settings.presentation }"
      :title="settings.presentation ? t('header.exitPresentation') : t('header.presentation')"
      :aria-label="settings.presentation ? t('header.exitPresentation') : t('header.presentation')"
      @click="settings.togglePresentation()"
    >
      <MonitorOff v-if="settings.presentation" class="size-4" />
      <Monitor v-else class="size-4" />
      <span v-if="settings.presentation" class="hidden text-xs sm:inline">{{ t('header.exitPresentation') }}</span>
    </button>
    <button
      class="btn px-2"
      :aria-label="settings.theme === 'dark' ? t('header.toLight') : t('header.toDark')"
      :title="settings.theme === 'dark' ? t('header.toLight') : t('header.toDark')"
      @click="settings.toggleTheme()"
    >
      <Sun v-if="settings.theme === 'dark'" class="size-4" />
      <Moon v-else class="size-4" />
    </button>
  </header>
</template>
