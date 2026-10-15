<script setup lang="ts">
import { computed } from 'vue'

/** Renders plain text where `backtick` segments become inline code. No HTML is interpreted. */
const props = defineProps<{ text: string }>()
const parts = computed(() => props.text.split('`').map((value, i) => ({ value, code: i % 2 === 1 })))
</script>

<template>
  <span>
    <template v-for="(part, i) in parts" :key="i">
      <code v-if="part.code" class="kbd text-accent">{{ part.value }}</code>
      <template v-else>{{ part.value }}</template>
    </template>
  </span>
</template>
