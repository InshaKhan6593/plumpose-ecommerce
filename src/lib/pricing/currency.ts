import type { Minor } from './money'

import { formatQar, MINOR_UNITS_PER_MAJOR } from './money'

/**
 * Display currencies (REQUIREMENTS C21, S7) — the old site's rule, kept:
 *
 *   - Every currency has a **price set by hand** for the flagship piece (her
 *     "set by hand" rows in `netlify/lib/pricing.mjs`, now the `currencies`
 *     collection). That figure is sacred: one piece shows exactly it, two
 *     pieces exactly twice it — never a conversion that lands on AED 1,409.73.
 *   - Every other amount (delivery, embroidery, a part-total, another product)
 *     converts at the rate that price *implies*, rounded to the currency's own
 *     tidy `step`, so a figure reads the way that market quotes prices.
 *   - **The card is always charged in QAR.** Nothing here touches what is
 *     charged; the storefront shows the QAR figure beside every converted one,
 *     and checkout, orders and emails stay in QAR.
 *
 * Pure, and shared by server and browser.
 */

export const BASE_CURRENCY = 'QAR'

export type DisplayCurrency = {
  code: string
  decimals: number
  name: string
  /** The hand-set price of one flagship piece in this currency — or null. */
  price: null | number
  /** Units per 1 QAR, used only when there is no hand-set price. */
  rate: null | number
  /** Round converted figures to the nearest this many units. */
  step: number
  symbol: string
}

/** Units of this currency per 1 QAR: the rate her hand-set price implies, else the stored rate. */
export const impliedRate = (currency: DisplayCurrency, anchorQar: number): null | number => {
  if (currency.price && currency.price > 0 && anchorQar > 0) return currency.price / anchorQar
  return currency.rate && currency.rate > 0 ? currency.rate : null
}

/** A currency can be offered only when there is a way to price in it. */
export const isQuotable = (currency: DisplayCurrency, anchorQar: number): boolean =>
  currency.code === BASE_CURRENCY || impliedRate(currency, anchorQar) !== null

const roundTo = (value: number, step: number) =>
  !step || step <= 1 ? Math.round(value) : Math.round(value / step) * step

/**
 * A QAR amount (minor units) in the display currency, as a number of that
 * currency's units. Exact multiples of the anchor price use the hand-set price;
 * everything else converts and rounds to the currency's step.
 */
export const convertMinor = (
  minor: Minor,
  currency: DisplayCurrency,
  anchorQar: number,
): number => {
  const qar = (minor || 0) / MINOR_UNITS_PER_MAJOR
  if (currency.code === BASE_CURRENCY) return qar

  if (currency.price && anchorQar > 0) {
    const pieces = qar / anchorQar
    if (Number.isInteger(pieces) && pieces > 0) return currency.price * pieces
  }

  const rate = impliedRate(currency, anchorQar)
  return rate === null ? qar : roundTo(qar * rate, currency.step)
}

/** "AED 1,410", "€1,234", "¥20,000" — a letter symbol takes a space, a sign does not. */
export const formatMoney = (
  amount: number,
  currency: Pick<DisplayCurrency, 'decimals' | 'symbol'>,
): string => {
  const shown = amount.toLocaleString('en-GB', {
    maximumFractionDigits: currency.decimals,
    minimumFractionDigits: currency.decimals,
  })
  return /^[A-Za-z]/.test(currency.symbol)
    ? `${currency.symbol} ${shown}`
    : `${currency.symbol}${shown}`
}

/**
 * A QAR amount as it should read to this visitor. No currency (or QAR, or one
 * that cannot be quoted) gives the house QAR format.
 */
export const displayMinor = (
  minor: Minor,
  currency: DisplayCurrency | null | undefined,
  anchorQar: number,
): string =>
  !currency || currency.code === BASE_CURRENCY || !isQuotable(currency, anchorQar)
    ? formatQar(minor)
    : formatMoney(convertMinor(minor, currency, anchorQar), currency)
