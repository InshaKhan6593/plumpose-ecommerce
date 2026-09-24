import type { Endpoint, PayloadRequest } from 'payload'

import type { Country, Currency, SiteSetting } from '@/payload-types'

import { BASE_CURRENCY, type DisplayCurrency, isQuotable } from '@/lib/pricing/currency'

/**
 * Where a visitor is, and what they may choose (REQUIREMENTS S7).
 *
 *   GET /api/locale          — the country the request comes from (the host's
 *                               geolocation header) and that country's currency,
 *                               plus her settings. No header, no guess: QAR.
 *   GET /api/locale/options  — every country and every currency that can be
 *                               priced, for the picker. Public data, cached.
 *
 * Only the display changes. What is charged is always QAR.
 */

const json = (body: unknown, cache = 'no-store'): Response =>
  new Response(JSON.stringify(body), { headers: { 'Cache-Control': cache, 'Content-Type': 'application/json' } })

export type LocaleSettings = { anchorQar: number; detect: boolean; enabled: boolean }

const localeSettings = (s: Partial<SiteSetting>): LocaleSettings => ({
  anchorQar: s.currencyAnchorQar && s.currencyAnchorQar > 0 ? s.currencyAnchorQar : 1399,
  detect: s.currencyDetectLocation !== false,
  enabled: s.currencyDisplayEnabled !== false,
})

const toDisplay = (c: Currency): DisplayCurrency => ({
  code: c.code,
  decimals: c.decimals ?? 0,
  name: c.name,
  price: c.priceOverride ?? null,
  rate: c.rate ?? null,
  step: c.step ?? 1,
  symbol: c.symbol,
})

/**
 * The visitor's country, as the host reports it: Vercel, Cloudflare and
 * CloudFront each set one. Outside production `?country=GB` stands in, so the
 * behaviour can be tried locally, where there is no such header.
 */
const countryOf = (req: PayloadRequest): null | string => {
  const header =
    req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || req.headers.get('cloudfront-viewer-country')
  const trial = process.env.NODE_ENV !== 'production' ? req.searchParams?.get('country') : null
  const code = (trial || header || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1' ? code : null
}

export const localeEndpoint: Endpoint = {
  handler: async (req) => {
    const settings = localeSettings((await req.payload.findGlobal({ depth: 0, slug: 'siteSettings' })) as Partial<SiteSetting>)
    const code = settings.enabled && settings.detect ? countryOf(req) : null

    let country: null | Pick<Country, 'blockedReason' | 'code' | 'name'> = null
    let currencyCode = BASE_CURRENCY

    if (code) {
      const found = (
        await req.payload.find({ collection: 'countries', depth: 0, limit: 1, where: { code: { equals: code } } })
      ).docs[0] as Country | undefined
      if (found) {
        country = { blockedReason: found.blockedReason ?? null, code: found.code, name: found.name }
        const currency = (
          await req.payload.find({ collection: 'currencies', depth: 0, limit: 1, where: { code: { equals: found.currencyCode } } })
        ).docs[0] as Currency | undefined
        // Only a currency she can quote in; otherwise the visitor starts in QAR.
        if (currency && isQuotable(toDisplay(currency), settings.anchorQar)) currencyCode = currency.code
      }
    }

    return json({ ...settings, detected: { country, currencyCode } })
  },
  method: 'get',
  path: '/locale',
}

export const localeOptionsEndpoint: Endpoint = {
  handler: async (req) => {
    const settings = localeSettings((await req.payload.findGlobal({ depth: 0, slug: 'siteSettings' })) as Partial<SiteSetting>)
    const [countries, currencies] = await Promise.all([
      req.payload.find({ collection: 'countries', depth: 0, limit: 500, pagination: false, sort: 'name' }),
      req.payload.find({ collection: 'currencies', depth: 0, limit: 500, pagination: false, sort: 'code' }),
    ])

    return json(
      {
        ...settings,
        countries: (countries.docs as Country[]).map((c) => ({
          blockedReason: c.blockedReason ?? null,
          code: c.code,
          currencyCode: c.currencyCode,
          name: c.name,
        })),
        currencies: (currencies.docs as Currency[]).map(toDisplay).filter((c) => isQuotable(c, settings.anchorQar)),
      },
      // Five minutes: a price she changes shows within that, and the list is not fetched on every page.
      'public, max-age=300',
    )
  },
  method: 'get',
  path: '/locale/options',
}
