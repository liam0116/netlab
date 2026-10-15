<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/common/AppSidebar.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import { useSettingsStore } from '@/stores/settings'

// Instantiate early so the theme watcher applies the stored theme.
const settings = useSettingsStore()

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && settings.presentation) settings.togglePresentation()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const sidebarOpen = ref(false)
const route = useRoute()
watch(
  () => route.fullPath,
  () => (sidebarOpen.value = false),
)
</script>

<template>
  <div class="flex min-h-screen">
    <AppSidebar v-if="!settings.presentation" :open="sidebarOpen" class="print:hidden" @close="sidebarOpen = false" />
    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader class="print:hidden" @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <main
        class="mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0"
        :class="settings.presentation ? 'max-w-7xl' : 'max-w-6xl'"
      >
        <RouterView v-slot="{ Component, route: viewRoute }">
          <div :key="viewRoute.path" class="anim-page">
            <component :is="Component" />
          </div>
        </RouterView>
      </main>
    </div>
  </div>
</template>

