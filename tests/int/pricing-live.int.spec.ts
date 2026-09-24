import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { toMajor } from '@/lib/pricing/money'
import { personalisationRules } from '@/lib/pricing/personalisation'
import { priceOrder, type PriceOrderContext } from '@/lib/pricing/priceOrder'
import { deliveryFor } from '@/lib/pricing/shipping'

/**
 * The pricing engine against the **real seeded data**.
 *
 * `pricing.int.spec.ts` proves the arithmetic with fixtures. This proves the
 * arithmetic is being fed the right rows — which is the other half, and the
 * half that fixtures cannot test. A key renamed in the seed, a zone the
 * countries table points at but the zones table does not define, a
 * personalisation option whose `key` never generated: none of that shows up
 * against hand-written fixtures, and all of it would break a live checkout.
 *
 * These read the database and never write to it.
 */

let payload: Payload
let context: PriceOrderContext
let productId: number

const load = async () => {
  const [countries, cities, zones, options, settings] = await Promise.all([
    payload.find({ collection: 'countries', limit: 500, pagination: false }),
    payload.find({ collection: 'shippingCities', limit: 200, pagination: false }),
    payload.find({ collection: 'shippingZones', limit: 200, pagination: false }),
    payload.find({ collection: 'personalisationOptions', limit: 200, pagination: false }),
    payload.findGlobal({ slug: 'siteSettings' }),
  ])

  return {
    personalisationRules: personalisationRules(options.docs, settings),
    settings,
    shipping: { cities: cities.docs, countries: countries.docs, zones: zones.docs },
  }
}

