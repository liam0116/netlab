<script setup lang="ts">
import { GraduationCap, Wrench } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useSettingsStore, type WorkMode } from '@/stores/settings'

const settings = useSettingsStore()
const { t } = useI18n()
const options: { value: WorkMode; icon: typeof Wrench }[] = [
  { value: 'learning', icon: GraduationCap },
  { value: 'engineer', icon: Wrench },
]
</script>

<template>
  <div class="flex rounded-md border border-line bg-surface-2 p-0.5 text-xs" role="radiogroup" aria-label="Work mode">
    <button
      v-for="opt in options"
      :key="opt.value"
      role="radio"
      :aria-checked="settings.mode === opt.value"
      :title="t(`modes.${opt.value}Hint`)"
      class="flex items-center gap-1.5 rounded px-2 py-1 font-medium transition-colors"
      :class="settings.mode === opt.value ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-fg'"
      @click="settings.setMode(opt.value)"
    >
      <component :is="opt.icon" class="size-3.5" />
      <span class="hidden sm:inline">{{ t(`modes.${opt.value}`) }}</span>
    </button>
  </div>
</template>
