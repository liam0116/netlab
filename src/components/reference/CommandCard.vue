<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ChevronDown, CircleCheck, CircleX, TriangleAlert } from 'lucide-vue-next'
import RichText from '@/components/common/RichText.vue'
import TerminalBlock from '@/components/common/TerminalBlock.vue'
import { CATEGORY_LABELS, type LinuxCommand } from '@/data/linuxCommands'
import type { CommandText } from '@/i18n/content/types'

defineProps<{ command: LinuxCommand; text: CommandText; open: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const { t } = useI18n()
</script>

<template>
  <article class="card overflow-hidden">
    <button class="flex w-full items-start gap-3 p-4 text-left" :aria-expanded="open" @click="emit('toggle')">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <code class="font-mono font-semibold text-accent">{{ command.name }}</code>
          <span class="rounded border border-line px-1.5 text-[10px] text-muted">{{ CATEGORY_LABELS[command.category] }}</span>
        </div>
        <p class="mt-1 text-sm text-fg/85"><RichText :text="text.purpose" /></p>
      </div>
      <ChevronDown class="mt-1 size-4 shrink-0 text-muted transition-transform" :class="{ 'rotate-180': open }" />
    </button>

    <div v-if="open" class="space-y-4 border-t border-line p-4">
      <div>
        <h4 class="label">{{ t('linuxPage.example') }}</h4>
        <TerminalBlock :command="command.example" />
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-2">
          <h4 class="flex items-center gap-1.5 text-xs font-semibold text-ok"><CircleCheck class="size-3.5" />{{ t('linuxPage.normal') }}</h4>
          <pre class="overflow-x-auto rounded-md border border-ok/40 bg-surface-2 p-3 font-mono text-xs leading-relaxed">{{ command.normalOutput }}</pre>
          <p class="text-sm leading-relaxed text-fg/85"><RichText :text="text.normal" /></p>
        </div>
        <div class="space-y-2">
          <h4 class="flex items-center gap-1.5 text-xs font-semibold text-err"><CircleX class="size-3.5" />{{ t('linuxPage.abnormal') }}</h4>
          <pre class="overflow-x-auto rounded-md border border-err/40 bg-surface-2 p-3 font-mono text-xs leading-relaxed">{{ command.abnormalOutput }}</pre>
          <p class="text-sm leading-relaxed text-fg/85"><RichText :text="text.abnormal" /></p>
        </div>
      </div>

      <div v-if="text.issues.length">
        <h4 class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warn"><TriangleAlert class="size-3.5" />{{ t('linuxPage.issues') }}</h4>
        <ul class="list-disc space-y-1 pl-5 text-sm text-fg/85">
          <li v-for="issue in text.issues" :key="issue"><RichText :text="issue" /></li>
        </ul>
      </div>
    </div>
  </article>
</template>
