<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Eraser, FolderKanban, FolderOpen, Save, Sparkles, Trash2, Upload } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBanner from '@/components/common/StatusBanner.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { downloadText, slugify } from '@/utils/download'
import type { LibraryEntry, LibraryResult } from '@/stores/project'

const project = useProjectStore()
const settings = useSettingsStore()
const { t, locale } = useI18n()
const { armed, confirm } = useConfirm()

const notice = ref<{ variant: 'ok' | 'err'; text: string } | null>(null)
const logoError = ref<string | null>(null)
const savedFlash = ref(false)

function flash(variant: 'ok' | 'err', text: string): void {
  notice.value = { variant, text }
  setTimeout(() => (notice.value = null), 4000)
}

function newProject(): void {
  if (confirm('new')) project.newProject()
}
function loadDemo(): void {
  if (confirm('demo')) project.loadDemo(settings.locale)
}
function libraryError(result: LibraryResult): void {
  if (result.ok) return
  const known = ['too-large', 'not-json', 'not-netlab', 'unsupported-version'].includes(result.error)
  flash('err', known ? t(`projectPage.importErrors.${result.error}`) : t(`projectPage.libraryErrors.${result.error}`))
}

function save(): void {
  const result = project.saveToLibrary()
  if (!result.ok) return libraryError(result)
  savedFlash.value = true
  setTimeout(() => (savedFlash.value = false), 1500)
}

function exportFile(): void {
  downloadText(`${slugify(project.title, 'project')}.netlab.json`, project.exportFile(), 'application/json')
}
/** Downloads a library entry as it was saved, without opening it. */
function exportEntry(e: LibraryEntry): void {
  downloadText(`${slugify(`${e.customer} ${e.name}`, 'project')}.netlab.json`, e.file, 'application/json')
}

const fileInput = ref<HTMLInputElement | null>(null)
async function onImport(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  const error = file.size > 5 * 1024 * 1024 ? 'too-large' : project.importFile(await file.text())
  if (error) flash('err', t(`projectPage.importErrors.${error}`))
  else flash('ok', t('projectPage.imported'))
}

function openEntry(id: string): void {
  if (confirm(`open-${id}`)) libraryError(project.openFromLibrary(id))
}
function removeEntry(id: string): void {
  if (confirm(`del-${id}`)) libraryError(project.removeFromLibrary(id))
}

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
function onLogo(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  logoError.value = null
  if (!file) return
  if (!LOGO_TYPES.includes(file.type)) return void (logoError.value = t('projectPage.logoBadType'))
  if (file.size > 400 * 1024) return void (logoError.value = t('projectPage.logoTooLarge'))
  const reader = new FileReader()
  reader.onload = () => (project.meta.logo = typeof reader.result === 'string' ? reader.result : null)
  reader.readAsDataURL(file)
}

const rackIssueCount = computed(() => [...project.rackIssues.values()].flat().filter((i) => i.level === 'error').length)
const stats = computed(() => [
  { key: 'plan', to: '/project/ip-plan', value: t('projectPage.stats.planValue', { count: project.subnets.length }), bad: 0 },
  { key: 'racks', to: '/project/rack', value: t('projectPage.stats.racksValue', { racks: project.racks.length, items: project.rackItems.length }), bad: rackIssueCount.value },
  { key: 'cabling', to: '/project/cabling', value: t('projectPage.stats.cablingValue', { count: project.cables.length }), bad: project.cableIssues.filter((i) => i.level === 'error').length },
  { key: 'flows', to: '/project/flows', value: t('projectPage.stats.flowsValue', { services: project.services.length, flows: project.flows.length }), bad: project.flowIssues.filter((i) => i.level === 'error').length },
  { key: 'flowcharts', to: '/project/flowcharts', value: t('projectPage.stats.flowchartsValue', { count: project.flowcharts.length }), bad: 0 },
])

