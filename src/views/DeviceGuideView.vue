<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Boxes } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import { deviceGuide } from '@/i18n/content'
import type { AppLocale } from '@/i18n'
import { RACK_TEMPLATES } from '@/utils/rack'
import { DEVICE_GROUPS } from '@/data/deviceGroups'

const { t, locale } = useI18n()
const route = useRoute()
const guide = computed(() => deviceGuide[locale.value as AppLocale])

const GROUPS = DEVICE_GROUPS

// Deep links from the rack page: /reference/devices#nas-12bay
onMounted(async () => {
  await nextTick()
  if (route.hash) document.getElementById(route.hash.slice(1))?.scrollIntoView({ block: 'start' })
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('devicePage.title')" :description="t('devicePage.desc')" :icon="Boxes" />

    <section class="card space-y-2 p-5 text-sm leading-relaxed">
      <p v-for="(p, i) in guide.intro" :key="i">{{ p }}</p>
    </section>

    <section class="card p-5">
      <h2 class="mb-3 text-lg font-semibold">{{ t('devicePage.concepts') }}</h2>
      <dl class="grid gap-3 text-sm md:grid-cols-2">
        <div v-for="c in guide.concepts" :key="c.term" class="rounded-md border border-line p-3">
          <dt class="font-semibold">{{ c.term }}</dt>
          <dd class="mt-1 text-muted">{{ c.text }}</dd>
        </div>
      </dl>
    </section>

    <nav class="flex flex-wrap gap-2 text-xs">
      <a v-for="g in GROUPS" :key="g.key" :href="`#group-${g.key}`" class="kbd hover:text-accent">{{ t(`devicePage.groups.${g.key}`) }}</a>
    </nav>

    <section v-for="g in GROUPS" :id="`group-${g.key}`" :key="g.key" class="scroll-mt-20 space-y-3">
      <h2 class="text-lg font-semibold">{{ t(`devicePage.groups.${g.key}`) }}</h2>
      <article
        v-for="id in g.ids"
        :id="id"
        :key="id"
        class="card scroll-mt-20 p-5 target:border-accent"
      >
        <div class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 class="text-base font-semibold">{{ guide.devices[id]!.name }}</h3>
          <span class="font-mono text-xs text-muted">{{ RACK_TEMPLATES[id]!.uHeight }}U · {{ RACK_TEMPLATES[id]!.powerW }} W · {{ RACK_TEMPLATES[id]!.weightKg }} kg</span>
        </div>
        <p class="mb-3 text-sm leading-relaxed">{{ guide.devices[id]!.what }}</p>
        <dl class="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <dt class="text-xs font-semibold text-accent">{{ t('devicePage.use') }}</dt>
            <dd class="mt-0.5">{{ guide.devices[id]!.use }}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold text-accent">{{ t('devicePage.placement') }}</dt>
            <dd class="mt-0.5">{{ guide.devices[id]!.placement }}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold text-accent">{{ t('devicePage.cabling') }}</dt>
            <dd class="mt-0.5">{{ guide.devices[id]!.cabling }}</dd>
          </div>
        </dl>
        <ul class="mt-3 space-y-1 rounded-md bg-surface-2 px-3 py-2 text-sm">
          <li v-for="tip in guide.devices[id]!.tips" :key="tip" class="flex gap-2"><span class="text-warn">💡</span>{{ tip }}</li>
        </ul>
        <RouterLink v-if="guide.devices[id]!.link" :to="guide.devices[id]!.link!.to" class="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline">
          {{ guide.devices[id]!.link!.label }} <ArrowRight class="size-3.5" />
        </RouterLink>
      </article>
    </section>
  </div>
</template>
