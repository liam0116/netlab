/**
 * Fills the cable-label Excel template (public/templates/cable-labels.xlsx) with label texts.
 *
 * The template is the label supplier's workbook, kept as is so it prints on the same label sheets:
 * - 填写表 (fill-in sheet): column A = FROM (this end), column B = TO (far end), one row per label from row 2.
 * - 打印表 (print sheet): formulas such as `=填写表!B2` place each label on an A4 sheet (5 × 6 = 30 labels).
 * - 打印机设置说明: the supplier's printer instructions (an embedded Word document).
 *
 * Only the label values change, so every file prints exactly like the template. More labels than one
 * sheet holds are exported as more files (the way the workbooks were already numbered: 線路標籤1, 2…).
 * A user may upload their own copy adjusted to their printer; it is read the same way.
 */

export interface LabelText {
  from: string
  to: string
}

export const MAX_LABEL_LENGTH = 80
export const FILL_SHEET_NAME = '填写表'
export const PRINT_SHEET_NAME = '打印表'
/** First fill-in row holding a label (row 1 is the FROM / TO header). */
const FIRST_FILL_ROW = 2

export type TemplateError = 'not-xlsx' | 'not-label-template'

export interface LabelTemplate {
  /** Paths of the parts that change. */
  fillSheet: string
  printSheet: string
  strings: string
  /** Labels per printed sheet: the fill-in rows the print sheet refers to. */
  capacity: number
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

const escapeXml = (s: string) =>
  s
    // Characters XML 1.0 cannot hold at all.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const unescapeXml = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** Formula references from the print sheet into the fill-in sheet, e.g. `填写表!B2` (quotes optional). */
const FORMULA = new RegExp(`<f>'?${FILL_SHEET_NAME}'?!\\$?([AB])\\$?(\\d+)</f>`)

/** Finds the fill-in / print sheets by name and works out how many labels one sheet holds. */
export function inspectLabelTemplate(files: Record<string, Uint8Array>): { ok: true; template: LabelTemplate } | { ok: false; error: TemplateError } {
  const read = (name: string) => (files[name] ? decoder.decode(files[name]) : null)
  const workbook = read('xl/workbook.xml')
  const rels = read('xl/_rels/workbook.xml.rels')
  if (!workbook || !rels) return { ok: false, error: 'not-xlsx' }
  const sheetPath = (name: string) => {
    const sheet = [...workbook.matchAll(/<sheet [^>]*?\/>/g)].map((m) => m[0]).find((s) => unescapeXml(/ name="([^"]*)"/.exec(s)?.[1] ?? '') === name)
    const rid = sheet && / r:id="([^"]+)"/.exec(sheet)?.[1]
    const rel = rid && [...rels.matchAll(/<Relationship [^>]*?\/>/g)].map((m) => m[0]).find((r) => r.includes(` Id="${rid}"`))
    const target = rel && / Target="([^"]+)"/.exec(rel)?.[1]
    return target ? (target.startsWith('/') ? target.slice(1) : `xl/${target}`) : null
  }
  const fillSheet = sheetPath(FILL_SHEET_NAME)
  const printSheet = sheetPath(PRINT_SHEET_NAME)
  const print = printSheet && read(printSheet)
  if (!fillSheet || !print || !read(fillSheet) || !read('xl/sharedStrings.xml')) return { ok: false, error: 'not-label-template' }
  const rows = [...print.matchAll(new RegExp(FORMULA.source, 'g'))].map((m) => Number(m[2]))
  if (!rows.length) return { ok: false, error: 'not-label-template' }
  return { ok: true, template: { fillSheet, printSheet, strings: 'xl/sharedStrings.xml', capacity: Math.max(...rows) - FIRST_FILL_ROW + 1 } }
}

/** Labels split into the label sheets they print on. */
export function labelSheets<T>(labels: T[], capacity: number): T[][] {
  const sheets: T[][] = []
  for (let i = 0; i < labels.length; i += capacity) sheets.push(labels.slice(i, i + capacity))
  return sheets
}

/**
 * The text written for one side of a label. An empty side becomes a single space: a formula pointing at
 * an empty cell prints "0" on the label.
 */
const cellText = (s: string | undefined) => (s ?? '').trim().slice(0, MAX_LABEL_LENGTH) || ' '

