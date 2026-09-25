import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'

import { stripeAdapter } from '@payloadcms/plugin-ecommerce/payments/stripe'
import Stripe from 'stripe'

import {
  itemsWithPersonalisation,
  orderTotalsFromSnapshot,
  type PricingSnapshot,
  redeemCartDiscount,
} from './finaliseOrder'
import { itemsForGateway, readCheckoutDetails } from './checkoutSession'
import { loadPricingContext, priceCart } from './priceCart'
import { createStripeWebhookEndpoint } from './webhook'

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
 * ## The flow: a redirect, like SkipCash
 *
 * Payment is taken on **Stripe's hosted Checkout page**, not a card form on
 * ours. `initiatePayment` returns a `redirectURL`, the customer pays there and
 * comes back to `/checkout/return`, and the webhook confirms the order if they
 * never do — the same shape as SkipCash's `payUrl`. When SkipCash arrives the
 * checkout page, the return page and order creation stay; only this adapter
 * and the webhook's signature check are swapped. See `./checkoutSession.ts`.
 *
 * It still cannot exercise the HMAC signature with its fixed field order —
 * which §7.2 calls the most brittle part of the integration — nor SkipCash's
 * status codes, nor its webhook shape.
 *
 * ## The amount
 *
 * The plugin's stock Stripe adapter charges `cart.subtotal`, which omits
 * delivery, embroidery and discounts. The amount here comes from
 * `priceOrder()` instead. See `./priceCart.ts`.
 *
 * ## Switching it off
 *
 * Driven by `PAYMENT_PROVIDER`. It refuses to load when `NODE_ENV` is
 * production, so a stray environment variable cannot put a sandbox gateway in
 * front of a real customer.
 */

export const isStripeSandboxEnabled = (): boolean =>
  process.env.PAYMENT_PROVIDER === 'stripe' && process.env.NODE_ENV !== 'production'

/** How long the hosted page stays payable. Stripe's minimum is 30 minutes. */
const SESSION_LIFETIME_SECONDS = 60 * 60

