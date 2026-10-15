<script setup lang="ts">
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{ current: number; total: number; playing?: boolean; canPlay?: boolean }>()
const emit = defineEmits<{ prev: []; next: []; toggle: []; reset: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button class="btn" :disabled="current <= 0" @click="emit('prev')">
      <ChevronLeft class="size-4" /> {{ t('common.prev') }}
    </button>
    <button class="btn btn-primary" :disabled="current >= total - 1" @click="emit('next')">
      {{ t('common.next') }} <ChevronRight class="size-4" />
    </button>
    <button v-if="canPlay" class="btn" :title="playing ? t('common.pause') : t('common.play')" @click="emit('toggle')">
      <Pause v-if="playing" class="size-4" />
      <Play v-else class="size-4" />
    </button>
    <button class="btn" :title="t('common.restart')" @click="emit('reset')">
      <RotateCcw class="size-4" />
    </button>
    <div class="ml-auto flex items-center gap-2 font-mono text-xs text-muted">
      <div class="flex gap-1">
        <span
          v-for="i in total"
          :key="i"
          class="h-1.5 w-4 rounded-full transition-colors"
          :class="i - 1 <= current ? 'bg-accent' : 'bg-line'"
        />
      </div>
      {{ current + 1 }} / {{ total }}
    </div>
  </div>
</template>
