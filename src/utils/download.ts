/** Saves text as a file in the browser. `bom` helps Excel open UTF-8 CSV (e.g. Chinese names) correctly. */
export function downloadText(filename: string, text: string, mime: string, bom = false): void {
  downloadBlob(filename, new Blob([bom ? '﻿' : '', text], { type: `${mime};charset=utf-8` }))
}

/** Saves any file (e.g. a generated .xlsx) in the browser. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** A filesystem-friendly slug for export file names. */
export function slugify(text: string, fallback = 'ip-plan'): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}
