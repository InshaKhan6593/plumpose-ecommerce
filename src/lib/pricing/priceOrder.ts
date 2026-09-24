import type { Product, SiteSetting, Variant } from '@/payload-types'

import { clampToZero, type Minor, percentOf, toMinor } from './money'
import {
  type PersonalisationInput,
  type PersonalisationLine,
  normalisePersonalisationList,
  personalisationFeeForLine,
  type PersonalisationRules,
} from './personalisation'
import {
  type Destination,
  deliveryFor,
  type DeliveryRefusal,
  qualifiesForFreeShipping,
  type ShippingTables,
} from './shipping'

/**
 * The pricing engine (P6).
 *
 * One function decides what a basket costs, and **everything** goes through
 * it: the quote the storefront displays, the amount registered with SkipCash,
 * and the figures written onto the order. The legacy site's rule was that a
 * price can never drift between what the customer is shown and what the card
 * is charged; the only way to keep that true is to have a single place that
 * computes it.
 *
 * Nothing here trusts the browser. The caller passes product and variant
 * *records*, not prices — the price is read from the record every time, so a
 * tampered basket re-prices to the real figure rather than being rejected with
 * a message that tells an attacker what to change.
 *
 * Every figure in and out is **minor units** (see `./money.ts`).
 */

/** A basket line as the browser describes it: what, which, how many. */
export type PriceLineInput = {
  personalisation?: PersonalisationInput[] | null
  product: Product
  quantity: number
  variant?: null | Variant
}

export type PricedLine = {
  /** Embroidery across this line: fee x placements x quantity. */
  personalisationTotal: Minor
  personalisation: PersonalisationLine[]
  productId: number
  productTitle: string
  quantity: number
  /** `unitPrice * quantity`, before embroidery. */
  subtotal: Minor
  /** What one garment costs — the variant's price when there is one. */
  unitPrice: Minor
  variantId?: number
  variantTitle?: string
}

/** A discount already validated against the code table — see `./discounts.ts`. */
export type ValidatedDiscount = {
  /**
   * When the code is restricted to certain products, only those lines are
   * discounted. Undefined means the whole basket is eligible.
   */
  appliesToProductIds?: number[]
  code: string
  type: 'fixed' | 'freeShipping' | 'percent'
  /** Major units for `fixed`, a percentage for `percent`, unused for `freeShipping`. */
  value: number
}

export type PriceOrderInput = {
  destination: Destination
  discount?: null | ValidatedDiscount
  lines: PriceLineInput[]
}

export type PriceOrderContext = {
  personalisationRules: PersonalisationRules
  settings: Partial<SiteSetting>
  shipping: ShippingTables
}

export type PricedOrder = {
  discountCode: string
  discountTotal: Minor
  freeShippingApplied: boolean
  lines: PricedLine[]
  personalisationTotal: Minor
  shipping: Minor
  shippingLabel: string
  shippingZone: string
  subtotal: Minor
  total: Minor
}

export type PriceOrderResult =
  | {
      ok: false
      refusal: DeliveryRefusal | { blocked: false; message: string; reason: 'emptyBasket' }
    }
  | { ok: true; order: PricedOrder }

/**
 * The price of one garment. A variant price wins when it is set, because
 * sizes may be priced differently; otherwise the product's own price applies.
 * Both are already in minor units — they are the plugin's fields.
 */
const unitPriceFor = (product: Product, variant?: null | Variant): Minor => {
  const variantPrice = variant?.priceInQAR
  if (typeof variantPrice === 'number' && variantPrice > 0) return variantPrice

  return product.priceInQAR ?? 0
}

/** Prices one basket line, rebuilding its personalisation from our own tables. */
const priceLine = (input: PriceLineInput, rules: PersonalisationRules): PricedLine => {
  const quantity = Math.max(1, Math.floor(input.quantity || 1))
  const unitPrice = unitPriceFor(input.product, input.variant)
  const personalisation = normalisePersonalisationList(input.personalisation, rules)

  return {
    personalisation,
    personalisationTotal: personalisationFeeForLine(personalisation, quantity),
    productId: input.product.id,
    productTitle: input.product.title,
    quantity,
    subtotal: unitPrice * quantity,
    unitPrice,
    variantId: input.variant?.id,
    variantTitle: input.variant?.title ?? undefined,
  }
}

