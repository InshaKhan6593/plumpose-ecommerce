import type { Endpoint, PayloadRequest } from 'payload'

import type { Transaction } from '@/payload-types'
import type Stripe from 'stripe'

/**
 * The payment webhook (P4).
 *
 * The gateway is the source of truth for whether an order was paid — not the
 * browser. A customer who pays and then closes the tab before the confirmation
 * call lands has still paid, and without this they would have an order that
 * never exists. The webhook closes that gap.
 *
 * ## Why this replaces the plugin's own receiver
 *
 * The plugin's endpoint wraps verification in `if (stripeSignature)`, so an
 * **unsigned** request skips the whole check and falls through to
 * `200 {received:true}`. It is not an authentication bypass — no handler is
 * reached and nothing is marked paid — but it is a fail-open *shape*, and a
 * prober gets "received" for a forged payload. It also logs nothing.
 *
 * This one:
 *
 *   · **fails closed** — no signature, or a bad one, is a 400
 *   · **logs every callback**, verified or not, to `webhookLog`. A run of
 *     `signatureValid: false` is what a forgery attempt looks like, and
 *     discarding those hides it
 *   · **is idempotent** on the gateway's own event id, because gateways retry
 *   · records failed payments as well as successful ones (P11)
 *
 * ## A note for the SkipCash adapter
 *
 * Keep this shape. The legacy `skipcash-webhook.mjs` already verifies
 * correctly — HMAC-SHA256 over a fixed field order with `timingSafeEqual` —
 * and §7.2 calls that the most brittle part of the integration. What changes is
 * only how the signature is computed; the log-everything, fail-closed,
 * idempotent structure is the same.
 */

/** Stripe advises returning 2xx quickly; 4xx/5xx makes it retry. */
const ok = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })

type LogArgs = {
  applied?: boolean
  event?: string
  eventId?: string
  orderRef?: string
  payload?: unknown
  paymentId?: string
  req: PayloadRequest
  signatureValid: boolean
}

/**
 * Records a callback. Never throws: a logging failure must not turn a real
 * payment into a retry storm, so it degrades to an error line instead.
 */
const record = async (args: LogArgs): Promise<void> => {
  try {
    await args.req.payload.create({
      collection: 'webhookLog',
      data: {
        applied: args.applied ?? false,
        event: args.event,
        eventId: args.eventId,
        orderRef: args.orderRef,
        payload: args.payload as Record<string, unknown>,
        paymentId: args.paymentId,
        signatureValid: args.signatureValid,
      },
      overrideAccess: true,
      req: args.req,
    })
  } catch (error) {
    args.req.payload.logger.error({ err: error }, 'Could not write to webhookLog.')
  }
}

/** Has this exact callback already been applied? Gateways retry. */
const alreadyApplied = async (req: PayloadRequest, eventId: string): Promise<boolean> => {
  const seen = await req.payload.count({
    collection: 'webhookLog',
    overrideAccess: true,
    req,
    where: { and: [{ eventId: { equals: eventId } }, { applied: { equals: true } }] },
  })
  return seen.totalDocs > 0
}

/**
 * Who the order belongs to.
 *
 * The gateway is not a reliable source for this — we do not set
 * `receipt_email` on the intent — so it comes from the transaction: its own
 * email for a guest, or the signed-in customer it belongs to. Carts do not
 * carry one. Without an email the confirm endpoint refuses with
 * "A customer email is required to make a purchase."
 */
const resolveCustomerEmail = async (
  req: PayloadRequest,
  transaction: null | Transaction,
): Promise<string> => {
  if (transaction?.customerEmail) return transaction.customerEmail

  const customerId =
    typeof transaction?.customer === 'number' ? transaction.customer : transaction?.customer?.id

  if (customerId) {
    const user = await req.payload
      .findByID({ collection: 'users', depth: 0, id: customerId, overrideAccess: true, req })
      .catch(() => null)
    if (user?.email) return user.email
  }

  return ''
}

const findTransaction = async (req: PayloadRequest, paymentIntentID: string) => {
  const found = await req.payload.find({
    collection: 'transactions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: { 'stripe.paymentIntentID': { equals: paymentIntentID } },
  })
  return found.docs[0] ?? null
}

export type ConfirmOrderRequest = {
  cartID: number
  customerEmail: string
  paymentIntentID: string
  /** The cart's own secret — how the confirm endpoint authorises a caller. */
  secret?: string
}

