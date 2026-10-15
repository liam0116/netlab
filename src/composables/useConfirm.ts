import { onBeforeUnmount, ref } from 'vue'

/**
 * Two-click confirmation for destructive actions without a browser dialog:
 * the first click arms the action (the button changes its label), a second click within
 * `timeoutMs` runs it.
 */
export function useConfirm(timeoutMs = 4000) {
  const armed = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function confirm(key: string): boolean {
    if (armed.value === key) {
      armed.value = null
      clearTimeout(timer)
      return true
    }
    armed.value = key
    clearTimeout(timer)
    timer = setTimeout(() => (armed.value = null), timeoutMs)
    return false
  }

  onBeforeUnmount(() => clearTimeout(timer))
  return { armed, confirm }
}
