import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'
import type { GroupField } from 'payload'

import { itemsForGateway, readCheckoutDetails } from '../checkout'
import {
  itemsWithPersonalisation,
  orderTotalsFromSnapshot,
  type PricingSnapshot,
  redeemCartDiscount,
} from '../finaliseOrder'
import { loadPricingContext, priceCart } from '../priceCart'
import {
  createPayment,
  getPayment,
  type SkipCashConfig,
  SkipCashError,
  skipcashConfig,
} from './api'
import {
  isPaymentId,
  minorFromSkipcash,
  newReference,
  PAID,
  skipcashAddress,
  skipcashAmount,
  skipcashName,
  skipcashPhone,
  statusName,
} from './protocol'
import { findTransactionByReference, SKIPCASH } from './records'
import { createSkipcashWebhookEndpoint } from './webhook'

/**
 * SkipCash — the store's payment gateway (REQUIREMENTS §7).
 *
 * ## The flow
 *
 * 1. **Pay** on `/checkout` → `initiatePayment` re-prices the bag through
 *    `priceOrder()`, registers a payment with SkipCash for exactly that total,
 *    records a pending transaction, and returns SkipCash's `payUrl`.
 * 2. The customer pays on SkipCash's page, which sends them back to
 *    `/checkout/return?id=…`.
 * 3. The return page and the webhook both call `settleSkipcashPayment()`
 *    (`./settle.ts`), which runs `confirmOrder` below through the plugin.
 *    Whichever arrives first makes the order; the other finds it done.
 *
 * ## The amount
 *
 * Never `cart.subtotal`, which the plugin's own adapters charge and which
 * omits delivery, embroidery and discounts (QAR 1,399 for a bag that costs
 * QAR 1,579). Always `priceOrder()`, via `priceCart()`.
 *
 * ## What is trusted
 *
 * Nothing the browser says about a payment. `confirmOrder` asks SkipCash
 * directly (`GET /api/v1/payments/{id}`, authorised with the Client ID) and
 * checks that the payment is paid, is ours (its `TransactionId` is the
 * reference we generated for this transaction), and is for exactly the amount
 * and currency the transaction recorded.
 */

const groupField: GroupField = {
  name: SKIPCASH,
  type: 'group',
  admin: { condition: (data) => data?.paymentMethod === SKIPCASH },
  fields: [
    {
      name: 'reference',
      type: 'text',
      admin: {
        description: 'Our reference for this payment — the Transaction ID in the SkipCash portal.',
      },
      index: true,
      label: 'Reference',
    },
    {
      name: 'paymentId',
      type: 'text',
      admin: { description: "SkipCash's own id for this payment." },
      index: true,
      label: 'SkipCash payment ID',
    },
    {
      name: 'visaId',
      type: 'text',
      admin: { description: 'The card network reference, for reconciliation. Set once paid.' },
      label: 'Card transaction ID',
    },
    { name: 'cardType', type: 'text', label: 'Paid with' },
    { name: 'cardNumber', type: 'text', label: 'Card' },
  ],
  label: 'SkipCash',
}