/**
 * Applies a validated discount to the goods total.
 *
 * Discounts come off **goods, not delivery** — a percentage that also
 * discounted shipping would quietly erode the delivery margin the zone table
 * exists to protect. `freeShipping` is the one that touches delivery, and it
 * does so by waiving it outright rather than by discounting the total.
 *
 * The result is clamped so a fixed discount larger than the basket cannot
 * produce a negative order.
 */
const applyDiscount = (
  lines: PricedLine[],
  discount: null | undefined | ValidatedDiscount,
): { discountTotal: Minor; waivesShipping: boolean } => {
  if (!discount) return { discountTotal: 0, waivesShipping: false }

  if (discount.type === 'freeShipping') {
    return { discountTotal: 0, waivesShipping: true }
  }

  /**
   * A restricted code discounts only the lines it covers. A 10%-off code for
   * one piece must not take 10% off a bag that also contains two others —
   * applying it to the whole basket would quietly overspend the promotion.
   */
  const eligible = discount.appliesToProductIds
    ? lines.filter((line) => discount.appliesToProductIds?.includes(line.productId))
    : lines

  const eligibleTotal = eligible.reduce(
    (total, line) => total + line.subtotal + line.personalisationTotal,
    0,
  )

  const raw =
    discount.type === 'percent' ? percentOf(eligibleTotal, discount.value) : toMinor(discount.value)

  return { discountTotal: Math.min(raw, eligibleTotal), waivesShipping: false }
}

/**
 * Prices the goods and the embroidery only — step 1 of `priceOrder`, before
 * any destination is known. This is what the bag shows ("delivery calculated
 * at checkout"). It is the same `priceLine` checkout uses, so the bag and the
 * charge cannot disagree about a piece or a placement.
 */
export const priceGoods = (
  lines: PriceLineInput[],
  rules: PersonalisationRules,
): { lines: PricedLine[]; personalisationTotal: Minor; subtotal: Minor; total: Minor } => {
  const priced = lines.map((line) => priceLine(line, rules))
  const subtotal = priced.reduce((total, line) => total + line.subtotal, 0)
  const personalisationTotal = priced.reduce((total, line) => total + line.personalisationTotal, 0)

  return { lines: priced, personalisationTotal, subtotal, total: subtotal + personalisationTotal }
}

/**
 * Prices a whole basket for a destination.
 *
 * Order of operations matters and is deliberate:
 *   1. price the goods and the embroidery
 *   2. apply the discount to that goods total
 *   3. decide free shipping on the **discounted** goods total
 *   4. add delivery
 *
 * Step 3 is the subtle one. Testing the threshold against the discounted
 * figure means a code cannot be used to tip a basket over the free-delivery
 * line it no longer reaches — otherwise a 50%-off code on a QAR 1,600 basket
 * would win free delivery on QAR 800 of goods.
 */
export const priceOrder = (
  input: PriceOrderInput,
  context: PriceOrderContext,
): PriceOrderResult => {
  if (!input.lines?.length) {
    return {
      ok: false,
      refusal: { blocked: false, message: 'Your bag is empty.', reason: 'emptyBasket' },
    }
  }

  const {
    lines,
    personalisationTotal,
    subtotal,
    total: goodsTotal,
  } = priceGoods(input.lines, context.personalisationRules)

  const { discountTotal, waivesShipping } = applyDiscount(lines, input.discount)
  const discountedGoods = clampToZero(goodsTotal - discountTotal)

  const delivery = deliveryFor(input.destination, context.shipping, context.settings)
  if (!delivery.ok) return { ok: false, refusal: delivery.refusal }

  const earnedFreeShipping = qualifiesForFreeShipping(discountedGoods, context.settings)
  const shippingWaived = earnedFreeShipping || waivesShipping
  const shipping = shippingWaived ? 0 : delivery.quote.feeQar

  return {
    ok: true,
    order: {
      discountCode: input.discount?.code ?? '',
      discountTotal,
      freeShippingApplied: earnedFreeShipping,
      lines,
      personalisationTotal,
      shipping,
      shippingLabel: shippingWaived ? 'Delivery — with our compliments' : delivery.quote.label,
      shippingZone: delivery.quote.zoneKey,
      subtotal,
      total: discountedGoods + shipping,
    },
  }
}
