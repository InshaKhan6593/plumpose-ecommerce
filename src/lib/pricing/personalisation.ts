import type { PersonalisationOption, SiteSetting } from '@/payload-types'

import { type Minor, toMinor } from './money'

/**
 * Hand-embroidery: validation and pricing.
 *
 * Ported from the legacy `netlify/lib/personalisation.mjs`, with the option
 * tables moved out of the file and into the `personalisationOptions`
 * collection so the client can add a thread colour without a developer (A13).
 *
 * The governing rule is carried over unchanged, and it is the important one:
 *
 *   **whatever the browser sends is rebuilt from our own tables.**
 *
 * Nothing is trusted and nothing is echoed back. A request naming a placement
 * we do not offer is dropped; a request naming a symbol we do not offer falls
 * back to the house mark rather than being stitched as sent. That is what
 * stops an unpriced — or unembroiderable — order being placed.
 *
 * The fee is stored in **major** units on Site settings (`160` is QAR 160);
 * everything returned from here is **minor** — see `./money.ts`.
 */

export type PersonalisationInput = {
  lettering?: null | string
  placement?: null | string
  style?: null | string
  symbol?: null | string
  thread?: null | string
}

/** One validated placement, priced, shaped to `personalisationLineFields`. */
export type PersonalisationLine = {
  /** Minor units. Snapshot of what this placement cost when ordered. */
  feeQar: Minor
  lettering: string
  placement: string
  placementName: string
  style: string
  symbol: string
  symbolName: string
  thread: string
  threadName: string
}

export type PersonalisationRules = {
  /** Minor units. */
  feeQar: Minor
  maxChars: number
  maxPlacements: number
  options: PersonalisationOption[]
}

/** Legacy default: an unrecognised motif is stitched as our own mark. */
const DEFAULT_SYMBOL_KEY = 'star'

const STYLES_WITH_TEXT = new Set(['text', 'both'])
const STYLES_WITH_SYMBOL = new Set(['symbol', 'both'])

/** Strip control characters, collapse whitespace, cap length. */
const tidy = (value: unknown, max: number): string =>
  String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

/**
 * Letters, digits, spaces, apostrophes, ampersands, full stops and hyphens are
 * embroiderable. Everything else is not — an emoji cannot be stitched by hand,
 * so it is removed rather than accepted and quietly dropped in the atelier.
 */
export const cleanLettering = (value: unknown, maxChars: number): string =>
  tidy(value, maxChars)
    .replace(/[^\p{L}\p{N} '&.-]/gu, '')
    .slice(0, maxChars)

const find = (
  options: PersonalisationOption[],
  type: PersonalisationOption['type'],
  key: string,
): PersonalisationOption | undefined =>
  options.find((o) => o.type === type && o.active !== false && o.key === key)

/**
 * Reads the rules the client controls. The fee and the caps live on Site
 * settings (A13) so she can change them without touching the option list.
 */
export const personalisationRules = (
  options: PersonalisationOption[],
  settings: Partial<SiteSetting>,
): PersonalisationRules => ({
  feeQar: toMinor(settings.personalisationFeeQar),
  maxChars: settings.personalisationMaxChars ?? 6,
  maxPlacements: settings.personalisationMaxPlacements ?? 2,
  options,
})

/**
 * Validates one requested placement against the tables and prices it.
 * Returns `null` when the request does not describe an embroidery we offer.
 */
export const normalisePersonalisation = (
  raw: PersonalisationInput | null | undefined,
  rules: PersonalisationRules,
): null | PersonalisationLine => {
  if (!raw || typeof raw !== 'object') return null

  const placement = find(rules.options, 'placement', tidy(raw.placement, 40))
  if (!placement) return null

  const styleOption =
    find(rules.options, 'style', tidy(raw.style, 20)) ??
    rules.options.find((o) => o.type === 'style' && o.active !== false)
  if (!styleOption?.key) return null

  const wantsText = STYLES_WITH_TEXT.has(styleOption.key)
  const wantsSymbol = STYLES_WITH_SYMBOL.has(styleOption.key)

  const lettering = wantsText ? cleanLettering(raw.lettering, rules.maxChars) : ''

  /**
   * Lettering was asked for but nothing embroiderable was typed. Charging a
   * fee for a blank placement would be worse than refusing it.
   */
  if (wantsText && !lettering) return null

  const symbol = wantsSymbol
    ? (find(rules.options, 'symbol', tidy(raw.symbol, 40)) ??
      find(rules.options, 'symbol', DEFAULT_SYMBOL_KEY) ??
      rules.options.find((o) => o.type === 'symbol' && o.active !== false))
    : undefined

  const thread =
    find(rules.options, 'thread', tidy(raw.thread, 40)) ??
    rules.options.find((o) => o.type === 'thread' && o.active !== false)

  return {
    feeQar: rules.feeQar,
    lettering,
    placement: placement.key ?? '',
    placementName: placement.name,
    style: styleOption.key,
    symbol: symbol?.key ?? '',
    symbolName: symbol?.name ?? '',
    thread: thread?.key ?? '',
    threadName: thread?.name ?? '',
  }
}

/**
 * Cleans a whole list for one cart line: drops anything invalid, refuses a
 * second embroidery on the same placement, and never returns more than the
 * configured maximum.
 */
export const normalisePersonalisationList = (
  raw: unknown,
  rules: PersonalisationRules,
): PersonalisationLine[] => {
  if (!Array.isArray(raw)) return []

  const out: PersonalisationLine[] = []
  const usedPlacements = new Set<string>()

  for (const item of raw) {
    const line = normalisePersonalisation(item as PersonalisationInput, rules)
    if (!line || usedPlacements.has(line.placement)) continue

    usedPlacements.add(line.placement)
    out.push(line)

    if (out.length >= rules.maxPlacements) break
  }

  return out
}

/**
 * What the embroidery on one cart line costs: the fee is **per placement, per
 * garment**, so two initials on a quantity of three is six fees. Carried over
 * from the legacy `personalFee` calculation.
 */
export const personalisationFeeForLine = (lines: PersonalisationLine[], quantity: number): Minor =>
  lines.reduce((total, line) => total + line.feeQar, 0) * Math.max(1, quantity)

/** One placement in words — for the receipt, the order email and the atelier. */
export const describePersonalisation = (line: PersonalisationLine): string => {
  const parts: string[] = []
  if (line.lettering) parts.push(`"${line.lettering}"`)
  if (line.symbolName) parts.push(line.symbolName)
  if (!parts.length) return ''

  const thread = line.threadName ? ` in ${line.threadName}` : ''
  return `${line.placementName}: ${parts.join(' + ')}${thread}`
}

export const describePersonalisationList = (lines: PersonalisationLine[]): string =>
  lines.map(describePersonalisation).filter(Boolean).join('; ')
