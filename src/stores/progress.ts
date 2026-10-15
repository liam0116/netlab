import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const KEY = 'netlab.completedChapters'

function load(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Tutorial chapters whose quiz was passed. Stored locally per browser. */
export const useProgressStore = defineStore('progress', () => {
  const completed = ref<string[]>(load())

  watch(
    completed,
    (value) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(value))
      } catch {
        // ignore: progress just won't persist
      }
    },
    { deep: true },
  )

  function markComplete(id: string): void {
    if (!completed.value.includes(id)) completed.value.push(id)
  }

  function isComplete(id: string): boolean {
    return completed.value.includes(id)
  }

  return { completed, markComplete, isComplete }
})
