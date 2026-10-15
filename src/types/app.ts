import type { Component } from 'vue'

export type Phase = 1 | 2 | 3 | 4

export type NavSectionId = 'learn' | 'tools' | 'lab' | 'project' | 'service' | 'reference'

export interface NavItem {
  /** Key under `nav.items` in the locale files (localized name, description, explanation). */
  id: string
  /** English label: kept in English in every locale because it is the term used at work. */
  label: string
  /** Route of the built feature. Items without one link to their /features/:id intro page. */
  to?: string
  icon: Component
  /** Phase in which this feature is delivered. */
  phase: Phase
}

export interface NavSection {
  id: NavSectionId
  title: string
  items: NavItem[]
}

export interface KeyValueRow {
  label: string
  value: string
  /** Optional color accent for the value. */
  tone?: 'net' | 'host' | 'accent' | 'ok' | 'err'
  hint?: string
  copy?: boolean
}

export interface DiagramDevice {
  name: string
  ip: string
  sub?: string
}
