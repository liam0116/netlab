import { describe, expect, it } from 'vitest'
import { defaultPattern, expandRange, generateLabels, labelsFromCables, parsePasted, sheetFileName, splitList } from './cableLabels'

describe('expandRange', () => {
  it('expands numbered ranges with or without the repeated prefix', () => {
    expect(expandRange('P1-4')).toEqual(['P1', 'P2', 'P3', 'P4'])
    expect(expandRange('PS1-PS2')).toEqual(['PS1', 'PS2'])
    expect(expandRange('S3P1-2')).toEqual(['S3P1', 'S3P2'])
    expect(expandRange('Gi1/0/1-3')).toEqual(['Gi1/0/1', 'Gi1/0/2', 'Gi1/0/3'])
  })
  it('keeps zero padding', () => {
    expect(expandRange('esx01-03')).toEqual(['esx01', 'esx02', 'esx03'])
    expect(expandRange('PeoEsxi09-11')).toEqual(['PeoEsxi09', 'PeoEsxi10', 'PeoEsxi11'])
  })
  it('leaves names that only look like ranges alone', () => {
    expect(expandRange('C1-MG')).toEqual(['C1-MG'])
    expect(expandRange('a1-b4')).toEqual(['a1-b4'])
    expect(expandRange('P4-1')).toEqual(['P4-1'])
    expect(expandRange('iDrac')).toEqual(['iDrac'])
    expect(expandRange('P1-99999')).toEqual(['P1-99999'])
  })
})

describe('splitList', () => {
  it('splits on commas, spaces and new lines', () => {
    expect(splitList('PS1, PS2 OCP1-2\niDrac，S3P1')).toEqual(['PS1', 'PS2', 'OCP1', 'OCP2', 'iDrac', 'S3P1'])
  })
})

describe('generateLabels', () => {
  it('makes two identical labels per cable by default, like the supplier sheet', () => {
    const labels = generateLabels({ ...defaultPattern(), devices: 'PeoEsxi21', ports: 'PS1-2' })
    expect(labels.map((l) => l.from)).toEqual(['PeoEsxi21_PS1', 'PeoEsxi21_PS1', 'PeoEsxi21_PS2', 'PeoEsxi21_PS2'])
    expect(labels.every((l) => l.to === l.from)).toBe(true)
  })
  it('marks the two ends with L / R, 1 / 2 …', () => {
    const p = { ...defaultPattern(), devices: 'esx01', ports: 'vmnic0', endMark: 'LR' as const }
    expect(generateLabels(p).map((l) => l.from)).toEqual(['esx01_vmnic0_L', 'esx01_vmnic0_R'])
    expect(generateLabels({ ...p, endMark: '12', separator: '-' }).map((l) => l.from)).toEqual(['esx01-vmnic0-1', 'esx01-vmnic0-2'])
  })
  it('handles several devices, one copy, letter case and an empty TO', () => {
    const labels = generateLabels({ ...defaultPattern(), devices: 'esx01-02', ports: 'ps1', copies: 1, letterCase: 'upper', toSameAsFrom: false })
    expect(labels).toEqual([
      { from: 'ESX01_PS1', to: '' },
      { from: 'ESX02_PS1', to: '' },
    ])
  })
  it('works with only a device or only ports, and nothing for empty input', () => {
    expect(generateLabels({ ...defaultPattern(), devices: 'SAN01', copies: 1 }).map((l) => l.from)).toEqual(['SAN01'])
    expect(generateLabels({ ...defaultPattern(), ports: 'P1', copies: 1 }).map((l) => l.from)).toEqual(['P1'])
    expect(generateLabels(defaultPattern())).toEqual([])
  })
  it('keeps device names with spaces whole', () => {
    expect(generateLabels({ ...defaultPattern(), devices: 'Core SW', ports: 'P1', copies: 1 })[0]!.from).toBe('Core SW_P1')
  })
})

describe('parsePasted', () => {
  it('reads FROM and TO columns copied from Excel', () => {
    expect(parsePasted('a\tb\n\nc\n', true)).toEqual([
      { from: 'a', to: 'b' },
      { from: 'c', to: 'c' },
    ])
    expect(parsePasted('c', false)).toEqual([{ from: 'c', to: '' }])
  })
})

describe('labelsFromCables', () => {
  it('puts each end first on its own label', () => {
    expect(labelsFromCables([{ aName: 'esx01', aPort: 'vmnic0', bName: 'leaf01', bPort: 'Eth1/1' }], '_', 'keep')).toEqual([
      { from: 'esx01_vmnic0', to: 'leaf01_Eth1/1' },
      { from: 'leaf01_Eth1/1', to: 'esx01_vmnic0' },
    ])
  })
})

describe('sheetFileName', () => {
  it('names the file after the devices on the sheet', () => {
    const labels = [
      { from: 'PeoStor_PS1', to: '' },
      { from: 'PeoStor_PS2', to: '' },
      { from: 'PeoEsxi21_PS1', to: '' },
    ]
    expect(sheetFileName('線路標籤', 1, labels)).toBe('線路標籤1_PeoStor_PeoEsxi21.xlsx')
  })
  it('shortens long lists and removes characters files cannot hold', () => {
    const labels = ['a_1', 'b_1', 'c_1', 'd_1'].map((from) => ({ from, to: '' }))
    expect(sheetFileName('L', 2, labels)).toBe('L2_a_b_c_etc.xlsx')
    expect(sheetFileName('A/B:', 1, [])).toBe('A-B-1.xlsx')
  })
  it('keeps device names with other symbols whole and follows the chosen separator', () => {
    expect(sheetFileName('L', 1, [{ from: 'fc-sw01_P1', to: '' }])).toBe('L1_fc-sw01.xlsx')
    expect(sheetFileName('L', 1, [{ from: 'esx01-PS1', to: '' }], '-')).toBe('L1_esx01.xlsx')
  })
})