/** Where SkipCash sends the customer, and where it posts the webhook. */
const siteOrigin = (): string =>
  (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')

/**
 * The webhook address, sent with each payment only when SkipCash can reach it.
 * A localhost address would only fail on SkipCash's side; leaving it out lets
 * the one set in the Merchant Portal apply instead.
 */
const webhookUrl = (origin: string): string | undefined =>
  /^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1/.test(origin)
    ? `${origin}/api/payments/${SKIPCASH}/webhooks`
    : undefined

const idOf = (value: unknown): string | undefined => {
  const id = value && typeof value === 'object' ? (value as { id?: unknown }).id : value
  return typeof id === 'number' || (typeof id === 'string' && id) ? String(id) : undefined
}

const lower = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const createSkipcashAdapter = (
  config: SkipCashConfig = skipcashConfig(),
): PaymentAdapter => ({
  name: SKIPCASH,
  endpoints: [createSkipcashWebhookEndpoint(config)],
  group: groupField,
  label: config.isSandbox ? 'SkipCash (sandbox)' : 'SkipCash',

  /**
   * Records the checkout's choices on the cart, prices it through our own
   * engine, and registers a SkipCash payment for exactly that total.
   * Returns SkipCash's payment page as `redirectURL`.
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
     * `select: { id, currency, customerEmail, items, subtotal }`, so the cart
     * handed to an adapter has `shippingCityKey` and `discountCode` stripped
     * out — the engine would refuse every Qatar address with "Please choose a
     * delivery city" and silently ignore every discount.
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

    if (!priced.ok) throw new Error(priced.refusal.message)

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

    /** "Al Shaheen Nights, size M × 1". A variant's title repeats its product's, so only the rest is kept. */
    const pieces = priced.order.lines
      .map((line) => {
        const size = line.variantTitle
          ?.replace(line.productTitle, '')
          .replace(/^\s*[—–-]\s*/, '')
          .trim()
        return `${line.productTitle}${size ? `, size ${size}` : ''} × ${line.quantity}`
      })
      .join('; ')

    const origin = siteOrigin()
    const reference = newReference()
    const address = details.address

    let payment: Awaited<ReturnType<typeof createPayment>>
    try {
      payment = await createPayment(config, {
        Amount: skipcashAmount(priced.order.total),
        ...skipcashAddress({
          addressLine1: [address.addressLine1, address.addressLine2].filter(Boolean).join(' '),
          city: address.city,
          country: countryCode,
          postalCode: address.postalCode,
        }),
        Description: [
          pieces,
          priced.order.personalisationTotal ? 'hand embroidery' : '',
          priced.order.shippingLabel || '',
          priced.order.discountCode ? `code ${priced.order.discountCode}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 300),
        Email: customerEmail,
        FirstName: skipcashName(address.firstName, 'Customer'),
        LastName: skipcashName(address.lastName, 'Customer'),
        Phone: skipcashPhone(address.phone, countryCode),
        ReturnUrl: `${origin}/checkout/return`,
        Subject: 'Your plumpose order',
        TransactionId: reference,
        WebhookUrl: webhookUrl(origin),
      })
    } catch (error) {
      req.payload.logger.error(
        {
          cart: cart.id,
          detail: error instanceof SkipCashError ? error.detail : undefined,
          err: error,
          reference,
          status: error instanceof SkipCashError ? error.status : undefined,
        },
        'SkipCash refused to create a payment.',
      )
      throw new Error('The payment page could not be opened.')
    }

    await req.payload.create({
      collection: transactionsSlug as 'transactions',
      data: {
        ...(req.user ? { customer: req.user.id } : { customerEmail }),
        amount: priced.order.total,
        billingAddress: details.address as never,
        cart: cart.id as number,
        currency: 'QAR',
        items: itemsForGateway(cart.items ?? []) as never,
        paymentMethod: SKIPCASH,
        skipcash: { paymentId: payment.id, reference },
        status: 'pending',
      },
      req,
    })

    return {
      message: 'Payment page ready.',
      paymentId: payment.id,
      redirectURL: payment.payUrl,
    }
  },

  /**
   * Turns a paid SkipCash payment into an order. Called through the plugin's
   * `/api/payments/skipcash/confirm-order`, which owns the atomic claim on
   * the transaction, the stock decrement and the order itself; this checks
   * the payment with SkipCash and adds what only plumpose knows — the money
   * breakdown, the embroidery, the address and gift note — then redeems the
   * discount once the order exists.
   */
  confirmOrder: async ({ data, finalizeOrder, req }) => {
    const paymentId = (data as { paymentId?: unknown }).paymentId
    if (!isPaymentId(paymentId)) throw new Error('A SkipCash payment id is required.')

    const payment = await getPayment(config, paymentId)
    if (!payment) throw new Error('SkipCash does not know that payment.')

    const transaction = await findTransactionByReference(
      req.payload,
      String(payment.transactionId ?? ''),
      req,
    )
    if (!transaction) throw new Error('No transaction of ours matches that payment.')

    /* ---------- is it really paid, and is it this payment? ---------- */

    if (Number(payment.statusId) !== PAID) {
      throw new Error(`Payment not completed (${statusName(payment.statusId)}).`)
    }
    if (minorFromSkipcash(payment.amount) !== transaction.amount) {
      throw new Error('SkipCash amount does not match the transaction amount.')
    }
    if ((payment.currency ?? 'QAR').toUpperCase() !== (transaction.currency ?? 'QAR')) {
      throw new Error('SkipCash currency does not match the transaction currency.')
    }

    /* ---------- is it this customer's, for this cart? ---------- */

    const cartID = idOf((data as { cartID?: unknown }).cartID)
    if (!cartID || cartID !== idOf(transaction.cart)) {
      throw new Error('Cart does not match the transaction cart.')
    }

    const transactionCustomer = idOf(transaction.customer)
    if (req.user) {
      if (transactionCustomer !== idOf(req.user.id)) {
        throw new Error('Signed-in customer does not match the transaction customer.')
      }
    } else {
      if (transactionCustomer) throw new Error('Guest transaction belongs to a signed-in customer.')
      const email = lower((data as { customerEmail?: unknown }).customerEmail)
      if (!email || email !== lower(transaction.customerEmail)) {
        throw new Error('Guest email does not match the transaction email.')
      }
    }

    const transactionID = transaction.id

    const cart = await req.payload
      .findByID({ collection: 'carts', depth: 0, id: Number(cartID), overrideAccess: true, req })
      .catch(() => null)
    const snapshot = cart?.pricingSnapshot
    const totals = orderTotalsFromSnapshot(snapshot)

    const items = itemsForGateway((transaction.items ?? []) as unknown[])

    const order = await finalizeOrder({
      orderData: {
        amount: transaction.amount,
        currency: transaction.currency,
        ...(req.user
          ? { customer: req.user.id }
          : { customerEmail: lower(transaction.customerEmail) }),
        status: 'processing',
        ...totals,
        items: itemsWithPersonalisation(items, snapshot),
      },
      transactionID,
    })

    /**
     * What the card network says, for reconciliation against SkipCash's
     * statement. If a failed attempt came first, SkipCash reports the paid
     * one under a new id; the paid one is the one worth keeping.
     */
    await req.payload.update({
      collection: 'transactions',
      data: {
        skipcash: {
          ...transaction.skipcash,
          cardNumber: payment.cardNumber || undefined,
          cardType: payment.cardType || undefined,
          paymentId: payment.id,
          visaId: payment.visaId || undefined,
        },
      },
      id: transactionID,
      overrideAccess: true,
      req,
    })

    /**
     * After the order exists, never before: a code consumed by a payment
     * that then failed would be gone for a customer who was never charged.
     */
    await redeemCartDiscount({
      amountQar: (totals.discountTotalQar as number) || 0,
      cart,
      customerEmail: lower((data as { customerEmail?: unknown }).customerEmail),
      orderId: order.id as number,
      req,
    })

    return {
      message: 'Order confirmed.',
      orderID: order.id as number,
      transactionID,
      ...(typeof order.accessToken === 'string' ? { accessToken: order.accessToken } : {}),
    }
  },
})
