<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="space-y-3">
    <div class="text-center text-xs text-muted">{{ t('visuals.socket.title') }}</div>
    <div class="grid grid-cols-[auto_1fr_auto_1fr] items-stretch gap-2 font-mono text-sm">
      <div class="flex flex-col items-center justify-center rounded-lg border border-line bg-surface-2 px-3 py-2">
        <span class="font-sans text-[10px] text-muted">{{ t('visuals.socket.protocol') }}</span>
        <span class="font-bold">TCP</span>
      </div>
      <div class="rounded-lg border border-net/50 bg-net-soft px-3 py-2 text-center">
        <div class="font-sans text-[10px] text-muted">{{ t('visuals.socket.client') }}</div>
        <span class="text-net">10.0.0.5</span>:<span class="font-bold text-warn">51544</span>
      </div>
      <div class="flex items-center text-muted">→</div>
      <div class="rounded-lg border border-host/50 bg-host-soft px-3 py-2 text-center">
        <div class="font-sans text-[10px] text-muted">{{ t('visuals.socket.server') }}</div>
        <span class="text-host">10.0.0.20</span>:<span class="font-bold text-accent">443</span>
      </div>
    </div>
    <div class="grid gap-1 text-xs sm:grid-cols-2">
      <div class="text-warn">51544 — {{ t('visuals.socket.ephemeral') }}</div>
      <div class="text-accent">443 — {{ t('visuals.socket.wellKnown') }}</div>
    </div>
  </div>
</template>
