<script setup lang="ts">
import { Languages } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, isAppLocale } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { t } = useI18n()

function onChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isAppLocale(value)) settings.setLocale(value)
}
</script>

<template>
  <label class="btn relative gap-1.5 px-2" :title="t('header.language')">
    <Languages class="size-4" />
    <span class="text-xs">{{ SUPPORTED_LOCALES.find((l) => l.code === settings.locale)?.short }}</span>
    <select
      class="absolute inset-0 cursor-pointer opacity-0"
      :value="settings.locale"
      :aria-label="t('header.language')"
      @change="onChange"
    >
      <option v-for="l in SUPPORTED_LOCALES" :key="l.code" :value="l.code">{{ l.label }}</option>
    </select>
  </label>
</template>
