import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'

import { stripeAdapter } from '@payloadcms/plugin-ecommerce/payments/stripe'

import {
  itemsWithPersonalisation,
  orderTotalsFromSnapshot,
  type PricingSnapshot,
  redeemCartDiscount,
} from './finaliseOrder'
import { loadPricingContext, priceCart } from './priceCart'

/**
 * Stripe, in sandbox, as a **temporary development harness** (see §7 of the
 * requirements and `docs/BUILD-LOG.md`).
 *
 * ## Why this exists
 *
 * SkipCash sandbox credentials have not arrived, and they have external lead
 * time. Everything downstream of "a payment succeeded" — creating the order,
 * decrementing stock, consuming the discount code, sending the confirmation
 * email, the status lifecycle — is provider-agnostic and was otherwise blocked
 * behind them. Stripe unblocks that work without waiting.
 *
 * ## What it is NOT
 *
 * It is not a rehearsal of SkipCash, and the two are not interchangeable:
 *
 * | | Stripe | SkipCash |
 * |---|---|---|
 * | `initiatePayment` returns | a `clientSecret` | a `payUrl` |
 * | Customer pays | on our page, in Stripe Elements | on SkipCash's page, after a redirect |
 * | Returns via | client-side confirmation | redirect + webhook |
 *
 * **Build the checkout as a redirect flow regardless.** An inline card form
 * built around Stripe Elements is thrown away the day SkipCash arrives.
 *
 * It also cannot exercise the HMAC signature with its fixed field order —
 * which §7.2 calls the most brittle part of the integration — nor SkipCash's
 * status codes, nor its webhook shape.
 *
 * ## The amount
 *
 * The plugin's stock Stripe adapter charges `cart.subtotal`, which omits
 * delivery, embroidery and discounts. This wrapper overrides `initiatePayment`
 * so the amount comes from `priceOrder()` instead. See `./priceCart.ts`.
 *
 * ## Switching it off
 *
 * Driven by `PAYMENT_PROVIDER`. It refuses to load when `NODE_ENV` is
 * production, so a stray environment variable cannot put a sandbox gateway in
 * front of a real customer.
 */

export const isStripeSandboxEnabled = (): boolean =>
  process.env.PAYMENT_PROVIDER === 'stripe' && process.env.NODE_ENV !== 'production'

export const createStripeSandboxAdapter = (): PaymentAdapter => {
  const base = stripeAdapter({
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET || '',
  })

  return {
    ...base,
    label: 'Stripe (sandbox — development only)',

    /**
     * Prices through our own engine, then hands the real total to Stripe.
     *
     * The cart is re-priced from the database here, at the moment of payment:
     * the browser's quote is never carried into the charge (P6).
     */
    initiatePayment: async (args) => {
      const { data, req } = args
      const { cart, customerEmail, shippingAddress } = data

      const countryCode = String(shippingAddress?.country ?? '')

      /**
       * Re-read the cart in full.
       *
       * The plugin loads it with
       * `select: { id, currency, customerEmail, items, subtotal }`, so the
       * cart handed to an adapter has `shippingCityKey` and `discountCode`
       * stripped out — the engine would then refuse every Qatar address with
       * "Please choose a delivery city" and silently ignore every discount.
       */
      const storedCart = await req.payload.findByID({
        collection: 'carts',
        depth: 0,
        id: cart.id,
        overrideAccess: true,
        req,
      })

      const context = await loadPricingContext(req)
      const { discountError, priced } = await priceCart({
        cart: { ...storedCart, items: cart.items ?? storedCart.items },
        context,
        countryCode,
        customerEmail,
        req,
      })

      if (!priced.ok) {
        throw new Error(priced.refusal.message)
      }

      if (discountError) {
        req.payload.logger.warn(
          { cart: cart.id, discountError },
          'Discount code dropped at payment — it was no longer usable.',
        )
      }

      /**
       * The plugin derives the charge from `cart.subtotal`, so the priced
       * total is written back onto the cart before delegating. This is the
       * seam: everything below still believes it is charging a cart subtotal,
       * and that subtotal is now the engine's total.
       */
      const snapshot: PricingSnapshot = {
        discountCode: priced.order.discountCode,
        discountTotal: priced.order.discountTotal,
        freeShippingApplied: priced.order.freeShippingApplied,
        lines: priced.order.lines.map((line) => ({
          personalisation: line.personalisation,
          productId: line.productId,
          quantity: line.quantity,
          variantId: line.variantId,
        })),
        personalisationTotal: priced.order.personalisationTotal,
        shipping: priced.order.shipping,
        shippingLabel: priced.order.shippingLabel,
        shippingZone: priced.order.shippingZone,
        subtotal: priced.order.subtotal,
        total: priced.order.total,
      }

      await req.payload.update({
        collection: 'carts',
        data: { pricingSnapshot: snapshot, subtotal: priced.order.total },
        id: cart.id,
        overrideAccess: true,
        req,
      })

      /**
       * Strip personalisation before delegating.
       *
       * The plugin writes cart items into Stripe metadata with
       * `...customProperties`, so our `personalisation` array goes with them —
       * but the transactions collection's `items` field has no such field, so
       * it is dropped on the way into the database. `validateSettlement` then
       * compares the two and throws "Stripe cart items do not match the
       * transaction items", failing every confirmation.
       *
       * Nothing is lost: personalisation is read back from the database cart
       * in `confirmOrder`. This also sidesteps Stripe's 500-character limit on
       * a metadata value, which two embroidery placements can exceed.
       */
      const itemsForGateway = (cart.items ?? []).map((item) => {
        const { personalisation: _dropped, ...rest } = item as typeof item & {
          personalisation?: unknown
        }
        return rest
      })

      return base.initiatePayment({
        ...args,
        data: {
          ...data,
          cart: { ...cart, items: itemsForGateway, subtotal: priced.order.total },
        },
      })
    },

    /**
     * Wraps the plugin's confirmation so the order it creates carries the
     * things the plugin has no way to know about. The plugin still does the
     * work — creating the order, decrementing stock, settling the transaction
     * and refusing a transaction that an order already references. This only
     * enriches the data on its way in, and redeems the discount on its way out.
     */
    confirmOrder: async (args) => {
      const { req } = args
      const cartID = (args.data as { cartID?: number })?.cartID

      const cart = cartID
        ? await req.payload
            .findByID({ collection: 'carts', depth: 0, id: cartID, overrideAccess: true, req })
            .catch(() => null)
        : null

      let createdOrderId: null | number = null
      let chargedDiscount = 0

      const result = await base.confirmOrder({
        ...args,
        finalizeOrder: async (inner) => {
          const snapshot = cart?.pricingSnapshot
          chargedDiscount = orderTotalsFromSnapshot(snapshot).discountTotalQar as number

          const order = await args.finalizeOrder({
            ...inner,
            orderData: {
              ...inner.orderData,
              ...orderTotalsFromSnapshot(snapshot),
              items: itemsWithPersonalisation(inner.orderData.items, snapshot),
            },
          })

          createdOrderId = order.id as number
          return order
        },
      })

      /**
       * After the order exists, never before: a code consumed by a payment
       * that then failed would be gone for a customer who was never charged.
       */
      if (createdOrderId) {
        await redeemCartDiscount({
          amountQar: chargedDiscount || 0,
          cart,
          customerEmail: String((args.data as { customerEmail?: string })?.customerEmail ?? ''),
          orderId: createdOrderId,
          req,
        })
      }

      return result
    },
  }
}
