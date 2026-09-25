import type { Field, Tab } from 'payload'

import { HOME } from '@/components/home/content'

import {
  CONTACT_PAGE,
  FAQ_PAGE,
  MADE_FOR_YOU,
  OUR_STORY,
  PRESS_PAGE,
  SHIPPING_PAGE,
  SPOTTED_PAGE,
  TRACK_PAGE,
} from './pages'

/**
 * The words on the storefront she can edit herself (REQUIREMENTS S1, A18).
 *
 * Each entry names one piece of text by its path in the copy objects
 * (content.ts, pages.ts), how it is typed in the admin, and its label. From
 * this one list come both the admin fields (globals/PageText.ts) and the
 * merge that puts her words over the defaults (getPageText.ts) — so the two
 * cannot drift apart.
 *
 * The copy objects stay the defaults: every field starts filled with today's
 * text, and a field she empties falls back to it, so a page is never blank.
 * Figures (prices, fees, lead times) are never here — they come from the
 * database.
 *
 * Kinds:
 *   text      one line
 *   textarea  a paragraph
 *   lines     several lines, one per line (a heading set on two lines, a list)
 *   paras     paragraphs, a blank line between each
 *   italics   one line where *asterisks* set words in italic
 *   list      rows she can add, remove and reorder (title + body)
 *   keyed     one set of fields per fixed item (a Made for You category)
 */

type Kind = 'italics' | 'keyed' | 'lines' | 'list' | 'paras' | 'text' | 'textarea'
type Entry = {
  description?: string
  kind: Kind
  label: string
  path: string
  sub?: Array<{ kind: 'text' | 'textarea'; label: string; name: string }>
}
type Page = { defaults: Record<string, unknown>; entries: Entry[]; key: string; label: string }

const titleBody = [
  { kind: 'text' as const, label: 'Title', name: 'title' },
  { kind: 'textarea' as const, label: 'Words', name: 'body' },
]

