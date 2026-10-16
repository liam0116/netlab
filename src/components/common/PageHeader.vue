<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ title: string; description?: string; icon?: Component }>()
</script>

<template>
  <div class="mb-6 flex flex-wrap items-start gap-4">
    <div v-if="icon" class="rounded-lg border border-line bg-surface p-2.5 text-accent">
      <component :is="icon" class="size-5" />
    </div>
    <!-- At least 16rem wide, so on a phone the buttons drop to the next line instead of squeezing the text. -->
    <div class="min-w-0 flex-1 basis-64">
      <h1 class="text-xl font-semibold tracking-tight">{{ title }}</h1>
      <p v-if="description" class="mt-1 text-sm text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
