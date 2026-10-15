import { describe, expect, it } from 'vitest'
import * as quiz from './quiz'
import { calculateSubnet, isValidIPv4, maskToCidr, parseCidrNotation, validateMask } from './network'
import { describeMac } from './mac'
import { formatRoute, lookupRoute, parseIpRoute } from './routing'
import { PORTS } from '@/data/ports'
import zhTW from '@/i18n/locales/zh-TW'
import { i18n, SUPPORTED_LOCALES, translate } from '@/i18n'
import type { QuizFactory } from '@/types/tutorial'

// `staticQuiz` builds factories rather than being one; it is tested separately below.
const factories = Object.entries(quiz).filter(([name]) => name.endsWith('Quiz') && name !== 'staticQuiz') as [string, QuizFactory][]
const RUNS = 2000
const ask = (factory: QuizFactory) => factory(translate)

/** Pulls the "a.b.c.d/nn" target out of a prompt, independent of the language around it. */
function promptTarget(prompt: string): { ip: string; cidr: number } {
  const match = /(\d+\.\d+\.\d+\.\d+\/\d+)/.exec(prompt)
  const parsed = match ? parseCidrNotation(match[1]!) : null
  if (!parsed) throw new Error(`No ip/cidr in prompt: ${prompt}`)
  return parsed
}

describe('quiz generators', () => {
  it.each(factories)('%s always yields 4 unique options with a valid answer', (_, factory) => {
    for (let i = 0; i < RUNS; i++) {
      const q = ask(factory)
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.answer).toBeGreaterThanOrEqual(0)
      expect(q.answer).toBeLessThan(4)
    }
  })

  it.each(SUPPORTED_LOCALES.map((l) => l.code))('%s: prompts and explanations are fully translated', (locale) => {
    i18n.global.locale.value = locale
    for (const [, factory] of factories) {
      const q = ask(factory)
      expect(q.prompt).not.toMatch(/quiz\.q\./)
      expect(q.explanation).not.toMatch(/quiz\.q\.|\{\w+\}/)
    }
    i18n.global.locale.value = 'zh-TW'
  })

  it('decimal → binary answer is correct', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = ask(quiz.decimalToBinaryQuiz)
      const n = Number(/\d+/.exec(q.prompt)![0])
      expect(parseInt(q.options[q.answer]!, 2)).toBe(n)
    }
  })

  it('valid / private IP answers are what they claim', () => {
    for (let i = 0; i < RUNS; i++) {
      const v = ask(quiz.validIpQuiz)
      expect(v.options.filter(isValidIPv4)).toEqual([v.options[v.answer]])
      const p = ask(quiz.privateIpQuiz)
      const privates = p.options.filter((ip) => isValidIPv4(ip) && calculateSubnet(ip, 32).addressType === 'Private')
      expect(privates).toEqual([p.options[p.answer]])
    }
  })

  it('invalid mask question has exactly one invalid mask', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = ask(quiz.invalidMaskQuiz)
      expect(q.options.filter((m) => validateMask(m) !== null)).toEqual([q.options[q.answer]])
    }
  })

  it('mask → cidr answer is correct', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = ask(quiz.maskToCidrQuiz)
      const mask = /\d+\.\d+\.\d+\.\d+/.exec(q.prompt)![0]
      expect(q.options[q.answer]).toBe(`/${maskToCidr(mask)}`)
    }
  })

  it('network / broadcast answers match calculateSubnet', () => {
    for (let i = 0; i < RUNS; i++) {
      const n = ask(quiz.networkAddressQuiz)
      const pn = promptTarget(n.prompt)
      expect(n.options[n.answer]).toBe(calculateSubnet(pn.ip, pn.cidr).networkAddress)

      const b = ask(quiz.broadcastAddressQuiz)
      const pb = promptTarget(b.prompt)
      expect(b.options[b.answer]).toBe(calculateSubnet(pb.ip, pb.cidr).broadcastAddress)
    }
  })

  it('gateway answer is the only usable in-subnet address', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = ask(quiz.gatewayQuiz)
      const p = promptTarget(q.prompt)
      const s = calculateSubnet(p.ip, p.cidr)
      const ok = q.options.filter((gw) => {
        const g = calculateSubnet(gw, p.cidr)
        return g.networkAddress === s.networkAddress && gw !== s.networkAddress && gw !== s.broadcastAddress && gw !== p.ip
      })
      expect(ok).toEqual([q.options[q.answer]])
    }
  })
})

describe('phase 2 quiz generators', () => {
  it('OUI answer is the first three bytes', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = ask(quiz.ouiQuiz)
      const mac = /([0-9a-f]{2}:){5}[0-9a-f]{2}/.exec(q.prompt)![0]
      expect(q.options[q.answer]).toBe(describeMac(mac).oui)
    }
  })

  it('routing answer is the longest prefix match of the table in the prompt', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = ask(quiz.routingLpmQuiz)
      const [first, ...lines] = q.prompt.split('\n')
      const dst = /\d+\.\d+\.\d+\.\d+/.exec(first!)![0]
      const match = lookupRoute(parseIpRoute(lines.join('\n')), dst).match!
      expect(q.options[q.answer]).toBe(formatRoute(match))
    }
  })

  it('ACK answers add the segment length; SYN-ACK adds one', () => {
    for (let i = 0; i < RUNS; i++) {
      const a = ask(quiz.ackQuiz)
      const [seq, len] = a.prompt.match(/\d+/g)!.map(Number)
      expect(Number(a.options[a.answer])).toBe(seq! + len!)
      const h = ask(quiz.handshakeAckQuiz)
      expect(Number(h.options[h.answer])).toBe(Number(/\d+/.exec(h.prompt)![0]) + 1)
    }
  })

  it('port / service answers match the port data', () => {
    for (let i = 0; i < RUNS; i++) {
      const s = ask(quiz.serviceToPortQuiz)
      const svc = PORTS.find((p) => String(p.port) === s.options[s.answer])!
      expect(s.prompt).toContain(svc.service)
      const p = ask(quiz.portToServiceQuiz)
      const port = Number(/\d+/.exec(p.prompt)![0])
      expect(PORTS.find((x) => x.port === port)!.service).toBe(p.options[p.answer])
    }
  })

  it.each(Object.keys(zhTW.quizStatic))('static question %s has 4 unique options in every language', (id) => {
    for (const { code } of SUPPORTED_LOCALES) {
      i18n.global.locale.value = code
      for (let i = 0; i < 20; i++) {
        const q = quiz.staticQuiz(id)(translate)
        expect(new Set(q.options).size, `${code} ${id}`).toBe(4)
        expect(q.options[q.answer], `${code} ${id}`).toBe(translate(`quizStatic.${id}.a`))
        expect(q.explanation).not.toMatch(/quizStatic\./)
      }
    }
    i18n.global.locale.value = 'zh-TW'
  })
})