export const PAGES: Page[] = [
  {
    defaults: HOME,
    entries: [
      {
        kind: 'lines',
        label: 'Headline',
        path: 'hero.tagline',
        description: 'The big words over the film. Line one upright, line two in italic.',
      },
      { kind: 'text', label: 'Button', path: 'hero.cta' },
      {
        kind: 'textarea',
        label: 'Line beside the headline',
        path: 'hero.intro',
        description: 'Desktop only.',
      },
      { kind: 'text', label: 'Small label above', path: 'philosophy.label' },
      {
        kind: 'italics',
        label: 'Opening words',
        path: 'philosophy.headline',
        description: 'Put *asterisks* around the words to set in italic.',
      },
      { kind: 'text', label: 'The print — small label', path: 'print.label' },
      { kind: 'lines', label: 'The print — heading', path: 'print.heading' },
      { kind: 'textarea', label: 'The print — words', path: 'print.body' },
      { kind: 'text', label: 'The print — link', path: 'print.cta' },
      { kind: 'text', label: 'Made by hand — small label', path: 'steps.label' },
      { kind: 'lines', label: 'Made by hand — heading', path: 'steps.heading' },
    ],
    key: 'home',
    label: 'Homepage',
  },
  {
    defaults: OUR_STORY,
    entries: [
      { kind: 'text', label: 'Opening — small label', path: 'opener.label' },
      { kind: 'lines', label: 'Opening — heading', path: 'opener.heading' },
      { kind: 'text', label: 'Line under the opening', path: 'lede' },
      { kind: 'text', label: 'The house — small label', path: 'founder.label' },
      { kind: 'text', label: 'The house — heading', path: 'founder.heading' },
      { kind: 'paras', label: 'The house — words', path: 'founder.body' },
      { kind: 'text', label: 'Behind the print — small label', path: 'print.label' },
      { kind: 'text', label: 'Behind the print — heading', path: 'print.heading' },
      { kind: 'paras', label: 'Behind the print — words', path: 'print.body' },
      { kind: 'text', label: 'Behind the print — sign-off', path: 'print.signoff' },
      { kind: 'text', label: 'Behind the print — signature', path: 'print.signature' },
      { kind: 'text', label: 'Caption for the sea photograph', path: 'print.seaCaption' },
      { kind: 'text', label: 'The silk — small label', path: 'silk.label' },
      { kind: 'text', label: 'The silk — heading', path: 'silk.heading' },
      { kind: 'list', label: 'The silk — three points', path: 'silk.pillars', sub: titleBody },
      { kind: 'text', label: 'The atelier — small label', path: 'atelier.label' },
      { kind: 'text', label: 'The atelier — heading', path: 'atelier.heading' },
      { kind: 'textarea', label: 'The atelier — words', path: 'atelier.body' },
      { kind: 'text', label: 'The atelier — link', path: 'atelier.cta' },
      { kind: 'text', label: 'Closing line', path: 'closing.line' },
      { kind: 'text', label: 'Closing button', path: 'closing.cta' },
    ],
    key: 'ourStory',
    label: 'Our Story',
  },
  {
    defaults: SHIPPING_PAGE,
    entries: [
      { kind: 'text', label: 'Heading', path: 'heading' },
      { kind: 'textarea', label: 'Introduction', path: 'intro' },
      { kind: 'text', label: 'Qatar — heading', path: 'delivery.qatarHeading' },
      { kind: 'text', label: 'Qatar — note', path: 'delivery.qatarNote' },
      { kind: 'text', label: 'Worldwide — heading', path: 'delivery.intlHeading' },
      { kind: 'text', label: 'Worldwide — note', path: 'delivery.intlNote' },
      { kind: 'textarea', label: 'Delivery times', path: 'delivery.timing' },
      { kind: 'textarea', label: 'About currency', path: 'delivery.currency' },
      { kind: 'text', label: 'Returns — heading', path: 'returns.heading' },
      { kind: 'textarea', label: 'Returns — introduction', path: 'returns.intro' },
      {
        kind: 'lines',
        label: 'Returns — terms',
        path: 'returns.terms',
        description: 'One term per line.',
      },
      { kind: 'text', label: 'Personalised pieces — label', path: 'returns.exceptionLabel' },
      { kind: 'textarea', label: 'Personalised pieces — words', path: 'returns.exception' },
      { kind: 'textarea', label: 'Returns — how to reach us', path: 'returns.contact' },
      { kind: 'text', label: 'Gift wrapping — heading', path: 'gifting.heading' },
      { kind: 'textarea', label: 'Gift wrapping — words', path: 'gifting.body' },
      { kind: 'textarea', label: 'Gift wrapping — the gift note', path: 'gifting.note' },
    ],
    key: 'shipping',
    label: 'Shipping & returns',
  },
  {
    defaults: MADE_FOR_YOU,
    entries: [
      { kind: 'text', label: 'Heading', path: 'heading' },
      { kind: 'textarea', label: 'Introduction', path: 'intro' },
      { kind: 'keyed', label: 'What you offer', path: 'offers', sub: titleBody },
      { kind: 'text', label: 'How it works — small label', path: 'process.label' },
      { kind: 'list', label: 'How it works — steps', path: 'process.steps', sub: titleBody },
      { kind: 'text', label: 'Enquiry — heading', path: 'enquiry.heading' },
      { kind: 'textarea', label: 'Enquiry — words', path: 'enquiry.body' },
      { kind: 'text', label: 'Enquiry — button', path: 'enquiry.cta' },
      { kind: 'text', label: 'Heading above the commissions', path: 'projectsHeading' },
    ],
    key: 'madeForYou',
    label: 'Made for You',
  },
  {
    defaults: FAQ_PAGE,
    entries: [
      { kind: 'text', label: 'Heading', path: 'heading' },
      { kind: 'textarea', label: 'Introduction', path: 'intro' },
      {
        kind: 'keyed',
        label: 'Group names',
        path: 'groups',
        sub: [{ kind: 'text', label: 'Name', name: 'label' }],
      },
    ],
    key: 'faq',
    label: 'FAQ',
  },
  {
    defaults: PRESS_PAGE,
    entries: [
      { kind: 'text', label: 'Heading', path: 'heading' },
      { kind: 'textarea', label: 'Introduction', path: 'intro' },
      { kind: 'text', label: 'Before any press — heading', path: 'empty.heading' },
      { kind: 'textarea', label: 'Before any press — words', path: 'empty.body' },
      { kind: 'text', label: 'Before any press — link', path: 'empty.cta' },
    ],
    key: 'press',
    label: 'Press',
  },
  {
    defaults: SPOTTED_PAGE,
    entries: [
      { kind: 'text', label: 'Heading', path: 'heading' },
      { kind: 'textarea', label: 'Introduction', path: 'intro' },
      { kind: 'text', label: 'Send yours — heading', path: 'form.heading' },
      { kind: 'textarea', label: 'Send yours — words', path: 'form.body' },
      { kind: 'text', label: 'Closing — heading', path: 'invite.heading' },
      { kind: 'textarea', label: 'Closing — words', path: 'invite.body' },
      { kind: 'text', label: 'Before any are approved — label', path: 'empty.label' },
      { kind: 'textarea', label: 'Before any are approved — words', path: 'empty.body' },
    ],
    key: 'spotted',
    label: 'Spotted',
  },
  {
    defaults: CONTACT_PAGE,
    entries: [
      { kind: 'text', label: 'Heading', path: 'heading' },
      { kind: 'textarea', label: 'Introduction', path: 'intro' },
      { kind: 'text', label: 'Form heading', path: 'formHeading' },
      {
        kind: 'lines',
        label: 'Subjects to choose from',
        path: 'subjects',
        description: 'One per line.',
      },
      { kind: 'text', label: 'After sending — heading', path: 'thanks.heading' },
      { kind: 'textarea', label: 'After sending — words', path: 'thanks.body' },
    ],
    key: 'contact',
    label: 'Contact',
  },
  {
    defaults: TRACK_PAGE,
    entries: [
      { kind: 'text', label: 'Heading', path: 'heading' },
      { kind: 'textarea', label: 'Introduction', path: 'intro' },
      { kind: 'text', label: 'After asking — heading', path: 'sent.heading' },
      { kind: 'textarea', label: 'After asking — words', path: 'sent.body' },
    ],
    key: 'track',
    label: 'Track order',
  },
]

