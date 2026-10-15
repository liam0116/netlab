import { describe, expect, it } from 'vitest'
import { parseNumberInput } from './numberInput'

describe('number input', () => {
  const heightU = { min: 1, max: 60, integer: true }
  it('accepts values in range', () => {
    expect(parseNumberInput('42', heightU)).toEqual({ ok: true, value: 42 })
    expect(parseNumberInput(' 1 ', heightU)).toEqual({ ok: true, value: 1 })
    expect(parseNumberInput('2.5', { min: 0, max: 10 })).toEqual({ ok: true, value: 2.5 })
  })
  it('rejects zero, negatives, empty, decimals and garbage', () => {
    expect(parseNumberInput('0', heightU)).toEqual({ ok: false, error: 'range' })
    expect(parseNumberInput('-5', heightU)).toEqual({ ok: false, error: 'range' })
    expect(parseNumberInput('61', heightU)).toEqual({ ok: false, error: 'range' })
    expect(parseNumberInput('', heightU)).toEqual({ ok: false, error: 'empty' })
    expect(parseNumberInput('42.5', heightU)).toEqual({ ok: false, error: 'not-integer' })
    expect(parseNumberInput('abc', heightU)).toEqual({ ok: false, error: 'not-number' })
    expect(parseNumberInput('Infinity', heightU)).toEqual({ ok: false, error: 'not-number' })
  })
})
