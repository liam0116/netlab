import type { Translate } from '@/i18n'
import type { DiagramDevice, Phase } from './app'

export type RangeHighlight = 'network' | 'broadcast' | 'hosts' | 'none'

/** Declarative description of what a tutorial step draws. Rendered by TutorialVisual.vue. */
export type TutorialVisual =
  | { kind: 'binary-octet'; value: number; step: number }
  | { kind: 'binary-sum'; binary: string }
  | { kind: 'ip-octets'; ip: string; highlight?: number }
  | { kind: 'bit-grid'; ip: string; cidr?: number; label?: string }
  | { kind: 'mask-bits'; cidr: number; step: number }
  | { kind: 'bitwise'; ip: string; cidr: number; op: 'and' | 'or' }
  | { kind: 'subnet-range'; ip: string; cidr: number; highlight: RangeHighlight; gateway?: string }
  | { kind: 'subnet-blocks'; ip: string; cidr: number }
  | { kind: 'link'; a: DiagramDevice; b: DiagramDevice; via: 'switch' | 'router' | 'blocked'; viaLabel?: string }
  | { kind: 'terminal'; command: string; output: string }
  | { kind: 'sequence'; actors: string[]; messages: SequenceMessage[]; step: number }
  | { kind: 'handshake'; step: number }
  | { kind: 'mac-address'; mac: string; highlight?: 'oui' | 'nic' | 'bits' }
  | { kind: 'mac-table'; step: number }
  | { kind: 'vlan-frame'; tagged: boolean }
  | { kind: 'vlan-switch'; highlight: 'access' | 'trunk' }
  | { kind: 'nat-table'; step: number }
  | { kind: 'routing-table'; routes: string; dst: string }
  | { kind: 'socket' }
  | { kind: 'tcp-udp' }

/** One arrow in a sequence diagram. Labels are protocol text and stay language-neutral. */
export interface SequenceMessage {
  from: number
  to: number
  label: string
  detail?: string
  tone?: 'accent' | 'host' | 'net' | 'ok' | 'warn' | 'err'
  /** Drawn as a dropped packet that never reaches `to`. */
  lost?: boolean
}

/** Locale-specific text of one step. */
export interface TutorialStepText {
  title: string
  /** Paragraphs. Text wrapped in `backticks` is rendered as code. */
  body: string[]
  /** A concrete, real-world example shown under the visual. */
  example?: string
}

export interface TutorialStep extends TutorialStepText {
  visual?: TutorialVisual
}

/** Locale-specific text of one chapter; `steps` must line up with the chapter definition. */
export interface TutorialChapterText {
  title: string
  summary: string
  steps: TutorialStepText[]
}

export interface QuizQuestion {
  prompt: string
  options: string[]
  answer: number
  explanation: string
}

/** Quizzes are generated so every attempt uses fresh numbers computed by utils/network.ts. */
export type QuizFactory = (t: Translate) => QuizQuestion

/** Language-independent chapter structure: visuals per step and quiz generators. */
export interface TutorialChapterDef {
  id: string
  number: number
  phase: Phase
  visuals: (TutorialVisual | undefined)[]
  quiz: QuizFactory[]
}

/** A chapter with its text resolved for the current locale. */
export interface TutorialChapter {
  id: string
  number: number
  title: string
  summary: string
  phase: Phase
  steps: TutorialStep[]
  quiz: QuizFactory[]
}