/* ------------------------------------------------------------- conversions */

type Segment = { italic?: boolean; text: string }

/** Segments → "Inspired by the *tranquil waters* of Qatar". */
export const italicsToText = (segments: ReadonlyArray<Segment>): string =>
  segments.map((s) => (s.italic ? `*${s.text}*` : s.text)).join('')

/** "Inspired by the *tranquil waters* of Qatar" → segments. An unclosed * is left as it is. */
export const textToItalics = (text: string): Segment[] =>
  text
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((part) =>
      /^\*[^*]+\*$/.test(part) ? { italic: true, text: part.slice(1, -1) } : { text: part },
    )

const get = (obj: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    )
const set = (obj: Record<string, unknown>, path: string, value: unknown) => {
  const keys = path.split('.')
  let o = obj
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>
  o[keys[keys.length - 1]] = value
}
const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '')

/** The default in the form she edits: what the field starts filled with. */
function toStored(entry: Entry, value: unknown): unknown {
  switch (entry.kind) {
    case 'lines':
      return (value as string[]).join('\n')
    case 'paras':
      return (value as string[]).join('\n\n')
    case 'italics':
      return italicsToText(value as Segment[])
    case 'list':
      return (value as Array<Record<string, string>>).map((row) =>
        Object.fromEntries(entry.sub!.map((s) => [s.name, row[s.name]])),
      )
    case 'keyed':
      return Object.fromEntries(
        (value as Array<Record<string, string>>).map((row) => [
          row.key,
          Object.fromEntries(entry.sub!.map((s) => [s.name, row[s.name]])),
        ]),
      )
    default:
      return value
  }
}

/** Her stored value, read back into the shape the page expects — or undefined to keep the default. */
function fromStored(entry: Entry, stored: unknown, fallback: unknown): unknown {
  switch (entry.kind) {
    case 'text':
    case 'textarea':
      return clean(stored) || undefined
    case 'lines': {
      const lines = clean(stored)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      return lines.length ? lines : undefined
    }
    case 'paras': {
      const paras = clean(stored)
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean)
      return paras.length ? paras : undefined
    }
    case 'italics':
      return clean(stored) ? textToItalics(clean(stored)) : undefined
    case 'list': {
      const rows = (Array.isArray(stored) ? stored : [])
        .map((row: Record<string, unknown>) =>
          Object.fromEntries(entry.sub!.map((s) => [s.name, clean(row?.[s.name])])),
        )
        .filter((row) => Object.values(row).some(Boolean))
      return rows.length ? rows : undefined
    }
    case 'keyed': {
      // The items are fixed (a Made for You category); only their words change.
      const byKey = (stored && typeof stored === 'object' ? stored : {}) as Record<
        string,
        Record<string, unknown>
      >
      return (fallback as Array<Record<string, string>>).map((row) => ({
        ...row,
        ...Object.fromEntries(
          entry.sub!.map((s) => [s.name, clean(byKey[row.key]?.[s.name]) || row[s.name]]),
        ),
      }))
    }
  }
}

/* ------------------------------------------------------------ admin fields */

