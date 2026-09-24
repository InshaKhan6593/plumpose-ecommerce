import type { PersonalisationOption } from '@/payload-types'

/**
 * Hand embroidery on the storefront.
 *
 * The browser only ever sends **option keys** — which placement, which style,
 * the letters, which symbol, which thread. Names and the fee are rebuilt on
 * the server from the options table (src/lib/pricing/personalisation.ts), so
 * nothing here can change what is charged.
 */

export type EmbroideryOption = Pick<
  PersonalisationOption,
  'hex' | 'key' | 'name' | 'note' | 'svgPath' | 'type'
>

/** What goes onto a bag line — keys only, the engine's `PersonalisationInput`. */
export type EmbroideryChoice = {
  lettering: string
  placement: string
  style: 'both' | 'symbol' | 'text'
  symbol: string
  thread: string
}

export type EmbroideryRules = {
  /** Major units, as the client typed it: 160 is QAR 160. Display only. */
  feeQar: number
  leadTime: null | string
  maxChars: number
  maxPlacements: number
  returnable: boolean
}

export const wantsLetters = (style: EmbroideryChoice['style']) => style === 'text' || style === 'both'
export const wantsSymbol = (style: EmbroideryChoice['style']) => style === 'symbol' || style === 'both'

const nameOf = (options: EmbroideryOption[], type: EmbroideryOption['type'], key: string) =>
  options.find((o) => o.type === type && o.key === key)?.name ?? key

/** "Pocket: “M.K”, star, gold thread" — for the panel and the bag. */
export const describeChoice = (choice: EmbroideryChoice, options: EmbroideryOption[]): string => {
  const parts = [
    wantsLetters(choice.style) && choice.lettering ? `“${choice.lettering}”` : '',
    wantsSymbol(choice.style) && choice.symbol ? nameOf(options, 'symbol', choice.symbol).toLowerCase() : '',
    choice.thread ? `${nameOf(options, 'thread', choice.thread).toLowerCase()} thread` : '',
  ].filter(Boolean)

  return `${nameOf(options, 'placement', choice.placement)}: ${parts.join(', ')}`
}
