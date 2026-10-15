/**
 * Quiz generators. Every answer is computed with utils/network.ts, never typed in by hand,
 * and distractors are the classic mistakes (using broadcast instead of network, off-by-one, etc.).
 */
import type { Translate } from '@/i18n'
import type { QuizFactory, QuizQuestion } from '@/types/tutorial'
import { PORTS } from '@/data/ports'
import { describeMac } from './mac'
import { formatRoute, lookupRoute, type Route } from './routing'
import {
  calculateSubnet,
  cidrToMask,
  getUsableHosts,
  intToIp,
  ipToInt,
  maskToCidr,
  toBinaryOctet,
} from './network'

export type RandomFn = () => number

export function randInt(min: number, max: number, random: RandomFn = Math.random): number {
  return Math.floor(random() * (max - min + 1)) + min
}

export function shuffle<T>(items: T[], random: RandomFn = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T]
  }
  return result
}

/** Builds a 4-option question from one correct answer and candidate distractors (deduplicated). */
export function makeChoice(
  prompt: string,
  correct: string,
  distractors: string[],
  explanation: string,
  random: RandomFn = Math.random,
): QuizQuestion {
  const unique = [...new Set(distractors.filter((d) => d !== correct))].slice(0, 3)
  const options = shuffle([correct, ...unique], random)
  return { prompt, options, answer: options.indexOf(correct), explanation }
}

export function randomPrivateIp(random: RandomFn = Math.random): string {
  const pick = randInt(0, 2, random)
  if (pick === 0) return `10.${randInt(0, 255, random)}.${randInt(0, 255, random)}.${randInt(1, 254, random)}`
  if (pick === 1) return `172.${randInt(16, 31, random)}.${randInt(0, 255, random)}.${randInt(1, 254, random)}`
  return `192.168.${randInt(0, 255, random)}.${randInt(1, 254, random)}`
}

function placeTerms(binary: string): string {
  return [128, 64, 32, 16, 8, 4, 2, 1].filter((_, i) => binary[i] === '1').join(' + ')
}

function flipBit(binary: string, index: number): string {
  return binary.slice(0, index) + (binary[index] === '1' ? '0' : '1') + binary.slice(index + 1)
}

// ---------------------------------------------------------------------------

export const decimalToBinaryQuiz: QuizFactory = (t: Translate) => {
  const n = randInt(1, 254)
  const correct = toBinaryOctet(n)
  return makeChoice(
    t('quiz.q.decToBin', { n }),
    correct,
    [
      flipBit(correct, randInt(0, 7)),
      correct.split('').reverse().join(''),
      toBinaryOctet((n + 1) % 256),
      toBinaryOctet((n + 128) % 256),
      // Single-bit flips are always distinct from each other and from the answer: guaranteed fallbacks.
      ...shuffle([0, 1, 2, 3, 4, 5, 6, 7]).map((i) => flipBit(correct, i)),
    ],
    t('quiz.q.decToBinExp', { n, terms: placeTerms(correct) }),
  )
}

export const binaryToDecimalQuiz: QuizFactory = (t: Translate) => {
  const n = randInt(1, 254)
  const binary = toBinaryOctet(n)
  return makeChoice(
    t('quiz.q.binToDec', { binary }),
    String(n),
    [
      String((n + 1) % 256),
      String(255 - n),
      String((n * 2) % 256),
      ...shuffle([1, 2, 4, 8, 16, 32, 64, 128]).map((bit) => String(n ^ bit)),
    ],
    t('quiz.q.binToDecExp', { terms: placeTerms(binary), n }),
  )
}

export const validIpQuiz: QuizFactory = (t: Translate) => {
  const valid = randomPrivateIp()
  const [a, b, c] = valid.split('.')
  return makeChoice(
    t('quiz.q.validIp'),
    valid,
    [`${a}.${b}.${randInt(256, 300)}.${randInt(1, 254)}`, `${a}.${b}.${c}`, `${a}.${b}.${c}.${randInt(1, 9)}.1`, `${a}.${b}.-1.${c}`],
    t('quiz.q.validIpExp'),
  )
}