/** Shared strings: keeps the template's strings and appends new ones (deduplicated). */
class SharedStrings {
  private readonly index = new Map<string, number>()
  private readonly added: string[] = []
  private readonly base: number
  private readonly xml: string

  constructor(xml: string) {
    this.xml = xml
    const items = [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    this.base = items.length
    items.forEach((m, i) => {
      const plain = /^<t(?: xml:space="preserve")?>([^<]*)<\/t>(?:<phoneticPr [^>]*\/>)?$/.exec(m[1]!)
      if (plain && !this.index.has(unescapeXml(plain[1]!))) this.index.set(unescapeXml(plain[1]!), i)
    })
  }

  id(text: string): number {
    let i = this.index.get(text)
    if (i === undefined) {
      i = this.base + this.added.length
      this.index.set(text, i)
      this.added.push(text)
    }
    return i
  }

  serialize(newReferences: number): string {
    const items = this.added.map((s) => `<si><t${/^\s|\s$/.test(s) ? ' xml:space="preserve"' : ''}>${escapeXml(s)}</t></si>`).join('')
    const total = this.base + this.added.length
    let xml = this.xml.replace(/<sst\b([^>]*)>/, (_, attrs: string) => {
      const count = Number(/ count="(\d+)"/.exec(attrs)?.[1] ?? total)
      const rest = attrs.replace(/ (?:count|uniqueCount)="\d+"/g, '')
      return `<sst${rest} count="${count + newReferences}" uniqueCount="${total}">`
    })
    xml = xml.includes('</sst>') ? xml.replace('</sst>', `${items}</sst>`) : xml.replace(/<sst\b([^>]*?)\/>/, `<sst$1>${items}</sst>`)
    return xml
  }
}

/** Sets or replaces the `t` attribute of a cell's opening tag. */
const withType = (open: string, type: string) => (/ t="[^"]*"/.test(open) ? open.replace(/ t="[^"]*"/, ` t="${type}"`) : open.replace(/>$/, ` t="${type}">`))

/**
 * Returns the template's files with up to one sheet of labels filled in (extra labels are ignored; see
 * `labelSheets`). `files` are the unzipped template parts; only the two sheets and the shared strings
 * change, every other part (styles, page setup, printer settings, the instructions) is returned as is.
 */
export function fillLabelWorkbook(files: Record<string, Uint8Array>, template: LabelTemplate, labels: LabelText[]): Record<string, Uint8Array> {
  const text = (name: string) => decoder.decode(files[name])
  const lastRow = FIRST_FILL_ROW + template.capacity - 1
  const side = (col: string, row: number) => {
    const label = row >= FIRST_FILL_ROW && row <= lastRow ? labels[row - FIRST_FILL_ROW] : undefined
    return cellText(col === 'A' ? label?.from : label?.to)
  }

  // Fill-in sheet: the A / B cells of the label rows become strings; their style stays.
  const strings = new SharedStrings(text(template.strings))
  let references = 0
  const fill = text(template.fillSheet).replace(/<c r="([AB])(\d+)"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g, (cell, col: string, row: string, attrs: string) => {
    const r = Number(row)
    if (r < FIRST_FILL_ROW || r > lastRow) return cell
    references++
    const style = / s="\d+"/.exec(attrs)?.[0] ?? ''
    return `<c r="${col}${r}"${style} t="s"><v>${strings.id(side(col, r))}</v></c>`
  })

  // Print sheet: formulas stay; the cached value is what viewers that do not recalculate (phones,
  // Numbers, a print before Excel recalculates) show.
  const print = text(template.printSheet).replace(/(<c [^>]*?>)(<f>[^<]*<\/f>)(?:<v>[^<]*<\/v>)?<\/c>/g, (cell, open: string, formula: string) => {
    const ref = FORMULA.exec(formula)
    return ref ? `${withType(open, 'str')}${formula}<v>${escapeXml(side(ref[1]!, Number(ref[2])))}</v></c>` : cell
  })

  return {
    ...files,
    [template.fillSheet]: encoder.encode(fill),
    [template.strings]: encoder.encode(strings.serialize(references)),
    [template.printSheet]: encoder.encode(print),
  }
}
