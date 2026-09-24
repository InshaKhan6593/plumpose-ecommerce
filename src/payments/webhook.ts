import type { Endpoint, PayloadRequest } from 'payload'

import type Stripe from 'stripe'

import { expireCheckoutSession, settleCheckoutSession } from './checkoutSession'

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
 *   · keeps declined attempts in the log and marks abandoned checkouts
 *     expired, as well as confirming paid ones (P11)
 *   · settles hosted Checkout Sessions through `settleCheckoutSession`, the
 *     same function the customer's return page calls
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

export const createStripeWebhookEndpoint = (args: {
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

    const object = event.data.object as { id?: unknown; metadata?: Record<string, string> }
    const paymentId = typeof object?.id === 'string' ? object.id : undefined
    const cartID = object?.metadata?.cartID

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

    /* ---------------- the hosted Checkout page ---------------- */

    /**
     * Paid on Stripe's page. The customer is normally on their way back to
     * `/checkout/return`, which settles the same session; whichever arrives
     * first creates the order and the other finds it done.
     */
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const result = await settleCheckoutSession({ payload, sessionId: session.id, stripe: args.stripe })

      await record({ ...base, applied: result.status === 'confirmed' })

      /**
       * Non-2xx makes Stripe retry — wanted only when a paid order is still
       * missing. A session with no transaction of ours (another app on the same
       * Stripe account, a test from the dashboard) is logged and let go.
       */
      if (result.status === 'pending') {
        return ok({ error: 'Could not confirm the order yet.' }, 500)
      }
      return ok({ received: true, reason: result.status })
    }

    /**
     * The hosted page timed out unpaid. The transaction is kept, marked
     * expired, so abandoned checkouts stay visible (P11); the bag is untouched.
     */
    if (event.type === 'checkout.session.expired') {
      const applied = paymentId ? await expireCheckoutSession(req, paymentId) : false
      await record({ ...base, applied })
      return ok({ received: true })
    }

    /**
     * A declined card is logged, but the transaction is **not** marked failed.
     * On the hosted page the customer can simply try another card within the
     * same session, and the plugin only settles a transaction that is still
     * pending — marking it failed here would turn their successful second
     * attempt into a paid customer with no order. The log keeps the attempt
     * visible (P11); an abandoned session is marked expired above.
     */
    if (event.type === 'payment_intent.payment_failed') {
      await record({ ...base, applied: false })
      return ok({ received: true })
    }

    if (event.type !== 'payment_intent.succeeded') {
      await record({ ...base, applied: false })
      return ok({ received: true, reason: 'ignored' })
    }

    /* ---------------- a payment succeeded ---------------- */

    /**
     * Every payment this store takes is a Checkout Session, so a paid
     * PaymentIntent is settled through its session — which links it to the
     * transaction first. One without a session was not made by this checkout
     * (another app on the same Stripe account, a dashboard test): logged and
     * let go, never retried.
     */
    const sessions = paymentId
      ? await args.stripe.checkout.sessions.list({ limit: 1, payment_intent: paymentId }).catch(() => null)
      : null
    const session = sessions?.data[0]

    if (!session) {
      await record({ ...base, applied: false })
      return ok({ received: true, reason: 'not a checkout payment' })
    }

    const result = await settleCheckoutSession({ payload, sessionId: session.id, stripe: args.stripe })
    await record({ ...base, applied: result.status === 'confirmed', orderRef: session.metadata?.cartID })

    if (result.status === 'pending') {
      return ok({ error: 'Could not confirm the order yet.' }, 500)
    }
    return ok({ received: true, reason: result.status })
  },
  method: 'post',
  path: '/webhooks',
})
