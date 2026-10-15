<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CircleCheck } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import RichText from '@/components/common/RichText.vue'
import { allNavItems, findNavItem } from '@/data/navigation'

/** Intro page for features that are not built yet: what it is, when you need it, what it will include. */
const route = useRoute()
const { t, tm, rt } = useI18n()

const item = computed(() => findNavItem(String(route.params.id ?? '')))
const localName = computed(() => (item.value ? t(`nav.items.${item.value.id}.name`) : ''))
const planned = computed<string[]>(() => {
  if (!item.value) return []
  // te() reports false for array messages, so read with tm() and check the shape instead.
  const messages = tm(`nav.items.${item.value.id}.planned`) as unknown
  return Array.isArray(messages) ? messages.map((m) => rt(m)) : []
})
const available = allNavItems.filter((i) => i.to)
</script>

<template>
  <div v-if="!item" class="py-20 text-center">
    <p class="text-muted">{{ t('feature.notFound') }}</p>
    <RouterLink to="/" class="btn mt-4">{{ t('common.backToDashboard') }}</RouterLink>
  </div>

  <div v-else class="max-w-3xl space-y-6">
    <PageHeader
      :title="localName && localName !== item.label ? `${item.label} · ${localName}` : item.label"
      :description="t(`nav.items.${item.id}.short`)"
      :icon="item.icon"
    />

    <StatusBanner variant="info" :title="t('feature.status', { phase: item.phase })">
      {{ t('feature.statusText', { phase: item.phase }) }}
    </StatusBanner>

    <section class="card space-y-5 p-5">
      <div>
        <h2 class="mb-1 font-semibold">{{ t('feature.what') }}</h2>
        <p class="text-sm leading-relaxed text-fg/85"><RichText :text="t(`nav.items.${item.id}.what`)" /></p>
      </div>
      <div>
        <h2 class="mb-1 font-semibold">{{ t('feature.when') }}</h2>
        <p class="text-sm leading-relaxed text-fg/85"><RichText :text="t(`nav.items.${item.id}.when`)" /></p>
      </div>
      <div v-if="planned.length">
        <h2 class="mb-2 font-semibold">{{ t('feature.planned') }}</h2>
        <ul class="space-y-2 text-sm">
          <li v-for="line in planned" :key="line" class="flex gap-2">
            <CircleCheck class="mt-0.5 size-4 shrink-0 text-muted" />
            <RichText :text="line" class="leading-relaxed text-fg/85" />
          </li>
        </ul>
      </div>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-semibold text-muted">{{ t('feature.meanwhile') }}</h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink v-for="a in available" :key="a.id" :to="a.to!" class="btn text-xs">
          <component :is="a.icon" class="size-3.5" />
          {{ a.label }}
        </RouterLink>
      </div>
    </section>
  </div>
</template>
