import { describe, expect, it } from 'vitest'
import zhTW from './locales/zh-TW'
import en from './locales/en'
import { detectLocale, i18n, SUPPORTED_LOCALES } from '.'
import { commandTexts, portDescriptions, troubleshootingTexts, tutorialContent } from './content'
import { COMMAND_CATEGORIES, LINUX_COMMANDS } from '@/data/linuxCommands'
import { PORTS } from '@/data/ports'
import { TROUBLE_STEPS } from '@/data/troubleshooting'
import { chapterDefs } from '@/data/tutorials'
import { allNavItems, dashboardItem, navSections } from '@/data/navigation'
import { buildChapters } from '@/composables/useTutorials'

type Tree = { [key: string]: string | string[] | Tree }

/** Flattens a message tree into "a.b.c" → value. */
function leaves(tree: Tree, prefix = ''): Map<string, string | string[]> {
  const out = new Map<string, string | string[]>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string' || Array.isArray(value)) out.set(path, value)
    else for (const [k, v] of leaves(value, path)) out.set(k, v)
  }
  return out
}

const locales: Record<string, Tree> = { 'zh-TW': zhTW, en }

describe('locale messages', () => {
  it('every locale has exactly the same keys and array lengths', () => {
    const base = leaves(zhTW)
    for (const [code, messages] of Object.entries(locales)) {
      const other = leaves(messages)
      expect([...other.keys()].sort(), code).toEqual([...base.keys()].sort())
      for (const [key, value] of base) {
        if (Array.isArray(value)) expect((other.get(key) as string[]).length, `${code} ${key}`).toBe(value.length)
      }
    }
  })

  it('no message is empty or uses vue-i18n special characters by accident', () => {
    for (const [code, messages] of Object.entries(locales)) {
      for (const [key, value] of leaves(messages)) {
        for (const text of Array.isArray(value) ? value : [value]) {
          expect(text.trim(), `${code} ${key}`).not.toBe('')
          // `|` is the plural separator and `@` starts a linked message in vue-i18n.
          expect(text, `${code} ${key}`).not.toMatch(/[|@]/)
        }
      }
    }
  })

  it('every message compiles and renders without leftover placeholders', () => {
    const params = { n: 1, phase: 2, ready: 3, total: 4, octet: 1, mask: 2, count: 3, value: 4, range: '0-31', network: 'x', broadcast: 'y', a: 1, b: 2, local: 'A', remote: 'B', gateway: 'g', address: 'z', steps: 1, quiz: 1, title: 't', terms: 't', binary: '1', cidr: 1, bits: 1, hosts: 1, target: 't', block: 1, first: 'f', last: 'l' }
    for (const { code } of SUPPORTED_LOCALES) {
      i18n.global.locale.value = code
      for (const [key, value] of leaves(locales[code]!)) {
        if (Array.isArray(value)) continue
        const out = i18n.global.t(key, params)
        expect(out, `${code} ${key}`).not.toBe(key)
        expect(out, `${code} ${key}`).not.toMatch(/\{\w+\}/)
      }
    }
    i18n.global.locale.value = 'zh-TW'
  })

  it('every nav item and section has localized text', () => {
    for (const messages of Object.values(locales)) {
      const items = (messages.nav as Tree).items as Tree
      for (const item of [dashboardItem, ...allNavItems]) {
        const entry = items[item.id] as Tree | undefined
        expect(entry?.name, item.id).toBeTruthy()
        expect(entry?.short, item.id).toBeTruthy()
        if (item.id !== 'dashboard') {
          expect(entry?.what, item.id).toBeTruthy()
          expect(entry?.when, item.id).toBeTruthy()
        }
        // Features that are not built yet must describe what is planned.
        if (!item.to) expect((entry?.planned as string[] | undefined)?.length, item.id).toBeGreaterThan(0)
      }
      for (const section of navSections) expect((messages.sections as Tree)[section.id], section.id).toBeTruthy()
    }
  })

  it('detects the starting locale from the browser languages', () => {
    expect(detectLocale(['zh-TW'])).toBe('zh-TW')
    expect(detectLocale(['zh-HK', 'en'])).toBe('zh-TW')
    expect(detectLocale(['en-US'])).toBe('en')
    expect(detectLocale(['fr-FR', 'en-GB'])).toBe('en')
    expect(detectLocale([])).toBe('zh-TW')
  })
})