export const privateIpQuiz: QuizFactory = (t: Translate) => {
  const correct = randomPrivateIp()
  return makeChoice(
    t('quiz.q.privateIp'),
    correct,
    [
      `172.${randInt(32, 64)}.${randInt(0, 255)}.${randInt(1, 254)}`,
      `8.8.${randInt(4, 8)}.${randInt(1, 8)}`,
      `192.169.${randInt(0, 255)}.${randInt(1, 254)}`,
      `11.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
    ],
    t('quiz.q.privateIpExp'),
  )
}

export const maskToCidrQuiz: QuizFactory = (t: Translate) => {
  const cidr = randInt(17, 30)
  const mask = cidrToMask(cidr)
  return makeChoice(
    t('quiz.q.maskToCidr', { mask }),
    `/${cidr}`,
    [`/${cidr - 1}`, `/${cidr + 1}`, `/${32 - cidr}`, `/${cidr - 8}`],
    t('quiz.q.maskToCidrExp', { mask, cidr: maskToCidr(mask) ?? cidr }),
  )
}

export const invalidMaskQuiz: QuizFactory = (t: Translate) => {
  const cidr = randInt(17, 29)
  const octet = cidrToMask(cidr).split('.')
  const broken = [...octet]
  broken[cidr < 24 ? 3 : 2] = '255'
  if (cidr >= 24) broken[1] = '0'
  return makeChoice(
    t('quiz.q.invalidMask'),
    broken.join('.'),
    [cidrToMask(cidr), cidrToMask(cidr + 1), cidrToMask(cidr - 1), cidrToMask(24)],
    t('quiz.q.invalidMaskExp'),
  )
}

export const cidrToMaskQuiz: QuizFactory = (t: Translate) => {
  const cidr = randInt(18, 30)
  return makeChoice(
    t('quiz.q.cidrToMask', { cidr }),
    cidrToMask(cidr),
    [cidrToMask(cidr - 1), cidrToMask(cidr + 1), cidrToMask(cidr - 8), cidrToMask(Math.min(cidr + 2, 32))],
    t('quiz.q.cidrToMaskExp', { cidr, mask: cidrToMask(cidr) }),
  )
}

export const usableHostsQuiz: QuizFactory = (t: Translate) => {
  const cidr = randInt(20, 30)
  const hosts = getUsableHosts(cidr)
  return makeChoice(
    t('quiz.q.hosts', { cidr }),
    String(hosts),
    [String(hosts + 2), String(hosts / 2 - 1), String(hosts * 2 + 2), String(hosts + 1)],
    t('quiz.q.hostsExp', { cidr, bits: 32 - cidr, hosts }),
  )
}

export const networkAddressQuiz: QuizFactory = (t: Translate) => {
  const cidr = randInt(22, 29)
  const r = calculateSubnet(randomPrivateIp(), cidr)
  const blockStep = r.totalAddresses
  return makeChoice(
    t('quiz.q.network', { target: `${r.ip}/${cidr}` }),
    r.networkAddress,
    [
      r.broadcastAddress,
      r.firstHost,
      intToIp((ipToInt(r.networkAddress) + blockStep) >>> 0),
      intToIp((ipToInt(r.networkAddress) - blockStep) >>> 0),
    ],
    t('quiz.q.networkExp', { mask: r.subnetMask, network: r.networkAddress, block: blockStep }),
  )
}

export const broadcastAddressQuiz: QuizFactory = (t: Translate) => {
  const cidr = randInt(22, 29)
  const r = calculateSubnet(randomPrivateIp(), cidr)
  return makeChoice(
    t('quiz.q.broadcast', { target: `${r.ip}/${cidr}` }),
    r.broadcastAddress,
    [
      r.networkAddress,
      r.lastHost,
      intToIp((ipToInt(r.broadcastAddress) + r.totalAddresses) >>> 0),
      intToIp((ipToInt(r.broadcastAddress) + 1) >>> 0),
    ],
    t('quiz.q.broadcastExp', { network: r.networkAddress, total: r.totalAddresses, broadcast: r.broadcastAddress }),
  )
}

export const gatewayQuiz: QuizFactory = (t: Translate) => {
  const cidr = randInt(24, 28)
  const r = calculateSubnet(randomPrivateIp(), cidr)
  const outside = intToIp((ipToInt(r.networkAddress) + r.totalAddresses + 1) >>> 0)
  return makeChoice(
    t('quiz.q.gateway', { target: `${r.ip}/${cidr}` }),
    r.firstHost === r.ip ? r.lastHost : r.firstHost,
    [r.networkAddress, r.broadcastAddress, outside],
    t('quiz.q.gatewayExp', { network: `${r.networkAddress}/${cidr}`, first: r.firstHost, last: r.lastHost }),
  )
}

// ---------------------------------------------------------------------------
// Phase 2 generators
// ---------------------------------------------------------------------------

/** Conceptual question with fixed text from `quizStatic.<id>` (q, a, w1–w3, exp); options are shuffled. */
export function staticQuiz(id: string): QuizFactory {
  return (t: Translate) =>
    makeChoice(
      t(`quizStatic.${id}.q`),
      t(`quizStatic.${id}.a`),
      [t(`quizStatic.${id}.w1`), t(`quizStatic.${id}.w2`), t(`quizStatic.${id}.w3`)],
      t(`quizStatic.${id}.exp`),
    )
}

function randomMac(): string {
  return Array.from({ length: 6 }, (_, i) => {
    // Clear the I/G and U/L bits of the first byte: a normal vendor unicast address.
    const byte = randInt(0, 255) & (i === 0 ? 0xfc : 0xff)
    return byte.toString(16).padStart(2, '0')
  }).join(':')
}

export const ouiQuiz: QuizFactory = (t: Translate) => {
  const mac = randomMac()
  const info = describeMac(mac)
  return makeChoice(
    t('quiz.q.oui', { mac }),
    info.oui,
    [info.nic, mac.slice(3, 11), mac.slice(0, 5), mac.slice(6, 14)],
    t('quiz.q.ouiExp', { oui: info.oui, nic: info.nic }),
  )
}

export const routingLpmQuiz: QuizFactory = (t: Translate) => {
  const b = randInt(1, 250)
  const c = randInt(1, 250)
  const routes: Route[] = [
    { destination: 'default', via: '192.168.1.1', dev: 'eth0', metric: 0 },
    { destination: '10.0.0.0/8', via: '192.168.1.254', dev: 'eth0', metric: 0 },
    { destination: `10.${b}.0.0/16`, via: '172.16.0.1', dev: 'eth1', metric: 0 },
    { destination: `10.${b}.${c}.0/24`, dev: 'eth2', metric: 0 },
  ]
  const other = (n: number) => (n + randInt(1, 200)) % 256
  const candidates = [
    `10.${b}.${c}.${randInt(1, 254)}`,
    `10.${b}.${other(c)}.${randInt(1, 254)}`,
    `10.${other(b)}.${randInt(0, 255)}.${randInt(1, 254)}`,
    `${randInt(11, 99)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
  ]
  const dst = candidates[randInt(0, candidates.length - 1)]!
  const match = lookupRoute(routes, dst).match!
  return makeChoice(
    `${t('quiz.q.lpm', { dst })}\n${routes.map(formatRoute).join('\n')}`,
    formatRoute(match),
    routes.filter((r) => r !== match).map(formatRoute),
    t('quiz.q.lpmExp', { dst, route: match.destination }),
  )
}

export const ackQuiz: QuizFactory = (t: Translate) => {
  const seq = randInt(1000, 90000)
  const len = [64, 100, 500, 1200, 1460][randInt(0, 4)]!
  return makeChoice(
    t('quiz.q.ack', { seq, len }),
    String(seq + len),
    [String(seq + len + 1), String(seq + 1), String(len), String(seq)],
    t('quiz.q.ackExp', { seq, len, ack: seq + len }),
  )
}

export const handshakeAckQuiz: QuizFactory = (t: Translate) => {
  const x = randInt(1000, 900000)
  const y = randInt(1000, 900000)
  return makeChoice(
    t('quiz.q.synAck', { x }),
    String(x + 1),
    [String(x), String(y + 1), String(x + 2), '0'],
    t('quiz.q.synAckExp', { x, ack: x + 1 }),
  )
}

/** Entries whose port number is unique in the data set, so the answer is unambiguous. */
const uniquePorts = PORTS.filter((p) => PORTS.filter((q) => q.port === p.port).length === 1)

function pickPorts(n: number) {
  return shuffle(uniquePorts).slice(0, n)
}

export const serviceToPortQuiz: QuizFactory = (t: Translate) => {
  const [answer, ...rest] = pickPorts(6)
  return makeChoice(
    t('quiz.q.servicePort', { service: answer!.service }),
    String(answer!.port),
    rest.map((p) => String(p.port)),
    t('quiz.q.servicePortExp', { service: answer!.service, port: answer!.port, proto: answer!.protocols.join(' / ') }),
  )
}

export const portToServiceQuiz: QuizFactory = (t: Translate) => {
  const [answer, ...rest] = pickPorts(6)
  return makeChoice(
    t('quiz.q.portService', { port: answer!.port }),
    answer!.service,
    rest.map((p) => p.service),
    t('quiz.q.servicePortExp', { service: answer!.service, port: answer!.port, proto: answer!.protocols.join(' / ') }),
  )
}
