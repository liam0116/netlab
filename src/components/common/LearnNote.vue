<script setup lang="ts">
import { Lightbulb } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'

/** A teaching hint that only renders in Learning Mode. */
defineProps<{ title?: string }>()
const settings = useSettingsStore()
const { t } = useI18n()
</script>

<template>
  <div v-if="settings.mode === 'learning' && !settings.presentation" class="rounded-lg border border-dashed border-accent/40 bg-accent-soft/40 px-4 py-3 text-sm">
    <div class="mb-1 flex items-center gap-1.5 font-medium text-accent">
      <Lightbulb class="size-4" />
      {{ title ?? t('common.learnTip') }}
    </div>
    <div class="leading-relaxed text-fg/85"><slot /></div>
  </div>
</template>
