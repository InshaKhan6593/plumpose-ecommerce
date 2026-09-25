import type { Endpoint, PayloadRequest } from 'payload'

import { timingSafeEqual } from 'node:crypto'

import { checkRole } from '@/access/utilities'
import { fetchRates } from '@/lib/pricing/rates'

/**
 * POST (or GET) /api/currencies/refresh-rates — fetches today's rates and
 * writes each currency's rate and "rates updated" time (REQUIREMENTS A14).
 * Hand-set prices are never touched.
 *
 * Allowed for an admin (the button on the Currencies screen), or for the
 * host's daily scheduled job with `Authorization: Bearer <CRON_SECRET>` —
 * how Vercel Cron calls a route (see BUILD-LOG §29).
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }, status })

const fromCron = (req: PayloadRequest): boolean => {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || !given || given.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret))
}

/** A GET is only for the scheduled job: a signed-in admin's browser could be made to send one by any page. */
const handlerFor = (adminAllowed: boolean): Endpoint['handler'] => async (req) => {
  const isAdmin = adminAllowed && Boolean(req.user && checkRole(['admin'], req.user as never))
  if (!isAdmin && !fromCron(req)) return json({ error: 'Only an admin can refresh the rates.' }, 403)

  let rates: Awaited<ReturnType<typeof fetchRates>>
  try {
    rates = await fetchRates()
  } catch (error) {
    req.payload.logger.error({ err: error }, 'Exchange rates could not be fetched.')
    return json({ error: 'The exchange-rate service could not be reached. Please try again later.' }, 502)
  }

  const { docs } = await req.payload.find({ collection: 'currencies', depth: 0, limit: 1000, overrideAccess: true, pagination: false, req, select: { code: true } })
  let updated = 0
  const missing: string[] = []
  for (const currency of docs) {
    const rate = rates.rates[currency.code]
    if (!rate) {
      if (currency.code !== 'QAR') missing.push(currency.code)
      continue
    }
    await req.payload.update({ collection: 'currencies', data: { rate, rateUpdatedAt: rates.updatedAt }, id: currency.id, overrideAccess: true, req })
    updated++
  }

  req.payload.logger.info({ missing, updated }, 'Exchange rates refreshed.')
  return json({ missing, ratesFrom: rates.updatedAt, updated })
}

export const refreshRatesEndpoint: Endpoint = { handler: handlerFor(true), method: 'post', path: '/refresh-rates' }
/** Vercel Cron calls with GET, carrying CRON_SECRET. */
export const refreshRatesCronEndpoint: Endpoint = { handler: handlerFor(false), method: 'get', path: '/refresh-rates' }