export const createStripeSandboxAdapter = (): PaymentAdapter => {
  const base = stripeAdapter({
    /**
     * The transaction remembers the Checkout Session it was created for; the
     * PaymentIntent id is filled in once the customer has paid (it does not
     * exist before). See `settleCheckoutSession`.
     */
    groupOverrides: {
      fields: ({ defaultFields }) => [
        ...defaultFields,
        {
          name: 'checkoutSessionID',
          type: 'text',
          index: true,
          label: 'Stripe Checkout Session ID',
        },
      ],
    },
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET || '',
  })

  const secretKey = process.env.STRIPE_SECRET_KEY || ''
  const webhookSecret = process.env.STRIPE_WEBHOOKS_SIGNING_SECRET || ''
  const stripe = new Stripe(secretKey)

  const adapter: PaymentAdapter = {
    ...base,

    /**
     * Replace the plugin's webhook receiver with our own.
     *
     * The plugin's returns 200 to an unsigned request and logs nothing. Ours
     * fails closed, records every callback to `webhookLog`, and settles a paid
     * Checkout Session when the customer never came back — which is what makes
     * the gateway the source of truth (P4). See `./webhook.ts`.
     */
    endpoints: [
      ...(base.endpoints ?? []).filter((endpoint) => endpoint.path !== '/webhooks'),
      createStripeWebhookEndpoint({
        stripe,
        webhookSecret,
      }),
    ],

    label: 'Stripe (sandbox — development only)',

    /**
     * Records the checkout's choices on the cart, prices it through our own
     * engine, and opens a Stripe Checkout Session for exactly that total.
     * Returns the hosted page's `redirectURL`.
     *
     * The cart is re-priced from the database here, at the moment of payment:
     * the browser's quote is never carried into the charge (P6).
     */
    initiatePayment: async (args) => {
      const { data, req, transactionsSlug } = args
      const { cart, customerEmail } = data

      /**
       * The plugin passes the adapter only its own fields; ours — delivery
       * city, discount code, gift note, the full address — are read from the
       * request body the plugin has already parsed.
       */
      const details = readCheckoutDetails(req.data)
      const countryCode = details.address.country || String(data.shippingAddress?.country ?? '')

      /**
       * The pricing engine reads the city and the code from the cart, so they
       * are written there first. Both are re-validated below; nothing here is
       * trusted because the browser sent it.
       */
      await req.payload.update({
        collection: 'carts',
        data: { discountCode: details.discountCode, shippingCityKey: details.cityKey },
        id: cart.id,
        overrideAccess: true,
        req,
      })

      /**
       * Re-read the cart in full. The plugin loads it with
       * `select: { id, currency, customerEmail, items, subtotal }`, so the
       * cart handed to an adapter has `shippingCityKey` and `discountCode`
       * stripped out — the engine would refuse every Qatar address with
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

      const snapshot: PricingSnapshot = {
        delivery: { address: details.address, gift: details.gift, giftNote: details.giftNote },
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
        data: { pricingSnapshot: snapshot },
        id: cart.id,
        overrideAccess: true,
        req,
      })

      /** The same Stripe customer the plugin would use, found or made by email. */
      const customer =
        (await stripe.customers.list({ email: customerEmail, limit: 1 })).data[0] ??
        (await stripe.customers.create({ email: customerEmail }))

      const items = itemsForGateway(cart.items ?? [])
      /** "Al Shaheen Nights — Silk Pyjama Set, size M × 1". A variant's title repeats its product's, so only the rest is kept. */
      const pieces = priced.order.lines
        .map((line) => {
          const size = line.variantTitle
            ?.replace(line.productTitle, '')
            .replace(/^\s*[—–-]\s*/, '')
            .trim()
          return `${line.productTitle}${size ? `, size ${size}` : ''} × ${line.quantity}`
        })
        .join('; ')

      const origin = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

      /**
       * One line for the whole order, at the engine's total. Stripe's page
       * cannot show a discount without creating a coupon object per order, and
       * a single line guarantees the amount it charges is exactly the amount
       * we priced — the description carries what is in it.
       */
      const session = await stripe.checkout.sessions.create({
        cancel_url: `${origin}/checkout?payment=cancelled`,
        client_reference_id: String(cart.id),
        customer: customer.id,
        expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
        line_items: [
          {
            price_data: {
              currency: 'qar',
              product_data: {
                description: [
                  pieces,
                  priced.order.personalisationTotal ? 'hand embroidery' : '',
                  priced.order.shippingLabel || '',
                  priced.order.discountCode ? `code ${priced.order.discountCode}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
                  .slice(0, 500),
                name: 'Your plumpose order',
              },
              unit_amount: priced.order.total,
            },
            quantity: 1,
          },
        ],
        locale: 'en',
        metadata: { cartID: String(cart.id) },
        mode: 'payment',
        /**
         * The plugin's settlement check reads these off the PaymentIntent the
         * session creates: which cart, and the exact items the transaction
         * below records.
         */
        payment_intent_data: {
          description: `plumpose — cart ${cart.id}`,
          metadata: { cartID: String(cart.id), cartItemsSnapshot: JSON.stringify(items) },
        },
        payment_method_types: ['card'],
        submit_type: 'pay',
        success_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      })

      if (!session.url) throw new Error('Stripe did not return a payment page.')

      await req.payload.create({
        collection: transactionsSlug as 'transactions',
        data: {
          ...(req.user ? { customer: req.user.id } : { customerEmail }),
          amount: priced.order.total,
          billingAddress: details.address as never,
          cart: cart.id as number,
          currency: 'QAR',
          items: items as never,
          paymentMethod: 'stripe',
          status: 'pending',
          stripe: { checkoutSessionID: session.id, customerID: customer.id },
        },
        req,
      })

      return {
        checkoutSessionID: session.id,
        message: 'Payment page ready.',
        redirectURL: session.url,
      }
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

  return adapter
}