describe('pricing engine against seeded data', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    context = await load()

    // Her real piece by name — not "the first product", which a demo catalogue changes.
    const products = await payload.find({
      collection: 'products',
      limit: 1,
      where: { and: [{ _status: { equals: 'published' } }, { slug: { equals: 'al-shaheen-nights' } }] },
    })
    productId = products.docs[0]?.id
  }, 120_000)

  it('has the reference tables the engine depends on', () => {
    expect(context.shipping.countries.length).toBeGreaterThan(200)
    expect(context.shipping.cities.length).toBeGreaterThan(0)
    expect(context.shipping.zones.length).toBeGreaterThan(0)
    expect(context.personalisationRules.options.length).toBeGreaterThan(0)
  })

  /**
   * The integrity check that matters most: `countries.zoneKey` is a loose
   * string, so nothing stops it pointing at a zone that does not exist. Every
   * country that is not blocked and not Qatar must resolve to a real zone, or
   * a customer there reaches checkout and cannot be quoted.
   */
  it('can price delivery to every country it claims to serve', () => {
    const unpriceable: string[] = []

    for (const country of context.shipping.countries) {
      if (country.blockedReason) continue

      const destination =
        country.zoneKey === 'qatar'
          ? { cityKey: context.shipping.cities[0]?.key, countryCode: country.code }
          : { countryCode: country.code }

      const result = deliveryFor(destination, context.shipping, context.settings)
      if (!result.ok) unpriceable.push(`${country.code} (${country.name}) -> ${country.zoneKey}`)
    }

    expect(unpriceable).toEqual([])
  })

  it('refuses every blocked country, with a reason', () => {
    const blocked = context.shipping.countries.filter((c) => c.blockedReason)
    expect(blocked.length).toBeGreaterThan(0)

    for (const country of blocked) {
      const result = deliveryFor({ countryCode: country.code }, context.shipping, context.settings)
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.refusal.blocked).toBe(true)
      expect(result.refusal.message).toContain(country.blockedReason as string)
    }
  })

  it('charges every seeded Qatar city a real fee', () => {
    for (const city of context.shipping.cities) {
      const result = deliveryFor(
        { cityKey: city.key, countryCode: 'QA' },
        context.shipping,
        context.settings,
      )
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.quote.feeQar).toBeGreaterThan(0)
      expect(result.quote.label).toContain(city.name)
    }
  })

  /**
   * The seeded personalisation options must carry the keys the engine matches
   * on. `autoKey` generates them on create, so a hand-added option could have
   * a null key and silently never be selectable.
   */
  it('has a usable key on every personalisation option', () => {
    const keyless = context.personalisationRules.options
      .filter((o) => !o.key)
      .map((o) => `${o.type}: ${o.name}`)

    expect(keyless).toEqual([])
  })

  it('offers at least one of each personalisation option type', () => {
    const types = new Set(context.personalisationRules.options.map((o) => o.type))
    expect([...types].sort()).toEqual(['placement', 'style', 'symbol', 'thread'])
  })

  it('prices the real product to a real Qatar address', async () => {
    const product = await payload.findByID({ collection: 'products', id: productId })
    const result = priceOrder(
      {
        destination: { cityKey: 'doha', countryCode: 'QA' },
        lines: [{ product, quantity: 1 }],
      },
      context,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Al Shaheen Nights is QAR 1,399; Doha delivery is QAR 20.
    expect(toMajor(result.order.subtotal)).toBe(1399)
    expect(toMajor(result.order.shipping)).toBe(20)
    expect(toMajor(result.order.total)).toBe(1419)
  })

  it('prices real embroidery from the seeded options', async () => {
    const product = await payload.findByID({ collection: 'products', id: productId })
    const placement = context.personalisationRules.options.find((o) => o.type === 'placement')
    const thread = context.personalisationRules.options.find((o) => o.type === 'thread')

    const result = priceOrder(
      {
        destination: { cityKey: 'doha', countryCode: 'QA' },
        lines: [
          {
            personalisation: [
              { lettering: 'AK', placement: placement?.key, style: 'text', thread: thread?.key },
            ],
            product,
            quantity: 1,
          },
        ],
      },
      context,
    )

    if (!result.ok) throw new Error('expected a priced order')

    const line = result.order.lines[0]
    expect(line.personalisation).toHaveLength(1)
    expect(line.personalisation[0].placementName).toBe(placement?.name)
    expect(line.personalisation[0].threadName).toBe(thread?.name)
    // QAR 1,399 + 160 embroidery + 20 delivery
    expect(toMajor(result.order.total)).toBe(1579)
  })

  it('prices the real product with its real variants', async () => {
    const variants = await payload.find({ collection: 'variants', limit: 10 })
    expect(variants.docs.length).toBeGreaterThan(0)

    const product = await payload.findByID({ collection: 'products', id: productId })

    for (const variant of variants.docs) {
      const result = priceOrder(
        {
          destination: { cityKey: 'doha', countryCode: 'QA' },
          lines: [{ product, quantity: 1, variant }],
        },
        context,
      )
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.order.total).toBeGreaterThan(0)
    }
  })

  /**
   * The display-currency table (C21).
   *
   * `rate` is empty on every row and that is **not** a gap: the legacy
   * `pricing.mjs` stored a hand-set price per market and derived the rate from
   * it (`price / BASE_PRICE`), precisely so a market price is never moved by a
   * rate refresh. `priceOverride` is that hand-set figure, and all 163 rows
   * carry one — so multi-currency display is buildable today with no missing
   * data. This guards that: a row losing its price would silently fall back to
   * quoting QAR at a market that had its own price yesterday.
   */
  it('has a hand-set price for every currency it offers', async () => {
    const currencies = await payload.find({
      collection: 'currencies',
      limit: 500,
      pagination: false,
    })
    expect(currencies.docs.length).toBeGreaterThan(150)

    const unpriced = currencies.docs
      .filter((c) => !(typeof c.priceOverride === 'number' && c.priceOverride > 0))
      .map((c) => c.code)

    expect(unpriced).toEqual([])
  })

  it('anchors the base currency to the product price', async () => {
    const qar = await payload.find({
      collection: 'currencies',
      limit: 1,
      where: { code: { equals: 'QAR' } },
    })
    const product = await payload.findByID({ collection: 'products', id: productId })

    // The QAR row must agree with the product, or every derived rate is skewed.
    expect(qar.docs[0]?.priceOverride).toBe(toMajor(product.priceInQAR ?? 0))
  })
})
