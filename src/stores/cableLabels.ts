import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultPattern, END_MARKS, type LabelPattern } from '@/utils/cableLabels'
import { MAX_LABEL_LENGTH, type LabelText } from '@/utils/labelWorkbook'

const KEY = 'netlab.labels'
/** More than a full rack row of cables, small enough for browser storage. */
export const MAX_LABELS = 3000

export interface Label extends LabelText {
  id: string
}

const uid = () => `lb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

function load(): { labels: Label[]; pattern: LabelPattern; filePrefix: string } {
  const fallback = { labels: [], pattern: defaultPattern(), filePrefix: '' }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null
    if (!raw || typeof raw !== 'object') return fallback
    const labels = (Array.isArray(raw.labels) ? raw.labels : [])
      .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
      .slice(0, MAX_LABELS)
      .map((l) => ({ id: uid(), from: str(l.from, MAX_LABEL_LENGTH), to: str(l.to, MAX_LABEL_LENGTH) }))
    const p = (raw.pattern ?? {}) as Record<string, unknown>
    const d = defaultPattern()
    const pattern: LabelPattern = {
      devices: str(p.devices, 2000),
      ports: str(p.ports, 2000),
      separator: typeof p.separator === 'string' && p.separator.length <= 3 ? p.separator : d.separator,
      copies: p.copies === 1 ? 1 : 2,
      endMark: END_MARKS.includes(p.endMark as never) ? (p.endMark as LabelPattern['endMark']) : d.endMark,
      letterCase: p.letterCase === 'upper' || p.letterCase === 'lower' ? p.letterCase : 'keep',
      toSameAsFrom: p.toSameAsFrom !== false,
    }
    return { labels, pattern, filePrefix: str(raw.filePrefix, 60) }
  } catch {
    return fallback
  }
}

/** Cable labels: a stand-alone tool, saved on this device only and never part of a project file. */
export const useCableLabelsStore = defineStore('cableLabels', () => {
  const initial = load()
  const labels = ref<Label[]>(initial.labels)
  const pattern = ref<LabelPattern>(initial.pattern)
  /** File name start; empty = the default (線路標籤). */
  const filePrefix = ref(initial.filePrefix)
  const storageError = ref(false)

  watch(
    [labels, pattern, filePrefix],
    () => {
      try {
        const data = { labels: labels.value.map(({ from, to }) => ({ from, to })), pattern: pattern.value, filePrefix: filePrefix.value }
        localStorage.setItem(KEY, JSON.stringify(data))
        storageError.value = false
      } catch {
        storageError.value = true
      }
    },
    { deep: true },
  )

  /** Appends labels; returns how many were added (the list stops at MAX_LABELS). */
  function add(items: LabelText[]): number {
    const room = Math.max(0, MAX_LABELS - labels.value.length)
    const added = items.slice(0, room).map((l) => ({ id: uid(), from: l.from.slice(0, MAX_LABEL_LENGTH), to: l.to.slice(0, MAX_LABEL_LENGTH) }))
    labels.value.push(...added)
    return added.length
  }

  function insertAfter(index: number, item: LabelText): void {
    if (labels.value.length >= MAX_LABELS) return
    labels.value.splice(index + 1, 0, { id: uid(), from: item.from, to: item.to })
  }

  function remove(id: string): void {
    labels.value = labels.value.filter((l) => l.id !== id)
  }

  function move(index: number, delta: -1 | 1): void {
    const to = index + delta
    const list = labels.value
    if (to < 0 || to >= list.length) return
    ;[list[index], list[to]] = [list[to]!, list[index]!]
  }

  function clear(): void {
    labels.value = []
  }

  return { labels, pattern, filePrefix, storageError, add, insertAfter, remove, move, clear }
})
