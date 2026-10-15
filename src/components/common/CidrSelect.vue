<script setup lang="ts">
import { useId } from 'vue'
import { cidrToMask } from '@/utils/network'

const model = defineModel<number>({ required: true })
withDefaults(defineProps<{ label?: string; min?: number }>(), { label: 'CIDR', min: 0 })
const id = useId()
const prefixes = Array.from({ length: 33 }, (_, i) => i)
</script>

<template>
  <div>
    <label :for="id" class="label">{{ label }}</label>
    <select :id="id" v-model.number="model" class="field">
      <option v-for="p in prefixes.filter((x) => x >= min)" :key="p" :value="p">/{{ p }} — {{ cidrToMask(p) }}</option>
    </select>
  </div>
</template>
