<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValidationError } from '@/types/network'
import { validateIPv4 } from '@/utils/network'

const model = defineModel<string>({ required: true })
const props = withDefaults(
  defineProps<{ label: string; placeholder?: string; validator?: (value: string) => ValidationError | null }>(),
  { placeholder: '192.168.1.10', validator: validateIPv4 },
)
const emit = defineEmits<{ submit: [] }>()

const id = useId()
const { t } = useI18n()
const touched = ref(false)
const error = computed(() => props.validator(model.value))
const showError = computed(() => touched.value && model.value !== '' && error.value !== null)
</script>

<template>
  <div>
    <label :for="id" class="label">{{ label }}</label>
    <input
      :id="id"
      v-model.trim="model"
      class="field"
      :class="{ 'field-invalid': showError }"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      inputmode="decimal"
      :aria-invalid="showError"
      @blur="touched = true"
      @input="touched = true"
      @keydown.enter="emit('submit')"
    />
    <p v-if="showError && error" class="mt-1 text-xs text-err">{{ t(error.key, error.params ?? {}) }}</p>
  </div>
</template>