/** Field names cannot hold dots: "hero.tagline" is stored as hero → tagline, in named groups. */
function fieldFor(entry: Entry, defaults: Record<string, unknown>): Field {
  const name = entry.path.split('.').pop()!
  const initial = toStored(entry, get(defaults, entry.path))
  const admin = entry.description ? { description: entry.description } : {}
  switch (entry.kind) {
    case 'text':
    case 'italics':
      return { admin, defaultValue: initial as string, label: entry.label, name, type: 'text' }
    case 'textarea':
    case 'lines':
    case 'paras':
      return {
        admin: { ...admin, rows: entry.kind === 'textarea' ? 3 : 5 },
        defaultValue: initial as string,
        label: entry.label,
        name,
        type: 'textarea',
      }
    case 'list':
      return {
        admin: { ...admin, initCollapsed: false },
        defaultValue: initial as Array<Record<string, string>>,
        fields: entry.sub!.map((s) => ({ label: s.label, name: s.name, type: s.kind }) as Field),
        label: entry.label,
        labels: { plural: 'Rows', singular: 'Row' },
        name,
        type: 'array',
      }
    case 'keyed': {
      const byKey = initial as Record<string, Record<string, string>>
      const rows = get(defaults, entry.path) as Array<Record<string, string>>
      return {
        admin,
        fields: rows.map((row) => ({
          fields: entry.sub!.map(
            (s) =>
              ({
                defaultValue: byKey[row.key]?.[s.name],
                label: s.label,
                name: s.name,
                type: s.kind,
              }) as Field,
          ),
          label: row.title || row.label || row.key,
          name: row.key,
          type: 'group',
        })),
        label: entry.label,
        name,
        type: 'group',
      }
    }
  }
}

/** Nests a page's fields under groups by their path ("hero.tagline" → hero → tagline). */
function nest(entries: Entry[], defaults: Record<string, unknown>): Field[] {
  const root: Field[] = []
  const groups = new Map<string, Field[]>()
  for (const entry of entries) {
    const parts = entry.path.split('.')
    const field = fieldFor(entry, defaults)
    if (parts.length === 1) {
      root.push(field)
      continue
    }
    const group = parts[0]
    if (!groups.has(group)) {
      const fields: Field[] = []
      groups.set(group, fields)
      root.push({ admin: { hideGutter: true }, fields, label: false, name: group, type: 'group' })
    }
    groups.get(group)!.push(field)
  }
  return root
}

/** One named tab per page, for the Page text screen; `extra` adds fields to a page's tab. */
export const pageTextTabs = (extra: Partial<Record<string, Field[]>> = {}): Tab[] =>
  PAGES.map((page) => ({
    fields: [...(extra[page.key] ?? []), ...nest(page.entries, page.defaults)],
    label: page.label,
    name: page.key,
  }))

/* ------------------------------------------------------------------- merge */

export type PageCopy = {
  CONTACT_PAGE: typeof CONTACT_PAGE
  FAQ_PAGE: typeof FAQ_PAGE
  HOME: typeof HOME
  MADE_FOR_YOU: typeof MADE_FOR_YOU
  OUR_STORY: typeof OUR_STORY
  PRESS_PAGE: typeof PRESS_PAGE
  SHIPPING_PAGE: typeof SHIPPING_PAGE
  SPOTTED_PAGE: typeof SPOTTED_PAGE
  TRACK_PAGE: typeof TRACK_PAGE
}

const EXPORTS: Record<string, keyof PageCopy> = {
  contact: 'CONTACT_PAGE',
  faq: 'FAQ_PAGE',
  home: 'HOME',
  madeForYou: 'MADE_FOR_YOU',
  ourStory: 'OUR_STORY',
  press: 'PRESS_PAGE',
  shipping: 'SHIPPING_PAGE',
  spotted: 'SPOTTED_PAGE',
  track: 'TRACK_PAGE',
}

/** Her words over the defaults, page by page. Anything empty or missing keeps the default. */
export function mergePageText(stored: Record<string, unknown> | null | undefined): PageCopy {
  const out: Record<string, unknown> = {}
  for (const page of PAGES) {
    const copy = structuredClone(page.defaults) as Record<string, unknown>
    const mine = (stored?.[page.key] ?? {}) as Record<string, unknown>
    for (const entry of page.entries) {
      const value = fromStored(entry, get(mine, entry.path), get(page.defaults, entry.path))
      if (value !== undefined) set(copy, entry.path, value)
    }
    out[EXPORTS[page.key]] = copy
  }
  return out as PageCopy
}
