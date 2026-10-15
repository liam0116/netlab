<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{ text: string; label?: string }>(), { label: '' })
const copied = ref(false)
const { t } = useI18n()
let timer: ReturnType<typeof setTimeout> | undefined

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.text)
  } catch {
    // Fallback for non-secure contexts (e.g. http://LAN-IP inside Docker)
    const area = document.createElement('textarea')
    area.value = props.text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 1500)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <button class="btn px-2 py-1 text-xs" :title="copied ? t('common.copied') : t('common.copy')" @click="copy">
    <Check v-if="copied" class="size-3.5 text-ok" />
    <Copy v-else class="size-3.5" />
    <span v-if="label">{{ copied ? t('common.copied') : label }}</span>
  </button>
</template>
