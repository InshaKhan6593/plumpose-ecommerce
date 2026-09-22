import type { Cart, Product, Variant } from '@/payload-types'
import type { PayloadRequest } from 'payload'

import { validateDiscountCode } from '@/lib/pricing/discounts'
import { personalisationRules } from '@/lib/pricing/personalisation'
import {
  type PriceLineInput,
  priceOrder,
  type PriceOrderContext,
  type PriceOrderResult,
  type ValidatedDiscount,
} from '@/lib/pricing/priceOrder'

/**
 * Prices a stored cart for payment.
 *
 * This exists because of a real trap in the plugin's stock Stripe adapter:
 *
 * ```js
 * const amount = cart.subtotal   // adapters/stripe/initiatePayment.js
 * ```
 *
 * `cart.subtotal` is the goods total and nothing else. Charging it would take
 * **QAR 1,399** for a bag that costs **QAR 1,579** once delivery and hand
 * embroidery are counted — the customer is undercharged and the shortfall is
 * invisible until the month-end reconciliation. Any adapter we ship, for any
 * provider, has to price through `priceOrder()` instead.
 *
 * Re-pricing here is also the P6 requirement in its own right: the amount
 * registered with the gateway is computed from the database at the moment of
 * payment, never carried over from the quote the browser was shown.
 */

/**
 * The parts of a cart this needs.
 *
 * Deliberately structural rather than the generated `Cart`: the plugin hands
 * adapters its own `DefaultCartType`, which carries the same fields but not
 * `createdAt`/`updatedAt`. Naming only what is read keeps both shapes usable
 * without a cast that would hide a genuine mismatch later.
 */
export type PriceableCart = {
  discountCode?: null | string
  id: number | string
  items?: Cart['items']
  shippingCityKey?: null | string
}

export type CartPricingResult = {
  discount: null | ValidatedDiscount
  discountError: null | string
  priced: PriceOrderResult
}

/** Loads the reference tables the engine prices against. */
export const loadPricingContext = async (req: PayloadRequest): Promise<PriceOrderContext> => {
  const { payload } = req

  const [countries, cities, zones, options, settings] = await Promise.all([
    payload.find({ collection: 'countries', depth: 0, limit: 500, pagination: false, req }),
    payload.find({ collection: 'shippingCities', depth: 0, limit: 200, pagination: false, req }),
    payload.find({ collection: 'shippingZones', depth: 0, limit: 200, pagination: false, req }),
    payload.find({
      collection: 'personalisationOptions',
      depth: 0,
      limit: 200,
      pagination: false,
      req,
    }),
    payload.findGlobal({ slug: 'siteSettings', req }),
  ])

  return {
    personalisationRules: personalisationRules(options.docs, settings),
    settings,
    shipping: { cities: cities.docs, countries: countries.docs, zones: zones.docs },
  }
}

const idOf = (value: unknown): null | number => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: number }).id
  return null
}

/**
 * Turns stored cart items into engine input, reading each product and variant
 * fresh so a price changed in the admin since the bag was filled is the price
 * that gets charged.
 */
const linesFromCart = async (
  cart: PriceableCart,
  req: PayloadRequest,
): Promise<PriceLineInput[]> => {
  const { payload } = req
  const lines: PriceLineInput[] = []

  for (const item of cart.items ?? []) {
    const productId = idOf(item.product)
    if (!productId) continue

    const product = (await payload
      .findByID({ collection: 'products', depth: 0, id: productId, req })
      .catch(() => null)) as null | Product

    if (!product) continue

    const variantId = idOf(item.variant)
    const variant = variantId
      ? ((await payload
          .findByID({ collection: 'variants', depth: 0, id: variantId, req })
          .catch(() => null)) as null | Variant)
      : null

    lines.push({
      /**
       * Personalisation is re-validated by the engine even though it was
       * already validated when it went into the bag — the options table may
       * have changed, and a placement the client has since withdrawn must not
       * be stitched just because it was added last week.
       */
      personalisation: item.personalisation as PriceLineInput['personalisation'],
      product,
      quantity: Math.max(1, item.quantity ?? 1),
      variant,
    })
  }

  return lines
}

/**
 * Prices a cart for a destination, re-validating any attached discount code.
 *
 * A code that has expired or been used up since it was attached is dropped and
 * reported rather than silently honoured — the customer pays the correct
 * amount, and `discountError` says why it changed.
 */
export const priceCart = async (args: {
  cart: PriceableCart
  context: PriceOrderContext
  customerEmail?: null | string
  /** ISO-2 from the shipping address. */
  countryCode: string
  req: PayloadRequest
}): Promise<CartPricingResult> => {
  const lines = await linesFromCart(args.cart, args.req)

  const destination = {
    cityKey: args.cart.shippingCityKey,
    countryCode: args.countryCode,
  }

  let discount: null | ValidatedDiscount = null
  let discountError: null | string = null

  if (args.cart.discountCode) {
    const withoutDiscount = priceOrder({ destination, lines }, args.context)
    const goodsTotal = withoutDiscount.ok
      ? withoutDiscount.order.subtotal + withoutDiscount.order.personalisationTotal
      : 0

    const result = await validateDiscountCode(args.req.payload, args.cart.discountCode, {
      email: args.customerEmail,
      goodsTotal,
      productIds: lines.map((line) => line.product.id),
    })

    if (result.ok) discount = result.discount
    else discountError = result.refusal.message
  }

  return {
    discount,
    discountError,
    priced: priceOrder({ destination, discount, lines }, args.context),
  }
}
