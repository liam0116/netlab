<script setup lang="ts">
/**
 * Number field that only writes valid values: 0, negatives, empty text or out-of-range numbers show an
 * error and keep the last valid value; leaving the field puts that value back.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseNumberInput, type NumberError } from '@/utils/numberInput'

const model = defineModel<number>({ required: true })
const props = defineProps<{ id: string; label: string; min: number; max: number; integer?: boolean; disabled?: boolean; unit?: string; hint?: string }>()

const { t } = useI18n()
const text = ref(String(model.value))
const error = ref<NumberError | null>(null)

// Another rack / device selected, or the value changed elsewhere (e.g. dragging).
watch(model, (v) => {
  if (Number(text.value) !== v || error.value !== null) {
    text.value = String(v)
    error.value = null
  }
})

function onInput(event: Event): void {
  text.value = (event.target as HTMLInputElement).value
  const parsed = parseNumberInput(text.value, { min: props.min, max: props.max, integer: props.integer })
  if (parsed.ok) {
    error.value = null
    if (parsed.value !== model.value) model.value = parsed.value
  } else {
    error.value = parsed.error
  }
}

function onBlur(): void {
  if (error.value === null) return
  text.value = String(model.value)
  error.value = null
}

const message = computed(() =>
  error.value === null ? '' : t(`common.numberErrors.${error.value === 'range' && props.integer ? 'rangeInteger' : error.value}`, { min: props.min, max: props.max, value: model.value }),
)
</script>

<template>
  <div>
    <label :for="id" class="label normal-case">{{ label }}</label>
    <input
      :id="id"
      type="number"
      :min="min"
      :max="max"
      :step="integer ? 1 : 'any'"
      :inputmode="integer ? 'numeric' : 'decimal'"
      class="field py-1.5"
      :class="{ 'field-invalid': error }"
      :value="text"
      :disabled="disabled"
      :aria-invalid="error !== null"
      :aria-describedby="error || hint ? `${id}-msg` : undefined"
      @input="onInput"
      @blur="onBlur"
    />
    <p v-if="error" :id="`${id}-msg`" class="mt-1 text-xs text-err" role="alert">{{ message }}</p>
    <p v-else-if="hint" :id="`${id}-msg`" class="mt-1 text-xs text-muted">{{ hint }}</p>
  </div>
</template>
