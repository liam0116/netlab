/** Validation for numeric form fields: the text the user typed → a number within limits, or why not. */
export interface NumberLimits {
  min: number
  max: number
  /** Whole numbers only (U, counts, PSUs). */
  integer?: boolean
}

export type NumberError = 'empty' | 'not-number' | 'not-integer' | 'range'

export function parseNumberInput(text: string, limits: NumberLimits): { ok: true; value: number } | { ok: false; error: NumberError } {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, error: 'empty' }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { ok: false, error: 'not-number' }
  if (limits.integer && !Number.isInteger(value)) return { ok: false, error: 'not-integer' }
  if (value < limits.min || value > limits.max) return { ok: false, error: 'range' }
  return { ok: true, value }
}