export const createStripeWebhookEndpoint = (args: {
  confirmOrder: (body: ConfirmOrderRequest) => Promise<Response>
  secretKey: string
  stripe: Stripe
  webhookSecret: string
}): Endpoint => ({
  handler: async (req: PayloadRequest): Promise<Response> => {
    const { payload } = req

    const body = req.text ? await req.text() : ''
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      await record({ payload: { body: body.slice(0, 2000) }, req, signatureValid: false })
      return ok({ error: 'Missing signature.' }, 400)
    }

    let event: Stripe.Event
    try {
      event = args.stripe.webhooks.constructEvent(body, signature, args.webhookSecret)
    } catch (error) {
      await record({
        payload: { body: body.slice(0, 2000), error: String(error) },
        req,
        signatureValid: false,
      })
      payload.logger.warn('Rejected a payment callback whose signature did not verify.')
      return ok({ error: 'Invalid signature.' }, 400)
    }

    const intent = event.data.object as Stripe.PaymentIntent
    const paymentId = typeof intent?.id === 'string' ? intent.id : undefined
    const cartID = intent?.metadata?.cartID

    const base = {
      event: event.type,
      eventId: event.id,
      orderRef: cartID,
      payload: event as unknown,
      paymentId,
      req,
      signatureValid: true,
    }

    if (await alreadyApplied(req, event.id)) {
      await record({ ...base, applied: false })
      return ok({ received: true, reason: 'duplicate' })
    }

    /**
     * A payment that failed is still worth keeping (P11): an abandoned or
     * declined attempt is the thing the client asks about when a customer says
     * "it didn't work".
     */
    if (event.type === 'payment_intent.payment_failed') {
      const transaction = paymentId ? await findTransaction(req, paymentId) : null

      if (transaction) {
        await payload.update({
          collection: 'transactions',
          data: { status: 'failed' },
          id: transaction.id,
          overrideAccess: true,
          req,
        })
      }

      await record({ ...base, applied: Boolean(transaction) })
      return ok({ received: true })
    }

    if (event.type !== 'payment_intent.succeeded') {
      await record({ ...base, applied: false })
      return ok({ received: true, reason: 'ignored' })
    }

    /* ---------------- a payment succeeded ---------------- */

    if (!paymentId || !cartID) {
      await record({ ...base, applied: false })
      payload.logger.error(
        { event: event.id },
        'Paid callback carried no payment intent or cart id — cannot create an order from it.',
      )
      return ok({ received: true, reason: 'unusable' })
    }

    /**
     * If an order already references this transaction the browser got there
     * first, which is the normal case. Nothing to do.
     */
    const transaction = await findTransaction(req, paymentId)
    if (transaction) {
      const existing = await payload.count({
        collection: 'orders',
        overrideAccess: true,
        req,
        where: { transactions: { equals: transaction.id } },
      })

      if (existing.totalDocs > 0) {
        await record({ ...base, applied: false })
        return ok({ received: true, reason: 'already confirmed' })
      }
    }

    /**
     * Nobody confirmed it, so we do — through the same path the browser would
     * have used, so the order is built identically: the money breakdown, the
     * embroidery instructions, the stock decrement and the discount ledger all
     * come from one place.
     */
    try {
      const customerEmail = await resolveCustomerEmail(req, transaction)

      /**
       * The webhook arrives with nobody signed in, so it authorises itself the
       * way a guest browser does — with the cart's own secret. Without it the
       * confirm endpoint answers 403, since an anonymous caller may not touch
       * somebody else's cart.
       */
      const cart = await req.payload
        .findByID({ collection: 'carts', depth: 0, id: Number(cartID), overrideAccess: true, req })
        .catch(() => null)

      if (!customerEmail) {
        await record({ ...base, applied: false })
        payload.logger.error(
          { cartID, event: event.id },
          'Paid callback has no customer email on its transaction — cannot create an order.',
        )
        return ok({ error: 'No customer email for this payment.' }, 500)
      }

      const response = await args.confirmOrder({
        cartID: Number(cartID),
        customerEmail,
        paymentIntentID: paymentId,
        secret: cart?.secret ?? undefined,
      })

      const applied = response.status >= 200 && response.status < 300
      await record({ ...base, applied })

      if (!applied) {
        /** Non-2xx makes Stripe retry, which is what we want here. */
        const detail = await response.text().catch(() => '')
        payload.logger.error(
          { cartID, detail: detail.slice(0, 500), event: event.id, status: response.status },
          'Webhook could not create an order for a paid payment.',
        )
        return ok({ error: 'Could not confirm the order.' }, 500)
      }

      payload.logger.info(
        { cartID, event: event.id },
        'Created an order from the webhook — the browser never confirmed it.',
      )
      return ok({ received: true, reason: 'confirmed by webhook' })
    } catch (error) {
      await record({ ...base, applied: false })
      payload.logger.error({ cartID, err: error }, 'Webhook order confirmation threw.')
      return ok({ error: 'Could not confirm the order.' }, 500)
    }
  },
  method: 'post',
  path: '/webhooks',
})
