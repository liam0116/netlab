<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24 text-center font-mono">
    <div class="text-5xl font-bold text-accent">404</div>
    <p class="mt-3 text-muted">{{ t('notFound.text') }}</p>
    <RouterLink to="/" class="btn mt-6">{{ t('common.backToDashboard') }}</RouterLink>
  </div>
</template>
