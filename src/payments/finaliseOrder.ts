import type { PayloadRequest } from 'payload'

import type { Cart } from '@/payload-types'

import { redeemDiscount, validateDiscountCode } from '@/lib/pricing/discounts'
import type { Minor } from '@/lib/pricing/money'

/**
 * Turning a paid cart into an order.
 *
 * The plugin creates the order, decrements stock and marks the transaction
 * settled. What it cannot know is anything plumpose-specific, so this fills
 * three gaps at the one seam the plugin offers — the `finalizeOrder` callback:
 *
 *   1. **The money breakdown.** The plugin records a single `amount`. The
 *      order needs the parts behind it, or nobody can answer "why was this
 *      QAR 1,719?" and month-end reconciliation has nothing to check against.
 *   2. **Personalisation.** Taken from the priced lines stored on the cart, not
 *      from the gateway's metadata round-trip — Stripe caps a metadata value at
 *      500 characters, which two embroidery placements can exceed.
 *   3. **Discount redemption.** Only here, on confirmed payment — never at
 *      quote time. See `@/lib/pricing/discounts`.
 */

/** One priced line, as the engine validated it. */
export type SnapshotLine = {
  personalisation: unknown[]
  productId: number
  quantity: number
  variantId?: number
}

/** Written onto the cart at `initiatePayment`, read back here. */
export type PricingSnapshot = {
  discountCode: string
  discountTotal: Minor
  freeShippingApplied: boolean
  /**
   * The engine's own lines, not the browser's. The cart stores whatever was
   * added to the bag; these carry the *resolved* embroidery — `placementName`,
   * `threadName` and the fee charged — which is what the atelier works from
   * and what the customer actually paid for.
   */
  lines: SnapshotLine[]
  personalisationTotal: Minor
  shipping: Minor
  shippingLabel: string
  shippingZone: string
  subtotal: Minor
  total: Minor
}

const isSnapshot = (value: unknown): value is PricingSnapshot =>
  Boolean(value) && typeof value === 'object' && 'total' in (value as Record<string, unknown>)

/**
 * The breakdown fields, mapped onto the order.
 *
 * Returns nothing when there is no snapshot: an order with a correct `amount`
 * and a blank breakdown is recoverable, whereas one carrying zeros would look
 * like a bag that genuinely cost nothing to deliver.
 */
export const orderTotalsFromSnapshot = (snapshot: unknown): Record<string, unknown> => {
  if (!isSnapshot(snapshot)) return {}

  return {
    discountCode: snapshot.discountCode || undefined,
    discountTotalQar: snapshot.discountTotal,
    freeShippingApplied: snapshot.freeShippingApplied,
    personalisationTotalQar: snapshot.personalisationTotal,
    shippingLabel: snapshot.shippingLabel,
    shippingQar: snapshot.shipping,
    shippingZone: snapshot.shippingZone,
    subtotalQar: snapshot.subtotal,
  }
}

/**
 * Re-attaches personalisation to the order lines, from the **priced** lines.
 *
 * Deliberately not from the raw cart: the bag stores what the browser added
 * (`placement: "pocket"`), while the engine resolves it (`placementName:
 * "Pocket"`, `threadName: "Gold"`, `feeQar: 16000`). An order carrying the raw
 * version gives the atelier a placement with no name and no fee to reconcile
 * against.
 *
 * Matching on product/variant/quantity is enough because these are the lines
 * that were just paid for, and the same piece with different embroidery is
 * already two separate lines.
 */
export const itemsWithPersonalisation = (items: unknown, snapshot: unknown): unknown => {
  if (!Array.isArray(items) || !isSnapshot(snapshot) || !snapshot.lines?.length) return items

  const idOf = (value: unknown): unknown =>
    value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value

  return items.map((item) => {
    const row = item as Record<string, unknown>

    const match = snapshot.lines.find(
      (line) =>
        line.productId === idOf(row.product) &&
        (line.variantId ?? undefined) === (idOf(row.variant) ?? undefined) &&
        line.quantity === row.quantity,
    )

    if (!match?.personalisation?.length) return item
    return { ...row, personalisation: match.personalisation }
  })
}

/**
 * Consumes the discount code attached to a paid cart.
 *
 * Deliberately non-throwing. The customer has already been charged and the
 * order already exists; failing the request now would tell them the payment
 * failed when it did not. A redemption that cannot be recorded is logged as an
 * error for someone to reconcile, which is the lesser of the two problems.
 */
export const redeemCartDiscount = async (args: {
  amountQar: Minor
  cart: null | Pick<Cart, 'discountCode'>
  customerEmail: string
  orderId: number
  req: PayloadRequest
}): Promise<void> => {
  const code = args.cart?.discountCode
  if (!code || !args.customerEmail) return

  try {
    const result = await validateDiscountCode(args.req.payload, code, {
      email: args.customerEmail,
      goodsTotal: Number.MAX_SAFE_INTEGER,
      productIds: [],
    })

    if (!result.ok) {
      args.req.payload.logger.warn(
        { code, order: args.orderId, reason: result.refusal.reason },
        'Paid order carried a discount code that no longer validates — not recorded as redeemed.',
      )
      return
    }

    await redeemDiscount(args.req.payload, {
      amountQar: args.amountQar,
      code: result.code,
      email: args.customerEmail,
      orderId: args.orderId,
      req: args.req,
    })
  } catch (error) {
    args.req.payload.logger.error(
      { code, err: error, order: args.orderId },
      'Could not record a discount redemption for a paid order. Reconcile by hand.',
    )
  }
}