const fields = ['customer', 'project', 'site', 'engineer', 'company'] as const
const openName = computed(() => project.library.find((e) => e.id === project.openLibraryId)?.name ?? '')
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('projectPage.title')" :description="t('projectPage.desc')" :icon="FolderKanban" />

    <StatusBanner v-if="project.storageError" variant="warn" :title="t('projectPage.storageError')" />
    <StatusBanner v-if="notice" :variant="notice.variant" :title="notice.text" />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <!-- Meta -->
      <section class="card space-y-4 p-4">
        <h2 class="font-semibold">{{ t('projectPage.current') }}</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="f in fields" :key="f">
            <label :for="`pm-${f}`" class="label">{{ t(`projectPage.fields.${f}`) }}</label>
            <input :id="`pm-${f}`" v-model="project.meta[f]" class="field" maxlength="200" />
          </div>
          <div>
            <label for="pm-date" class="label">{{ t('projectPage.fields.date') }}</label>
            <input id="pm-date" v-model="project.meta.date" type="date" class="field" />
          </div>
        </div>
        <div>
          <label for="pm-notes" class="label">{{ t('projectPage.fields.notes') }}</label>
          <textarea id="pm-notes" v-model="project.meta.notes" class="field min-h-20 font-sans" maxlength="4000" />
        </div>
        <div>
          <span class="label">{{ t('projectPage.fields.logo') }}</span>
          <div class="flex flex-wrap items-center gap-3">
            <img v-if="project.meta.logo" :src="project.meta.logo" alt="" class="h-12 max-w-40 rounded border border-line bg-white object-contain p-1" />
            <label class="btn cursor-pointer px-2 py-1 text-xs">
              <Upload class="size-3.5" /> PNG / JPEG / SVG
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" class="hidden" @change="onLogo" />
            </label>
            <button v-if="project.meta.logo" class="btn px-2 py-1 text-xs" @click="project.meta.logo = null">
              <Trash2 class="size-3.5" /> {{ t('projectPage.logoRemove') }}
            </button>
            <span v-if="logoError" class="text-xs text-err">{{ logoError }}</span>
          </div>
        </div>
      </section>

      <!-- Actions -->
      <section class="card space-y-2 p-4">
        <h2 class="mb-1 font-semibold">{{ t('projectPage.actions') }}</h2>
        <p class="flex items-center gap-1.5 text-xs" :class="project.unsaved ? 'text-warn' : 'text-ok'" role="status">
          <span aria-hidden="true">{{ project.unsaved ? '●' : '✓' }}</span>
          {{
            project.unsaved
              ? t(project.openLibraryId ? 'projectPage.status.unsaved' : 'projectPage.status.notInLibrary')
              : t('projectPage.status.saved', { name: openName })
          }}
        </p>
        <button class="btn w-full justify-start" @click="save">
          <Save class="size-4" /> {{ savedFlash ? t('projectPage.saved') : t('projectPage.save') }}
        </button>
        <button class="btn w-full justify-start" @click="exportFile"><Download class="size-4" /> {{ t('projectPage.exportFile') }}</button>
        <button class="btn w-full justify-start" @click="fileInput?.click()"><Upload class="size-4" /> {{ t('projectPage.importFile') }}</button>
        <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onImport" />
        <hr class="border-line" />
        <button class="btn w-full justify-start" :class="{ 'border-warn bg-warn-soft text-warn': armed === 'demo' }" @click="loadDemo">
          <Sparkles class="size-4" /> {{ armed === 'demo' ? t('projectCommon.confirmAgain') : t('projectPage.loadDemo') }}
        </button>
        <button class="btn w-full justify-start" :class="armed === 'new' ? 'border-err bg-err-soft text-err' : 'text-err'" @click="newProject">
          <Eraser class="size-4" /> {{ armed === 'new' ? t('projectCommon.confirmAgain') : t('projectPage.newProject') }}
        </button>
        <p class="text-xs text-muted">{{ t('projectPage.replaceWarning') }}</p>
        <details class="rounded-md border border-line px-3 py-2 text-xs text-muted">
          <summary class="cursor-pointer font-medium text-fg">{{ t('projectPage.help.title') }}</summary>
          <ul class="mt-2 space-y-1.5">
            <li>{{ t('projectPage.help.auto') }}</li>
            <li>{{ t('projectPage.help.library') }}</li>
            <li>{{ t('projectPage.help.file') }}</li>
          </ul>
        </details>
      </section>
    </div>

    <!-- Overview -->
    <section>
      <h2 class="mb-3 font-semibold">{{ t('projectPage.overview') }}</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <RouterLink v-for="s in stats" :key="s.key" :to="s.to" class="card flex items-center justify-between p-4 transition-colors hover:border-accent">
          <div>
            <div class="text-xs text-muted">{{ t(`projectPage.stats.${s.key}`) }}</div>
            <div class="mt-0.5 font-medium">{{ s.value }}</div>
          </div>
          <span v-if="s.bad" class="rounded-full bg-err-soft px-2 py-0.5 font-mono text-xs text-err">{{ s.bad }}</span>
          <span v-else class="text-ok">✓</span>
        </RouterLink>
      </div>
    </section>

    <!-- Library -->
    <section class="card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span class="font-semibold">{{ t('projectPage.library') }}</span>
        <span class="text-xs text-muted">{{ t('projectPage.libraryWhere') }}</span>
      </div>
      <p v-if="!project.library.length" class="p-4 text-sm text-muted">{{ t('projectPage.libraryEmpty') }}</p>
      <ul v-else class="divide-y divide-line">
        <li v-for="e in project.library" :key="e.id" class="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" :class="{ 'bg-accent-soft/40': e.id === project.openLibraryId }">
          <div class="min-w-0 flex-1">
            <div class="font-medium">
              {{ e.name }}
              <span v-if="e.id === project.openLibraryId" class="ml-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-normal text-accent">{{ t('projectPage.currentBadge') }}</span>
            </div>
            <div class="text-xs text-muted">{{ e.customer || '—' }} · {{ t('projectPage.savedAt') }} {{ new Date(e.savedAt).toLocaleString(locale) }}</div>
          </div>
          <button class="btn px-2 py-1 text-xs" :class="{ 'border-warn bg-warn-soft text-warn': armed === `open-${e.id}` }" @click="openEntry(e.id)">
            <FolderOpen class="size-3.5" /> {{ armed === `open-${e.id}` ? t('projectCommon.confirmAgain') : t('projectPage.open') }}
          </button>
          <button class="btn px-2 py-1 text-xs" :title="t('projectPage.exportFile')" @click="exportEntry(e)">
            <Download class="size-3.5" /> {{ t('projectPage.exportShort') }}
          </button>
          <button class="btn px-2 py-1 text-xs" :class="{ 'border-err bg-err-soft text-err': armed === `del-${e.id}` }" @click="removeEntry(e.id)">
            <Trash2 class="size-3.5" /> {{ armed === `del-${e.id}` ? t('projectCommon.confirmAgain') : t('projectCommon.remove') }}
          </button>
        </li>
      </ul>
      <p class="border-t border-line bg-warn-soft px-4 py-3 text-xs text-warn">{{ t('projectPage.storageNote') }}</p>
    </section>
  </div>
</template>
