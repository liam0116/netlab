import { ref } from 'vue'
import { unzipSync, zipSync, type Zippable } from 'fflate'
import { fillLabelWorkbook, inspectLabelTemplate, type LabelTemplate, type LabelText, type TemplateError } from '@/utils/labelWorkbook'

/**
 * The Excel template cable labels are written into: the supplier's original (shipped with the site and
 * cached for offline use), or the user's own copy adjusted to their printer, kept in this browser's
 * IndexedDB (too large for localStorage). Nothing is uploaded anywhere.
 */
const DB_NAME = 'netlab'
const DB_STORE = 'files'
const CUSTOM_KEY = 'labelTemplate'
const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024
const DEFAULT_URL = `${import.meta.env.BASE_URL}templates/cable-labels.xlsx`
const DEFAULT_CAPACITY = 30

interface StoredTemplate {
  name: string
  data: ArrayBuffer
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(DB_STORE, mode).objectStore(DB_STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

type Parsed = { files: Record<string, Uint8Array>; template: LabelTemplate }

function parse(data: ArrayBuffer): { ok: true; parsed: Parsed } | { ok: false; error: TemplateError } {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(data))
  } catch {
    return { ok: false, error: 'not-xlsx' }
  }
  const r = inspectLabelTemplate(files)
  return r.ok ? { ok: true, parsed: { files, template: r.template } } : r
}

/** Pictures are already compressed; everything else (XML, the embedded Word file) shrinks a lot. */
const zipLevel = (name: string) => (/\.(png|jpe?g|gif)$/i.test(name) ? 0 : 6)

export function useLabelTemplate() {
  const customName = ref<string | null>(null)
  const capacity = ref(DEFAULT_CAPACITY)
  let custom: Parsed | null = null
  let builtIn: Parsed | null = null

  /** Picks up a template saved in an earlier visit. */
  async function restore(): Promise<void> {
    try {
      const stored = await idb<StoredTemplate | undefined>('readonly', (s) => s.get(CUSTOM_KEY))
      const r = stored && parse(stored.data)
      if (r && r.ok) {
        custom = r.parsed
        customName.value = stored.name
        capacity.value = r.parsed.template.capacity
      }
    } catch {
      // No IndexedDB (private window…): the built-in template still works.
    }
  }

  /** Checks and keeps the user's own template. Returns an error code when the file cannot be used. */
  async function useCustom(file: File): Promise<TemplateError | 'too-large' | 'storage' | null> {
    if (file.size > MAX_TEMPLATE_BYTES) return 'too-large'
    const data = await file.arrayBuffer()
    const r = parse(data)
    if (!r.ok) return r.error
    custom = r.parsed
    customName.value = file.name
    capacity.value = r.parsed.template.capacity
    try {
      await idb('readwrite', (s) => s.put({ name: file.name, data } satisfies StoredTemplate, CUSTOM_KEY))
      return null
    } catch {
      // Usable now, but not remembered after closing the page.
      return 'storage'
    }
  }

  async function useBuiltIn(): Promise<void> {
    custom = null
    customName.value = null
    capacity.value = DEFAULT_CAPACITY
    try {
      await idb('readwrite', (s) => s.delete(CUSTOM_KEY))
    } catch {
      // Nothing stored.
    }
  }

  async function current(): Promise<Parsed> {
    if (custom) return custom
    if (!builtIn) {
      const res = await fetch(DEFAULT_URL)
      if (!res.ok) throw new Error(`template ${res.status}`)
      const r = parse(await res.arrayBuffer())
      if (!r.ok) throw new Error(r.error)
      builtIn = r.parsed
    }
    return builtIn
  }

  /** One .xlsx file for one label sheet. */
  async function build(labels: LabelText[]): Promise<Blob> {
    const { files, template } = await current()
    const filled = fillLabelWorkbook(files, template, labels)
    const zippable: Zippable = Object.fromEntries(Object.entries(filled).map(([name, data]) => [name, [data, { level: zipLevel(name) }]]))
    return new Blob([zipSync(zippable)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  return { customName, capacity, restore, useCustom, useBuiltIn, build }
}
