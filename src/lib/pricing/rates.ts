/**
 * Exchange rates for the currency table (REQUIREMENTS A14).
 *
 * The storefront prices a currency by the price she set by hand when there is
 * one (lib/pricing/currency.ts) — that never changes here. The live rate is
 * what a currency without a hand-set price converts at, and, beside a
 * hand-set price, a check: what today's rate would make it, and how far
 * apart the two are, so a market price that has drifted is easy to see.
 *
 * Rates by Exchange Rate API (https://www.exchangerate-api.com) — free, no
 * key, QAR as the base, updated once a day.
 */

export const RATES_URL = 'https://open.er-api.com/v6/latest/QAR'
/** Older than this, the dashboard suggests a refresh. */
export const RATES_STALE_DAYS = 7

export type Rates = { rates: Record<string, number>; updatedAt: string }

export async function fetchRates(fetcher: typeof fetch = fetch): Promise<Rates> {
  const res = await fetcher(RATES_URL, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`The rate service answered ${res.status}.`)
  const json = (await res.json()) as { base_code?: string; rates?: Record<string, unknown>; result?: string; time_last_update_unix?: number }
  if (json.result !== 'success' || json.base_code !== 'QAR' || !json.rates) throw new Error('The rate service did not return QAR rates.')
  const rates = Object.fromEntries(
    Object.entries(json.rates).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0 && /^[A-Z]{3}$/.test(entry[0])),
  )
  const updatedAt = json.time_last_update_unix ? new Date(json.time_last_update_unix * 1000).toISOString() : new Date().toISOString()
  return { rates, updatedAt }
}

/**
 * Her hand-set price against today's rate: "At today's rate 1,411" and
 * "+0.1%" (her price is that much above the rate). Null when either is missing.
 */
export function rateCheck(args: { anchorQar: number; price?: null | number; rate?: null | number }): null | { atRate: number; difference: number } {
  const { anchorQar, price, rate } = args
  if (!rate || rate <= 0 || !anchorQar) return null
  const atRate = anchorQar * rate
  if (!price || price <= 0) return { atRate, difference: 0 }
  return { atRate, difference: (price - atRate) / atRate }
}

/** "+2.4%", "−0.8%", "0.0%" */
export const formatDifference = (difference: number): string => {
  const pct = difference * 100
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)}%`
}
