/** Locale text for one Linux command (see src/data/linuxCommands.ts). */
export interface CommandText {
  purpose: string
  normal: string
  abnormal: string
  issues: string[]
}

export interface TroubleStepText {
  question: string
  explain: string
  normal: string
  abnormal: string
}

export interface TroubleDiagnosisText {
  title: string
  causes: string[]
  next: string[]
}

export interface TroubleshootingText {
  steps: Record<string, TroubleStepText>
  diagnoses: Record<string, TroubleDiagnosisText>
}

/** One RAID level explained for beginners (see utils/raid.ts for the numbers). */
export interface RaidLevelText {
  name: string
  tagline: string
  /** How the data is laid out, in plain words. */
  how: string
  good: string[]
  bad: string[]
  useFor: string
  avoid: string
}

/** Where RAID is configured on one kind of system. */
export interface RaidPlaceText {
  title: string
  where: string
  steps: string[]
  note?: string
}

export interface RaidText {
  intro: string[]
  notBackup: string
  levels: Record<'0' | '1' | '5' | '6' | '10', RaidLevelText>
  /** Levels you will read about but rarely configure (2, 3, 4, 50, 60, JBOD, SHR, RAID-Z). */
  others: { level: string; text: string }[]
  choose: { situation: string; pick: string; why: string }[]
  /** Where RAID fits in an installation, in order. */
  workflow: string[]
  places: RaidPlaceText[]
  checklist: string[]
  glossary: { term: string; text: string }[]
}

/** One rack device template explained for beginners. Keyed by RACK_TEMPLATES id. */
export interface DeviceGuideText {
  name: string
  what: string
  use: string
  placement: string
  cabling: string
  tips: string[]
  /** Optional deeper reading inside the app. */
  link?: { to: string; label: string }
}

export interface DeviceGuideContent {
  intro: string[]
  concepts: { term: string; text: string }[]
  devices: Record<string, DeviceGuideText>
}
