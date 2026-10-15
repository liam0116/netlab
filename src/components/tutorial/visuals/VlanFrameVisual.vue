<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ tagged: boolean }>()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-3">
    <div class="text-center text-xs text-muted">{{ tagged ? t('visuals.vlanFrame.tagged') : t('visuals.vlanFrame.untagged') }}</div>
    <div class="flex flex-wrap justify-center gap-1 font-mono text-xs">
      <div class="field-box">Dst MAC<span>6 B</span></div>
      <div class="field-box">Src MAC<span>6 B</span></div>
      <div v-if="tagged" class="field-box border-accent bg-accent-soft text-accent">802.1Q Tag<span>4 B</span></div>
      <div class="field-box">EtherType<span>2 B</span></div>
      <div class="field-box min-w-28 grow">Payload (IP)<span>46–1500 B</span></div>
      <div class="field-box">FCS<span>4 B</span></div>
    </div>
    <template v-if="tagged">
      <div class="mx-auto flex max-w-md justify-center gap-1 font-mono text-xs">
        <div class="field-box grow">TPID<span>0x8100</span></div>
        <div class="field-box">PCP<span>3 bit</span></div>
        <div class="field-box">DEI<span>1 bit</span></div>
        <div class="field-box grow border-accent bg-accent-soft text-accent">VID<span>12 bit = 20</span></div>
      </div>
      <p class="text-center text-xs text-muted">{{ t('visuals.vlanFrame.tagNote') }}</p>
    </template>
  </div>
</template>

<style scoped>
@reference '../../../style.css';

/* In the components layer so utilities like border-accent can override it. */
@layer components {
  .field-box {
    @apply flex flex-col items-center rounded border border-line bg-surface-2 px-2.5 py-2 text-center;
  }
  .field-box span {
    @apply mt-0.5 text-[10px] text-muted;
  }
}
</style>
