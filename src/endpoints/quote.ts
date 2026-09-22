import type { Endpoint, PayloadRequest } from 'payload'

import type { Product, Variant } from '@/payload-types'

import { validateDiscountCode } from '@/lib/pricing/discounts'
import { toMajor } from '@/lib/pricing/money'
import { personalisationRules } from '@/lib/pricing/personalisation'
import {
  type PriceLineInput,
  priceOrder,
  type PriceOrderContext,
  type ValidatedDiscount,
} from '@/lib/pricing/priceOrder'

/**
 * `POST /api/quote` — price a bag (P6, P8).
 *
 * The one endpoint the storefront asks "what does this cost?", and the same
 * engine the payment adapter will call before registering an amount. Having
 * both go through this is what keeps the displayed price and the charged price
 * identical — the rule carried over from the legacy site.
 *
 * **The browser sends identifiers, never money.** Product and variant prices
 * are read from the database on every request, personalisation is rebuilt from
 * the options table, and shipping is looked up from the zone tables. A basket
 * edited in the console re-prices to the truth rather than being rejected with
 * a message that tells an attacker what to change.
 *
 * It is deliberately side-effect free: quoting never reserves stock and never
 * consumes a discount code.
 */

const MAX_LINES = 10
const MAX_QUANTITY = 10

type QuoteLineRequest = {
  personalisation?: unknown
  productId?: unknown
  quantity?: unknown
  variantId?: unknown
}

type QuoteRequest = {
  city?: unknown
  country?: unknown
  discountCode?: unknown
  email?: unknown
  items?: unknown
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })

const asId = (value: unknown): null | number => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const asText = (value: unknown, max: number): string =>
  String(value ?? '')
    .trim()
    .slice(0, max)

export const quoteEndpoint: Endpoint = {
  handler: async (req: PayloadRequest): Promise<Response> => {
    const { payload } = req

    let body: QuoteRequest
    try {
      body = ((await req.json?.()) ?? {}) as QuoteRequest
    } catch {
      return json({ error: 'Could not read that request.' }, 400)
    }

    const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_LINES) : []
    if (!rawItems.length) return json({ error: 'Your bag is empty.' }, 400)

    /**
     * Resolve every line to real records first. A line naming a product that
     * does not exist, is not published, or whose variant belongs to a
     * different product is dropped rather than priced.
     */
    const lines: PriceLineInput[] = []

    for (const raw of rawItems as QuoteLineRequest[]) {
      const productId = asId(raw?.productId)
      if (!productId) continue

      const product = (await payload
        .findByID({ collection: 'products', depth: 0, id: productId })
        .catch(() => null)) as null | Product

      if (!product || product._status !== 'published') continue

      let variant: null | Variant = null
      const variantId = asId(raw?.variantId)

      if (variantId) {
        variant = (await payload
          .findByID({ collection: 'variants', depth: 0, id: variantId })
          .catch(() => null)) as null | Variant

        /** A variant from another product would price this bag wrongly. */
        const owner = typeof variant?.product === 'number' ? variant.product : variant?.product?.id
        if (!variant || owner !== product.id) variant = null
      }

      lines.push({
        personalisation: Array.isArray(raw?.personalisation)
          ? (raw.personalisation as PriceLineInput['personalisation'])
          : null,
        product,
        quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(raw?.quantity) || 1))),
        variant,
      })
    }

    if (!lines.length) return json({ error: 'Nothing in your bag is available to order.' }, 400)

    const [countries, cities, zones, options, settings] = await Promise.all([
      payload.find({ collection: 'countries', depth: 0, limit: 500, pagination: false }),
      payload.find({ collection: 'shippingCities', depth: 0, limit: 200, pagination: false }),
      payload.find({ collection: 'shippingZones', depth: 0, limit: 200, pagination: false }),
      payload.find({
        collection: 'personalisationOptions',
        depth: 0,
        limit: 200,
        pagination: false,
      }),
      payload.findGlobal({ slug: 'siteSettings' }),
    ])

    const context: PriceOrderContext = {
      personalisationRules: personalisationRules(options.docs, settings),
      settings,
      shipping: { cities: cities.docs, countries: countries.docs, zones: zones.docs },
    }

    /**
     * The discount is validated against the *undiscounted* goods total, so
     * price once without it to get that figure, then price again with it.
     * Cheap — the engine is pure and touches no database.
     */
    const base = priceOrder(
      { destination: { countryCode: asText(body.country, 2) }, lines },
      context,
    )
    const goodsTotal = base.ok ? base.order.subtotal + base.order.personalisationTotal : 0

    let discount: null | ValidatedDiscount = null
    let discountError: null | string = null

    const requestedCode = asText(body.discountCode, 40)
    if (requestedCode) {
      const result = await validateDiscountCode(payload, requestedCode, {
        email: asText(body.email, 255).toLowerCase(),
        goodsTotal,
        productIds: lines.map((line) => line.product.id),
      })

      if (result.ok) discount = result.discount
      else discountError = result.refusal.message
    }

    const priced = priceOrder(
      {
        destination: { cityKey: asText(body.city, 40), countryCode: asText(body.country, 2) },
        discount,
        lines,
      },
      context,
    )

    if (!priced.ok) {
      return json(
        {
          blocked: priced.refusal.blocked,
          error: priced.refusal.message,
          reason: priced.refusal.reason,
        },
        priced.refusal.blocked ? 403 : 400,
      )
    }

    const { order } = priced

    return json({
      currency: 'QAR',
      /** Present when a code was sent but could not be used. The bag is still priced. */
      discountError,
      lines: order.lines.map((line) => ({
        personalisation: line.personalisation,
        personalisationTotal: line.personalisationTotal,
        productId: line.productId,
        quantity: line.quantity,
        subtotal: line.subtotal,
        title: line.productTitle,
        unitPrice: line.unitPrice,
        variantId: line.variantId,
        variantTitle: line.variantTitle,
      })),
      totals: {
        discount: order.discountTotal,
        discountCode: order.discountCode,
        freeShippingApplied: order.freeShippingApplied,
        personalisation: order.personalisationTotal,
        shipping: order.shipping,
        shippingLabel: order.shippingLabel,
        shippingZone: order.shippingZone,
        subtotal: order.subtotal,
        total: order.total,
      },
      /** Major units alongside, so a display bug cannot become a pricing bug. */
      totalsInQar: {
        discount: toMajor(order.discountTotal),
        personalisation: toMajor(order.personalisationTotal),
        shipping: toMajor(order.shipping),
        subtotal: toMajor(order.subtotal),
        total: toMajor(order.total),
      },
    })
  },
  method: 'post',
  path: '/quote',
}
