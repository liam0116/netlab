import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Drives a step-by-step animation: prev / next / autoplay / pause / reset.
 * `total` is reactive so the player resets when the underlying data changes.
 */
export function useStepPlayer(total: Ref<number>, intervalMs = 900) {
  const current = ref(0)
  const playing = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined

  function stop(): void {
    playing.value = false
    clearInterval(timer)
    timer = undefined
  }

  function next(): void {
    if (current.value < total.value - 1) current.value++
    if (current.value >= total.value - 1) stop()
  }

  function prev(): void {
    stop()
    if (current.value > 0) current.value--
  }

  function goTo(index: number): void {
    stop()
    current.value = Math.min(Math.max(index, 0), Math.max(total.value - 1, 0))
  }

  function play(): void {
    if (current.value >= total.value - 1) current.value = 0
    playing.value = true
    clearInterval(timer)
    timer = setInterval(next, intervalMs)
  }

  function toggle(): void {
    if (playing.value) stop()
    else play()
  }

  function reset(): void {
    stop()
    current.value = 0
  }

  function finish(): void {
    stop()
    current.value = Math.max(total.value - 1, 0)
  }

  watch(total, reset)
  onBeforeUnmount(stop)

  return { current, playing, next, prev, goTo, play, stop, toggle, reset, finish }
}
