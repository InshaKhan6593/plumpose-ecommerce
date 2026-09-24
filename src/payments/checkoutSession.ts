import type { Payload, PayloadRequest } from 'payload'
import type Stripe from 'stripe'

import type { Transaction } from '@/payload-types'

/**
 * Stripe's hosted Checkout page — the redirect flow.
 *
 * The customer leaves our site to pay and comes back. That is the shape
 * SkipCash has (it returns a `payUrl`), which is the whole reason Stripe is
 * wired this way rather than with a card form on our own page: when SkipCash
 * arrives, only the part that creates the payment and the webhook's signature
 * check change. The checkout page, the return page and order creation do not.
 *
 * ## How a Checkout Session meets the plugin
 *
 * The plugin confirms an order from a **PaymentIntent** and checks it hard
 * (`validateSettlement`): same PaymentIntent as the transaction, same cart,
 * same Stripe customer, same amount and currency, identical item snapshot, and
 * status `succeeded`. A Checkout Session satisfies every one of those — the
 * session is created with the plugin's metadata on its PaymentIntent — except
 * that the PaymentIntent does not exist until the customer pays. So the
 * transaction is created with the **session** id, and `settleCheckoutSession`
 * copies the PaymentIntent id across once the session is paid, then confirms
 * through the plugin's own endpoint. Its atomic claim on the transaction means
 * the return page and the webhook can both try, and exactly one order exists.
 */

/* -------------------------------------------------------------------------- */
/*                      What the checkout form sends                           */
/* -------------------------------------------------------------------------- */

export type CheckoutAddress = {
  addressLine1: string
  addressLine2: string
  city: string
  /** ISO-2. */
  country: string
  firstName: string
  lastName: string
  phone: string
  postalCode: string
}

export type CheckoutDetails = {
  address: CheckoutAddress
  /** Qatar only — the key into the city rate table. */
  cityKey: null | string
  discountCode: null | string
  gift: boolean
  giftNote: string
}

/** Longest gift note the card takes. Mirrored by the form's `maxLength`. */
export const GIFT_NOTE_MAX = 300

const text = (value: unknown, max: number): string =>
  String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)

/**
 * The extra fields the checkout form sends alongside the plugin's own, cleaned.
 * Everything here is re-checked by the pricing engine before any money moves;
 * this only bounds and tidies what is stored.
 */
export const readCheckoutDetails = (data: unknown): CheckoutDetails => {
  const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const address = (body.shippingAddress && typeof body.shippingAddress === 'object'
    ? body.shippingAddress
    : {}) as Record<string, unknown>

  const gift = body.gift === true

  return {
    address: {
      addressLine1: text(address.addressLine1, 120),
      addressLine2: text(address.addressLine2, 120),
      city: text(address.city, 80),
      country: text(address.country, 2).toUpperCase(),
      firstName: text(address.firstName, 60),
      lastName: text(address.lastName, 60),
      phone: text(address.phone, 30),
      postalCode: text(address.postalCode, 20),
    },
    cityKey: text(body.shippingCityKey, 60) || null,
    discountCode: text(body.discountCode, 40).toUpperCase() || null,
    gift,
    giftNote: gift ? text(body.giftNote, GIFT_NOTE_MAX) : '',
  }
}

/**
 * Cart items as the gateway and the transaction both record them — exactly
 * the plugin's own flattening, minus personalisation.
 *
 * Personalisation is left out because the transactions collection has no such
 * field and would drop it, and `validateSettlement` compares this snapshot to
 * the stored transaction items key by key ("Stripe cart items do not match the
 * transaction items"). It is read back from the cart's pricing snapshot at
 * confirmation instead — also sidestepping Stripe's 500-character metadata cap.
 */
export const itemsForGateway = (items: unknown[] = []): Record<string, unknown>[] =>
  items.map((raw) => {
    const item = raw as Record<string, unknown>
    const { personalisation: _dropped, product, variant, ...rest } = item
    const idOf = (value: unknown) =>
      value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value
    const variantID = variant ? idOf(variant) : undefined
    return { ...rest, product: idOf(product), quantity: item.quantity, ...(variantID ? { variant: variantID } : {}) }
  })

/* -------------------------------------------------------------------------- */
/*                         Settling a paid session                             */
/* -------------------------------------------------------------------------- */

export type SettleResult =
  | { accessToken: string; orderId: number; status: 'confirmed' }
  /** Paid is not yet reported, or confirmation is still in flight. Try again shortly. */
  | { status: 'pending' }
  /** The customer left without paying, or the session timed out. The bag is untouched. */
  | { status: 'unpaid' }
  | { reason: string; status: 'error' }

