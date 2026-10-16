<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Database } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import RaidSimulator from '@/components/learn/RaidSimulator.vue'
import QuizCard from '@/components/tutorial/QuizCard.vue'
import { raidContent } from '@/i18n/content'
import type { AppLocale } from '@/i18n'
import { raidQuiz } from '@/data/raidQuiz'
import { MIN_DISKS, RAID_LEVELS, raidInfo, type RaidLevel } from '@/utils/raid'

const { t, locale } = useI18n()
const text = computed(() => raidContent[locale.value as AppLocale])

const level = ref<RaidLevel>(5)
const levelText = computed(() => text.value.levels[String(level.value) as '5'])

// Comparison table: formulas plus a worked example (4 × 8 TB, RAID 1 with 2 disks).
const FORMULA: Record<RaidLevel, string> = { 0: 'N', 1: '1', 5: 'N − 1', 6: 'N − 2', 10: 'N / 2' }
const rows = computed(() =>
  RAID_LEVELS.map((l) => {
    const disks = l === 1 ? 2 : 4
    const info = raidInfo(l, disks, 8)
    return { level: l, min: MIN_DISKS[l], formula: FORMULA[l], example: `${disks} × 8 TB → ${info.usableTB} TB`, info, text: text.value.levels[String(l) as '5'] }
  }),
)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('raidPage.title')" :description="t('raidPage.desc')" :icon="Database" />

    <section class="card space-y-3 p-5 text-sm leading-relaxed">
      <p v-for="(p, i) in text.intro" :key="i">{{ p }}</p>
    </section>
    <StatusBanner variant="warn" :title="text.notBackup" />

    <!-- Simulator -->
    <section class="card p-5">
      <h2 class="mb-1 text-lg font-semibold">{{ t('raidPage.simTitle') }}</h2>
      <p class="mb-4 text-sm text-muted">{{ t('raidPage.simHint') }}</p>
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <RaidSimulator v-model:level="level" />
        <aside class="space-y-3 rounded-lg border border-line bg-surface-2 p-4 text-sm">
          <h3 class="font-semibold">{{ levelText.name }}</h3>
          <p class="text-accent">{{ levelText.tagline }}</p>
          <p class="leading-relaxed">{{ levelText.how }}</p>
          <div>
            <div class="mb-1 text-xs font-semibold text-ok">{{ t('raidPage.good') }}</div>
            <ul class="list-inside list-disc space-y-0.5 text-xs">
              <li v-for="g in levelText.good" :key="g">{{ g }}</li>
            </ul>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold text-err">{{ t('raidPage.bad') }}</div>
            <ul class="list-inside list-disc space-y-0.5 text-xs">
              <li v-for="b in levelText.bad" :key="b">{{ b }}</li>
            </ul>
          </div>
          <p class="text-xs"><span class="font-semibold">{{ t('raidPage.useFor') }}</span> {{ levelText.useFor }}</p>
          <p class="text-xs"><span class="font-semibold">{{ t('raidPage.avoid') }}</span> {{ levelText.avoid }}</p>
        </aside>
      </div>
    </section>

    <!-- Comparison -->
    <section class="card overflow-hidden">
      <h2 class="border-b border-line px-5 py-3 text-lg font-semibold">{{ t('raidPage.compare') }}</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">RAID</th>
              <th class="px-3 py-2 font-medium">{{ t('raidPage.cols.min') }}</th>
              <th class="px-3 py-2 font-medium">{{ t('raidPage.cols.usable') }}</th>
              <th class="px-3 py-2 font-medium">{{ t('raidPage.cols.example') }}</th>
              <th class="px-3 py-2 font-medium">{{ t('raidPage.cols.tolerance') }}</th>
              <th class="px-3 py-2 font-medium">{{ t('raidPage.cols.write') }}</th>
              <th class="px-3 py-2 font-medium">{{ t('raidPage.cols.use') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.level" class="cursor-pointer border-t border-line hover:bg-surface-2" :class="{ 'bg-accent-soft/40': r.level === level }" @click="level = r.level">
              <td class="px-4 py-2 font-semibold whitespace-nowrap">RAID {{ r.level }}</td>
              <td class="px-3 py-2 font-mono">{{ r.min }}</td>
              <td class="px-3 py-2 font-mono whitespace-nowrap">{{ r.formula }}</td>
              <td class="px-3 py-2 font-mono text-xs whitespace-nowrap">{{ r.example }}</td>
              <td class="px-3 py-2" :class="r.info.tolerance ? '' : 'text-err'">
                {{ r.level === 1 ? t('raidPage.cols.toleranceMirror') : r.level === 10 ? t('raidPage.cols.tolerancePair') : r.info.tolerance }}
              </td>
              <td class="px-3 py-2 text-xs whitespace-nowrap">{{ t('raidPage.cols.penalty', { n: r.info.writePenalty }) }}</td>
              <td class="px-3 py-2 text-xs">{{ r.text.useFor }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="border-t border-line px-5 py-2 text-xs text-muted">{{ t('raidPage.compareNote') }}</p>
    </section>

    <!-- Which one when -->
    <section class="card overflow-hidden">
      <h2 class="border-b border-line px-5 py-3 text-lg font-semibold">{{ t('raidPage.choose') }}</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">{{ t('raidPage.chooseCols.situation') }}</th>
              <th class="px-3 py-2 font-medium">{{ t('raidPage.chooseCols.pick') }}</th>
              <th class="px-3 py-2 font-medium">{{ t('raidPage.chooseCols.why') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in text.choose" :key="c.situation" class="border-t border-line align-top">
              <td class="px-4 py-2">{{ c.situation }}</td>
              <td class="px-3 py-2 font-semibold whitespace-nowrap text-accent">{{ c.pick }}</td>
              <td class="px-3 py-2 text-muted">{{ c.why }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Where to configure -->
    <section class="card space-y-4 p-5">
      <h2 class="text-lg font-semibold">{{ t('raidPage.where') }}</h2>
      <div>
        <h3 class="mb-2 text-sm font-semibold">{{ t('raidPage.workflow') }}</h3>
        <ol class="space-y-1.5 text-sm">
          <li v-for="(w, i) in text.workflow" :key="i" class="flex gap-3">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{{ i + 1 }}</span>
            <span class="pt-0.5">{{ w }}</span>
          </li>
        </ol>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <details v-for="p in text.places" :key="p.title" class="group rounded-lg border border-line p-3 text-sm">
          <summary class="flex cursor-pointer list-none items-center justify-between font-semibold">
            {{ p.title }}
            <ChevronDown class="size-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <p class="mt-2 text-muted">{{ p.where }}</p>
          <ol class="mt-2 list-inside list-decimal space-y-0.5 font-mono text-xs">
            <li v-for="s in p.steps" :key="s">{{ s }}</li>
          </ol>
          <p v-if="p.note" class="mt-2 text-xs text-warn">{{ p.note }}</p>
        </details>
      </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="card p-5">
        <h2 class="mb-3 text-lg font-semibold">{{ t('raidPage.others') }}</h2>
        <dl class="space-y-2 text-sm">
          <div v-for="o in text.others" :key="o.level">
            <dt class="font-semibold">{{ o.level }}</dt>
            <dd class="text-muted">{{ o.text }}</dd>
          </div>
        </dl>
      </section>
      <section class="card p-5">
        <h2 class="mb-3 text-lg font-semibold">{{ t('raidPage.checklist') }}</h2>
        <ul class="space-y-1.5 text-sm">
          <li v-for="c in text.checklist" :key="c" class="flex gap-2"><span class="text-ok">✓</span>{{ c }}</li>
        </ul>
      </section>
    </div>

    <section class="card p-5">
      <h2 class="mb-3 text-lg font-semibold">{{ t('raidPage.glossary') }}</h2>
      <dl class="grid gap-3 text-sm md:grid-cols-2">
        <div v-for="g in text.glossary" :key="g.term">
          <dt class="font-semibold">{{ g.term }}</dt>
          <dd class="text-muted">{{ g.text }}</dd>
        </div>
      </dl>
    </section>

    <section>
      <h2 class="mb-3 text-lg font-semibold">{{ t('raidPage.quizTitle') }}</h2>
      <QuizCard :factories="raidQuiz" />
    </section>
  </div>
</template>
