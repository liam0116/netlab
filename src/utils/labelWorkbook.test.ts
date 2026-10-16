/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { fillLabelWorkbook, inspectLabelTemplate, labelSheets, type LabelTemplate, type LabelText } from './labelWorkbook'

const template = unzipSync(new Uint8Array(readFileSync('public/templates/cable-labels.xlsx')))
const text = (files: Record<string, Uint8Array>, name: string) => new TextDecoder().decode(files[name])
const inspected = inspectLabelTemplate(template)
if (!inspected.ok) throw new Error('template not readable')
const tpl: LabelTemplate = inspected.template
const fillWith = (l: LabelText[]) => fillLabelWorkbook(template, tpl, l)
const labels = (n: number): LabelText[] => Array.from({ length: n }, (_, i) => ({ from: `F${i + 1}`, to: `T${i + 1}` }))

/** The shared string a fill-in cell points at. */
function fillCell(files: Record<string, Uint8Array>, ref: string): string | null {
  const m = new RegExp(`<c r="${ref}"[^>]*t="s"><v>(\\d+)</v></c>`).exec(text(files, 'xl/worksheets/sheet1.xml'))
  if (!m) return null
  const items = [...text(files, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((x) => x[1]!.replace(/<phoneticPr[^>]*\/>/, ''))
  return items[Number(m[1])]!.replace(/^<t[^>]*>|<\/t>$/g, '')
}
const printCell = (files: Record<string, Uint8Array>, ref: string) =>
  new RegExp(`<c r="${ref}"[^>]*><f>([^<]+)</f><v>([^<]*)</v></c>`).exec(text(files, 'xl/worksheets/sheet2.xml'))?.slice(1)

const encode = (s: string) => new TextEncoder().encode(s)

describe('inspectLabelTemplate', () => {
  it('finds the sheets by name and counts 30 labels per sheet', () => {
    expect(tpl).toEqual({ fillSheet: 'xl/worksheets/sheet1.xml', printSheet: 'xl/worksheets/sheet2.xml', strings: 'xl/sharedStrings.xml', capacity: 30 })
  })
  it('rejects files that are not the label template', () => {
    expect(inspectLabelTemplate({})).toEqual({ ok: false, error: 'not-xlsx' })
    const renamed = { ...template, 'xl/workbook.xml': encode(text(template, 'xl/workbook.xml').replace('name="打印表"', 'name="Sheet2"')) }
    expect(inspectLabelTemplate(renamed)).toEqual({ ok: false, error: 'not-label-template' })
    const noFormulas = { ...template, 'xl/worksheets/sheet2.xml': encode(text(template, 'xl/worksheets/sheet2.xml').replace(/<f>[^<]*<\/f>/g, '')) }
    expect(inspectLabelTemplate(noFormulas)).toEqual({ ok: false, error: 'not-label-template' })
  })
  it('reads a larger template (e.g. the supplier original with more pages)', () => {
    const bigger = { ...template, 'xl/worksheets/sheet2.xml': encode(text(template, 'xl/worksheets/sheet2.xml').replace('<f>填写表!B31</f>', '<f>填写表!B151</f>')) }
    const r = inspectLabelTemplate(bigger)
    expect(r.ok && r.template.capacity).toBe(150)
  })
})

describe('labelSheets', () => {
  it('splits labels into sheets', () => {
    expect(labelSheets(labels(61), 30).map((s) => s.length)).toEqual([30, 30, 1])
    expect(labelSheets([], 30)).toEqual([])
  })
})

describe('fillLabelWorkbook', () => {
  it('fills FROM / TO on the fill-in sheet', () => {
    const out = fillWith(labels(30))
    expect(fillCell(out, 'A2')).toBe('F1')
    expect(fillCell(out, 'B2')).toBe('T1')
    expect(fillCell(out, 'A31')).toBe('F30')
    expect(fillCell(out, 'B31')).toBe('T30')
  })

  it('writes a space on unused or empty sides, so the label does not print 0', () => {
    const out = fillWith([{ from: 'esx01_PS1', to: '' }])
    expect(fillCell(out, 'B2')).toBe(' ')
    expect(fillCell(out, 'A3')).toBe(' ')
    expect(printCell(out, 'C1')).toEqual(['填写表!B2', ' '])
    expect(printCell(out, 'E1')).toEqual(['填写表!A2', 'esx01_PS1'])
  })

  it('keeps the print sheet formulas and caches each label text', () => {
    const out = fillWith(labels(30))
    expect(printCell(out, 'C1')).toEqual(['填写表!B2', 'T1'])
    expect(printCell(out, 'E1')).toEqual(['填写表!A2', 'F1'])
    expect(printCell(out, 'AC1')).toEqual(['填写表!A6', 'F5'])
    expect(printCell(out, 'A3')).toEqual(['填写表!A7', 'F6'])
    expect(printCell(out, 'Z11')).toEqual(['填写表!B31', 'T30'])
    expect(text(out, 'xl/worksheets/sheet2.xml').match(/<f>/g)).toHaveLength(60)
  })

  it('changes nothing else in the template', () => {
    const out = fillWith(labels(5))
    expect(Object.keys(out)).toEqual(Object.keys(template))
    for (const name of Object.keys(template).filter((n) => !['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/sharedStrings.xml'].includes(n))) {
      expect(out[name], name).toBe(template[name])
    }
    // Header, supplier notes and the "第 一 张" marker are still there.
    expect(fillCell(out, 'A1')).toBe('FROM:本端  (請依序輸入內容)')
    expect(fillCell(out, 'D1')).toContain('打印表格不能够有任何改动')
    expect(fillCell(out, 'C16')).toBe('一')
    // Only the label cells differ from the template on both sheets.
    const strip = (s: string) => s.replace(/<c r="[AB](?:[2-9]|[12]\d|3[01])"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, '').replace(/<v>[^<]*<\/v>/g, '')
    expect(strip(text(out, 'xl/worksheets/sheet1.xml'))).toBe(strip(text(template, 'xl/worksheets/sheet1.xml')))
    expect(text(out, 'xl/worksheets/sheet2.xml').replace(/<v>[^<]*<\/v>/g, '')).toBe(text(template, 'xl/worksheets/sheet2.xml'))
  })

  it('uses only the first 30 labels', () => {
    const out = fillWith(labels(31))
    expect(fillCell(out, 'A31')).toBe('F30')
    expect(text(out, 'xl/sharedStrings.xml')).not.toContain('F31')
  })

  it('escapes text, trims it and limits its length', () => {
    const out = fillWith([{ from: '  A&B <x> "q" ', to: 'y'.repeat(200) }])
    expect(text(out, 'xl/sharedStrings.xml')).toContain('<t>A&amp;B &lt;x&gt; &quot;q&quot;</t>')
    expect(fillCell(out, 'B2')).toHaveLength(80)
    expect(printCell(out, 'E1')![1]).toBe('A&amp;B &lt;x&gt; &quot;q&quot;')
  })

  it('fills a copy re-saved by Excel (inline strings, formulas without a cached type)', () => {
    const resaved = {
      ...template,
      'xl/worksheets/sheet1.xml': encode(text(template, 'xl/worksheets/sheet1.xml').replace('<c r="A2" s="14"/>', '<c r="A2" s="14" t="inlineStr"><is><t>old</t></is></c>')),
      'xl/worksheets/sheet2.xml': encode(text(template, 'xl/worksheets/sheet2.xml').replace('<c r="E1" s="18" t="str"><f>填写表!A2</f></c>', '<c r="E1" s="18"><f>填写表!$A$2</f><v>old</v></c>')),
    }
    const r = inspectLabelTemplate(resaved)
    if (!r.ok) throw new Error('not readable')
    const out = fillLabelWorkbook(resaved, r.template, [{ from: 'new', to: 'x' }])
    expect(fillCell(out, 'A2')).toBe('new')
    expect(text(out, 'xl/worksheets/sheet2.xml')).toContain('<c r="E1" s="18" t="str"><f>填写表!$A$2</f><v>new</v></c>')
  })

  it('updates the shared string counts', () => {
    const out = fillWith(labels(30))
    const sst = text(out, 'xl/sharedStrings.xml')
    const unique = Number(/uniqueCount="(\d+)"/.exec(sst)![1])
    expect(sst.match(/<si>/g)).toHaveLength(unique)
  })
})
