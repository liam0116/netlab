<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, SquareTerminal } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import CommandCard from '@/components/reference/CommandCard.vue'
import { CATEGORY_LABELS, COMMAND_CATEGORIES, LINUX_COMMANDS, type CommandCategory } from '@/data/linuxCommands'
import { commandTexts } from '@/i18n/content'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { t } = useI18n()

const category = ref<CommandCategory | 'all'>('network')
const query = ref('')
const openIds = ref(new Set<string>(['ip-route']))

const texts = computed(() => commandTexts[settings.locale])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return LINUX_COMMANDS.filter((c) => {
    // Searching looks across every category.
    if (!q) return category.value === 'all' || c.category === category.value
    const text = texts.value[c.id]
    const haystack = [c.name, c.example, CATEGORY_LABELS[c.category], text?.purpose, text?.normal, text?.abnormal, ...(text?.issues ?? [])]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
})

const counts = computed(() => {
  const map: Record<string, number> = { all: LINUX_COMMANDS.length }
  for (const c of LINUX_COMMANDS) map[c.category] = (map[c.category] ?? 0) + 1
  return map
})

function toggle(id: string): void {
  const next = new Set(openIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openIds.value = next
}

const allOpen = computed(() => filtered.value.length > 0 && filtered.value.every((c) => openIds.value.has(c.id)))
function toggleAll(): void {
  openIds.value = allOpen.value ? new Set() : new Set(filtered.value.map((c) => c.id))
}

function localName(cat: CommandCategory): string {
  const name = t(`linuxPage.categories.${cat}`)
  return name === CATEGORY_LABELS[cat] ? '' : name
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('linuxPage.title')" :description="t('linuxPage.desc')" :icon="SquareTerminal" />

    <div class="card flex items-center gap-2 px-3">
      <Search class="size-4 text-muted" />
      <input
        v-model="query"
        class="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted/60"
        :placeholder="t('linuxPage.search')"
        :aria-label="t('linuxPage.search')"
        spellcheck="false"
      />
    </div>

    <div v-if="!query.trim()" class="flex flex-wrap gap-1.5" role="tablist">
      <button
        v-for="cat in ['all', ...COMMAND_CATEGORIES] as const"
        :key="cat"
        role="tab"
        :aria-selected="category === cat"
        class="rounded-md border px-2.5 py-1 text-xs transition-colors"
        :class="category === cat ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg'"
        @click="category = cat"
      >
        <template v-if="cat === 'all'">{{ t('linuxPage.all') }}</template>
        <template v-else>
          {{ CATEGORY_LABELS[cat] }}<span v-if="localName(cat)" class="ml-1 opacity-70">{{ localName(cat) }}</span>
        </template>
        <span class="ml-1 font-mono opacity-60">{{ counts[cat] }}</span>
      </button>
    </div>

    <div class="flex items-center justify-between text-xs text-muted">
      <span>{{ t('linuxPage.count', { count: filtered.length }) }}</span>
      <button v-if="filtered.length" class="hover:text-accent" @click="toggleAll">
        {{ allOpen ? t('linuxPage.collapseAll') : t('linuxPage.expandAll') }}
      </button>
    </div>

    <div class="space-y-3">
      <CommandCard
        v-for="c in filtered"
        :key="c.id"
        :command="c"
        :text="texts[c.id]!"
        :open="openIds.has(c.id)"
        @toggle="toggle(c.id)"
      />
      <p v-if="filtered.length === 0" class="py-8 text-center text-muted">{{ t('linuxPage.noResults') }}</p>
    </div>
  </div>
</template>