const findTransactionForSession = async (payload: Payload, sessionId: string): Promise<null | Transaction> => {
  const found = await payload.find({
    collection: 'transactions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { 'stripe.checkoutSessionID': { equals: sessionId } },
  })
  return found.docs[0] ?? null
}

const orderForTransaction = async (payload: Payload, transactionId: number) => {
  const found = await payload.find({
    collection: 'orders',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    select: { accessToken: true },
    where: { transactions: { equals: transactionId } },
  })
  const order = found.docs[0]
  return order ? { accessToken: order.accessToken ?? '', orderId: order.id } : null
}

/**
 * Turns a paid Checkout Session into an order. Safe to call any number of
 * times, from anywhere: the return page, the webhook, a retry.
 *
 * `cookie` forwards the shopper's session when called from the return page, so
 * a signed-in customer's order settles as theirs. The webhook has no cookie and
 * settles guest orders only — the plugin rightly refuses to settle a signed-in
 * customer's transaction for an anonymous caller (see docs/BUILD-LOG.md §13).
 */
export const settleCheckoutSession = async (args: {
  cookie?: null | string
  payload: Payload
  sessionId: string
  stripe: Stripe
}): Promise<SettleResult> => {
  const { payload, sessionId, stripe } = args

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return { reason: 'That payment could not be found.', status: 'error' }
  }

  if (session.status === 'expired') return { status: 'unpaid' }
  if (session.payment_status !== 'paid') {
    return session.status === 'complete' ? { status: 'pending' } : { status: 'unpaid' }
  }

  const transaction = await findTransactionForSession(payload, session.id)
  if (!transaction) return { reason: 'No record of this payment on our side.', status: 'error' }

  const existing = await orderForTransaction(payload, transaction.id)
  if (existing) return { ...existing, status: 'confirmed' }

  const paymentIntentID =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentID) return { status: 'pending' }

  /**
   * Link the PaymentIntent to the transaction — deliberately **without** `req`.
   * Called from inside an endpoint, a write that threads `req` stays in that
   * endpoint's open database transaction, and the confirm call below goes out
   * as a separate HTTP request on its own connection: it would not see the
   * link and would fail with "Expected exactly one transaction". This write
   * must be committed before that call is made.
   */
  if (transaction.stripe?.paymentIntentID !== paymentIntentID) {
    await payload.update({
      collection: 'transactions',
      data: { stripe: { ...transaction.stripe, paymentIntentID } },
      id: transaction.id,
      overrideAccess: true,
    })
  }

  const cartID = typeof transaction.cart === 'number' ? transaction.cart : transaction.cart?.id
  const cart = cartID
    ? await payload.findByID({ collection: 'carts', depth: 0, id: cartID, overrideAccess: true }).catch(() => null)
    : null

  const origin = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const response = await fetch(`${origin}/api/payments/stripe/confirm-order`, {
    body: JSON.stringify({
      cartID,
      customerEmail: transaction.customerEmail ?? undefined,
      paymentIntentID,
      /** A guest is authorised by the cart's own secret, the way the browser would be. */
      secret: cart?.secret ?? undefined,
    }),
    headers: { 'Content-Type': 'application/json', ...(args.cookie ? { cookie: args.cookie } : {}) },
    method: 'POST',
  }).catch(() => null)

  if (response?.ok) {
    const body = (await response.json().catch(() => ({}))) as { accessToken?: string; orderID?: number }
    if (body.orderID) return { accessToken: body.accessToken ?? '', orderId: Number(body.orderID), status: 'confirmed' }
  }

  /** The other caller may have won the race while we were confirming. */
  const settled = await orderForTransaction(payload, transaction.id)
  if (settled) return { ...settled, status: 'confirmed' }

  const detail = response ? await response.text().catch(() => '') : 'no response'
  payload.logger.error(
    { detail: detail.slice(0, 300), sessionId, status: response?.status, transaction: transaction.id },
    'A paid Checkout Session could not be confirmed into an order.',
  )
  return { status: 'pending' }
}

/** Marks the transaction behind an abandoned session as expired (P11). */
export const expireCheckoutSession = async (req: PayloadRequest, sessionId: string): Promise<boolean> => {
  const transaction = await findTransactionForSession(req.payload, sessionId)
  if (!transaction || transaction.status !== 'pending') return false
  await req.payload.update({
    collection: 'transactions',
    data: { status: 'expired' },
    id: transaction.id,
    overrideAccess: true,
    req,
  })
  return true
}
