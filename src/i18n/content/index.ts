import type { AppLocale } from '@/i18n'
import type { TutorialChapterText } from '@/types/tutorial'
import tutorialsZhTW from './tutorials.zh-TW'
import tutorialsEn from './tutorials.en'
import portsZhTW from './ports.zh-TW'
import portsEn from './ports.en'
import linuxZhTW from './linux.zh-TW'
import linuxEn from './linux.en'
import troubleZhTW from './troubleshooting.zh-TW'
import troubleEn from './troubleshooting.en'
import raidZhTW from './raid.zh-TW'
import raidEn from './raid.en'
import devicesZhTW from './devices.zh-TW'
import devicesEn from './devices.en'
import type { CommandText, DeviceGuideContent, RaidText, TroubleshootingText } from './types'

/**
 * Long-form tutorial text, kept as typed TS modules instead of vue-i18n messages:
 * it contains computed values and characters (`{`, `|`, `@`) that would need escaping.
 */
export const tutorialContent: Record<AppLocale, Record<string, TutorialChapterText>> = {
  'zh-TW': tutorialsZhTW,
  en: tutorialsEn,
}

/** Port descriptions keyed by PortEntry.id. */
export const portDescriptions: Record<AppLocale, Record<string, string>> = {
  'zh-TW': portsZhTW,
  en: portsEn,
}

/** Linux command explanations keyed by LinuxCommand.id. */
export const commandTexts: Record<AppLocale, Record<string, CommandText>> = {
  'zh-TW': linuxZhTW,
  en: linuxEn,
}

export const troubleshootingTexts: Record<AppLocale, TroubleshootingText> = {
  'zh-TW': troubleZhTW,
  en: troubleEn,
}


export const raidContent: Record<AppLocale, RaidText> = {
  'zh-TW': raidZhTW,
  en: raidEn,
}

/** Beginner guide to the rack device templates, keyed by RACK_TEMPLATES id. */
export const deviceGuide: Record<AppLocale, DeviceGuideContent> = {
  'zh-TW': devicesZhTW,
  en: devicesEn,
}