describe('tutorial content', () => {
  it('has 20 chapters numbered in order with unique ids', () => {
    expect(chapterDefs).toHaveLength(20)
    expect(chapterDefs.map((c) => c.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(new Set(chapterDefs.map((c) => c.id)).size).toBe(20)
  })

  it.each(SUPPORTED_LOCALES.map((l) => l.code))('%s: text lines up with every chapter definition', (code) => {
    const texts = tutorialContent[code]
    expect(Object.keys(texts).sort()).toEqual(chapterDefs.map((c) => c.id).sort())
    for (const def of chapterDefs) {
      const text = texts[def.id]!
      expect(text.steps.length, `${code} ${def.id}`).toBe(def.visuals.length)
      for (const step of text.steps) {
        expect(step.title.trim(), `${code} ${def.id}`).not.toBe('')
        expect(step.body.length, `${code} ${def.id} ${step.title}`).toBeGreaterThan(0)
      }
    }
  })

  it('every chapter has steps, a visual per step, and working quizzes in every language', () => {
    for (const { code } of SUPPORTED_LOCALES) {
      i18n.global.locale.value = code
      for (const c of buildChapters(code)) {
        expect(c.steps.length, c.id).toBeGreaterThan(1)
        expect(c.quiz.length, c.id).toBeGreaterThan(0)
        expect(c.steps.every((s) => s.visual), c.id).toBe(true)
        for (const factory of c.quiz) {
          const q = factory((key, params) => i18n.global.t(key, params ?? {}))
          expect([q.prompt, q.explanation, ...q.options].join(' '), `${code} ${c.id}`).not.toMatch(/quiz(Static)?\.[a-zA-Z]/)
          expect(new Set(q.options).size, `${code} ${c.id}`).toBe(4)
        }
      }
    }
    i18n.global.locale.value = 'zh-TW'
  })
})

describe('reference content', () => {
  it.each(SUPPORTED_LOCALES.map((l) => l.code))('%s: every Linux command has complete text', (code) => {
    const texts = commandTexts[code]
    expect(Object.keys(texts).sort()).toEqual(LINUX_COMMANDS.map((c) => c.id).sort())
    for (const c of LINUX_COMMANDS) {
      const text = texts[c.id]!
      for (const field of [text.purpose, text.normal, text.abnormal]) expect(field.trim(), `${code} ${c.id}`).not.toBe('')
      expect(text.issues.length, `${code} ${c.id}`).toBeGreaterThan(0)
    }
  })

  it('Linux commands: unique ids and every spec category and network command covered', () => {
    expect(new Set(LINUX_COMMANDS.map((c) => c.id)).size).toBe(LINUX_COMMANDS.length)
    for (const cat of COMMAND_CATEGORIES) expect(LINUX_COMMANDS.some((c) => c.category === cat), cat).toBe(true)
    const network = LINUX_COMMANDS.filter((c) => c.category === 'network').map((c) => c.name)
    for (const name of ['ip addr', 'ip link', 'ip route', 'ip neigh', 'ping', 'traceroute', 'tracepath', 'ss', 'dig', 'nslookup', 'ethtool', 'nmcli', 'tcpdump']) {
      expect(network, name).toContain(name)
    }
  })

  it.each(SUPPORTED_LOCALES.map((l) => l.code))('%s: every port has a description', (code) => {
    expect(Object.keys(portDescriptions[code]).sort()).toEqual(PORTS.map((p) => p.id).sort())
  })

  it.each(SUPPORTED_LOCALES.map((l) => l.code))('%s: troubleshooting covers every step and diagnosis', (code) => {
    const text = troubleshootingTexts[code]
    expect(Object.keys(text.steps).sort()).toEqual(TROUBLE_STEPS.map((s) => s.id).sort())
    expect(Object.keys(text.diagnoses).sort()).toEqual([...TROUBLE_STEPS.map((s) => s.id), 'ok'].sort())
    for (const d of Object.values(text.diagnoses)) {
      expect(d.causes.length).toBeGreaterThan(0)
      expect(d.next.length).toBeGreaterThan(0)
    }
  })

  it('troubleshooting follows the spec order and gateway diagnosis', () => {
    expect(TROUBLE_STEPS.map((s) => s.command.split(' ').slice(0, 2).join(' '))).toEqual([
      'ip link',
      'ip -4',
      'ip route',
      'ping -c',
      'ping -c',
      'dig google.com',
    ])
    expect(troubleshootingTexts.en.diagnoses.gateway!.causes).toEqual(['NIC', 'Cable', 'Switch', 'VLAN', 'IP', 'Subnet Mask'])
    expect(troubleshootingTexts.en.diagnoses.public!.causes.join(' ')).toMatch(/Routing.*Firewall.*NAT.*ISP/)
  })
})
