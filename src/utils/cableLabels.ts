/**
 * Builds cable label texts such as `PeoEsxi21_PS2` or `esx01_vmnic0_L` from a device name and its ports.
 * Every site names labels its own way, so the pattern only fills a list that is then edited by hand.
 */
import type { LabelText } from './labelWorkbook'

/** How the two labels of one cable (one at each end) are told apart. */
export type EndMark = 'none' | 'LR' | 'lr' | '12' | 'AB'
export type LabelCase = 'keep' | 'upper' | 'lower'

export interface LabelPattern {
  /** One or more devices, comma / newline separated; `esx01-04` expands to esx01 … esx04. */
  devices: string
  /** Ports, comma / space / newline separated; `P1-4` or `P1-P4` expands to P1 … P4. */
  ports: string
  separator: string
  /** Labels per cable: 2 = one for each end (the usual), 1 = a single label. */
  copies: 1 | 2
  endMark: EndMark
  letterCase: LabelCase
  /** TO column: the same text as FROM (one name per cable), or left empty. */
  toSameAsFrom: boolean
}

export const END_MARKS: EndMark[] = ['none', 'LR', 'lr', '12', 'AB']
export const MAX_GENERATED = 600

const MARKS: Record<EndMark, [string, string]> = { none: ['', ''], LR: ['L', 'R'], lr: ['l', 'r'], '12': ['1', '2'], AB: ['A', 'B'] }

export const defaultPattern = (): LabelPattern => ({
  devices: '',
  ports: '',
  separator: '_',
  copies: 2,
  endMark: 'none',
  letterCase: 'keep',
  toSameAsFrom: true,
})

/**
 * Expands a numbered range: `P1-4`, `P1-P4`, `esx01-04` (zero padding kept), `S3P1-2`.
 * Anything else is returned as is, so names such as `C1-MG` are not mistaken for ranges.
 */
export function expandRange(token: string, limit = MAX_GENERATED): string[] {
  const m = /^(.*?)(\d+)-(.*?)(\d+)$/.exec(token)
  // The end may repeat the prefix (P1-P4) or leave it out (P1-4); anything else (a1-b4) is a plain name.
  if (!m || (m[3] !== '' && m[3] !== m[1])) return [token]
  const [, prefix, startText, , endText] = m as unknown as [string, string, string, string, string]
  const start = Number(startText)
  const end = Number(endText)
  if (end < start || end - start >= limit) return [token]
  const pad = startText.length > 1 && startText.startsWith('0') ? startText.length : 0
  return Array.from({ length: end - start + 1 }, (_, i) => `${prefix}${String(start + i).padStart(pad, '0')}`)
}

/** Splits a list typed or pasted by hand and expands ranges in it. */
export function splitList(text: string, separators = /[\n,，;；\t ]+/): string[] {
  return text
    .split(separators)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => expandRange(s))
}

const applyCase = (s: string, c: LabelCase) => (c === 'upper' ? s.toUpperCase() : c === 'lower' ? s.toLowerCase() : s)

/** Joins name parts with the separator, skipping empty parts. */
export const joinName = (parts: string[], separator: string, letterCase: LabelCase = 'keep') =>
  applyCase(parts.filter(Boolean).join(separator), letterCase)

export function generateLabels(p: LabelPattern): LabelText[] {
  // Device names may contain spaces, so only commas / newlines separate them.
  const devices = splitList(p.devices, /[\n,，;；]+/)
  const ports = splitList(p.ports)
  const out: LabelText[] = []
  for (const device of devices.length ? devices : ['']) {
    for (const port of ports.length ? ports : ['']) {
      if (!device && !port) continue
      for (let end = 0; end < p.copies; end++) {
        const mark = p.copies === 2 ? MARKS[p.endMark][end]! : ''
        const from = joinName([device, port, mark], p.separator, p.letterCase)
        out.push({ from, to: p.toSameAsFrom ? from : '' })
        if (out.length >= MAX_GENERATED) return out
      }
    }
  }
  return out
}

/**
 * Pasted rows (e.g. copied from Excel): `FROM<tab>TO` per line. A line with a single column uses the
 * same text for TO when `toSameAsFrom` is set.
 */
export function parsePasted(text: string, toSameAsFrom: boolean): LabelText[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((s) => s.trim()))
    .filter((cols) => cols.some(Boolean))
    .slice(0, MAX_GENERATED)
    .map(([from = '', to]) => ({ from, to: to ?? (toSameAsFrom ? from : '') }))
}

/** Two labels per cable from the project's cabling list: each end shows its own port first. */
export function labelsFromCables(
  cables: { aName: string; aPort: string; bName: string; bPort: string }[],
  separator: string,
  letterCase: LabelCase,
): LabelText[] {
  return cables.flatMap((c) => {
    const a = joinName([c.aName, c.aPort], separator, letterCase)
    const b = joinName([c.bName, c.bPort], separator, letterCase)
    return [
      { from: a, to: b },
      { from: b, to: a },
    ]
  })
}

/**
 * File name for one label sheet, the way the workbooks were named by hand: `線路標籤1_PeoStor_PeoEsxi21`
 * (prefix + sheet number + the devices on that sheet, i.e. each label up to the first separator, so a
 * device such as `fc-sw01` stays whole with the `_` separator).
 */
export function sheetFileName(prefix: string, sheetNumber: number, labels: LabelText[], separator = '_', maxDevices = 3): string {
  const device = (text: string) => (separator ? text.split(separator)[0]! : text).trim()
  const devices = [...new Set(labels.map((l) => device(l.from)).filter(Boolean))]
  const shown = devices.slice(0, maxDevices)
  const name = [`${prefix}${sheetNumber}`, ...shown].join('_') + (devices.length > maxDevices ? '_etc' : '')
  return `${name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 120)}.xlsx`
}
