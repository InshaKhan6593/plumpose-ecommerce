import type { Endpoint, PayloadRequest } from 'payload'

import type { SkipCashConfig } from './api'

import { PAID, statusName, webhookSignatureValid } from './protocol'
import { findTransactionByReference } from './records'
import { settleSkipcashPayment } from './settle'

/**
 * The payment webhook (P4) — `POST /api/payments/skipcash/webhooks`.
 *
 * The gateway is the source of truth for whether an order was paid, not the
 * browser. A customer who pays and closes the tab before coming back has
 * still paid; this is how their order comes to exist.
 *
 * SkipCash posts one callback per status change, signed in the
 * `Authorization` header (HMAC-SHA256 with the Webhook Key over PaymentId,
 * Amount, StatusId, TransactionId, Custom1, VisaId — see `./protocol.ts`).
 * It retries anything but a 200, immediately, an hour later and a day later,
 * with a 10-second timeout. So this:
 *
 *   · **fails closed** — no signature, or a bad one, is a 401
 *   · **logs every callback** to `webhookLog`, verified or not. A run of
 *     `signatureValid: false` is what a forgery attempt looks like
 *   · **is idempotent** on payment id + status, because SkipCash retries and
 *     sends the same event more than once
 *   · **re-reads the payment from SkipCash** before an order is made
 *     (`settleSkipcashPayment`) — the signed body says a payment changed, the
 *     API says what it now is
 *   · **never moves a paid payment backwards.** Callbacks can arrive out of
 *     order: a failed first attempt may land after the paid second one
 *   · answers 500 only when a paid payment could not yet become an order,
 *     which is the one case worth SkipCash trying again
 */

const reply = (body: Record<string, unknown>, status = 200): Response =>
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
  statusId?: number
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
        statusId: args.statusId,
      },
      overrideAccess: true,
      req: args.req,
    })
  } catch (error) {
    args.req.payload.logger.error({ err: error }, 'Could not write to webhookLog.')
  }
}

/** Has this exact callback already been applied? SkipCash retries. */
const alreadyApplied = async (req: PayloadRequest, eventId: string): Promise<boolean> => {
  const seen = await req.payload.count({
    collection: 'webhookLog',
    overrideAccess: true,
    req,
    where: { and: [{ eventId: { equals: eventId } }, { applied: { equals: true } }] },
  })
  return seen.totalDocs > 0
}

const str = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim()

/** The event name a SkipCash status is logged under: `skipcash.paid`, `skipcash.failed`. */
export const skipcashEvent = (statusId: unknown): string =>
  `skipcash.${statusName(statusId).replace(/\s+/g, '-')}`

export const createSkipcashWebhookEndpoint = (config: SkipCashConfig): Endpoint => ({
  handler: async (req: PayloadRequest): Promise<Response> => {
    const { payload } = req

    const raw = req.text ? await req.text() : ''
    let body: Record<string, unknown>
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('not an object')
      body = parsed as Record<string, unknown>
    } catch {
      await record({ payload: { body: raw.slice(0, 2000) }, req, signatureValid: false })
      return reply({ error: 'Bad payload.' }, 400)
    }

    const paymentId = str(body.PaymentId)
    const statusId = Number(body.StatusId)
    const event = skipcashEvent(statusId)
    const signature = req.headers.get('authorization')

    if (!webhookSignatureValid(config.webhookKey, body, signature)) {
      await record({ event, payload: body, paymentId, req, signatureValid: false, statusId })
      payload.logger.warn(
        { paymentId, reference: str(body.TransactionId) },
        'Rejected a SkipCash callback whose signature did not verify.',
      )
      return reply({ error: 'Invalid signature.' }, 401)
    }

    /** Whose checkout this was — the cart id, so the admin can match declines to it. */
    const transaction = await findTransactionByReference(payload, str(body.TransactionId), req)
    const cartID = transaction
      ? String(typeof transaction.cart === 'object' ? transaction.cart?.id : transaction.cart)
      : undefined

    const eventId = `${paymentId}:${Number.isFinite(statusId) ? statusId : 'unknown'}`
    const base = {
      event,
      eventId,
      orderRef: cartID,
      payload: body,
      paymentId,
      req,
      signatureValid: true,
      statusId,
    }

    if (await alreadyApplied(req, eventId)) {
      await record({ ...base, applied: false })
      return reply({ received: true, reason: 'duplicate' })
    }

    /* ---------------- paid ---------------- */

    if (statusId === PAID) {
      const result = await settleSkipcashPayment({ config, payload, paymentId })
      await record({ ...base, applied: result.status === 'confirmed' })

      if (result.status === 'pending') {
        return reply({ error: 'Could not confirm the order yet.' }, 500)
      }
      if (result.status === 'error') {
        payload.logger.error(
          { paymentId, reason: result.reason, reference: str(body.TransactionId) },
          'A verified SkipCash "paid" callback could not be matched to an order.',
        )
      }
      return reply({ received: true, reason: result.status })
    }

    /* ---------------- cancelled: the payment page closed unpaid ---------------- */

    /**
     * SkipCash cancels an unfinished payment after an hour. When it is the
     * one we registered, the checkout is kept, marked expired, so an
     * abandoned bag stays visible (P11). A paid transaction is never touched,
     * and neither is one whose cancellation is for a copy SkipCash made of a
     * later attempt.
     */
    if (statusId === 3) {
      let applied = false
      if (transaction?.status === 'pending' && transaction.skipcash?.paymentId === paymentId) {
        await payload.update({
          collection: 'transactions',
          data: { status: 'expired' },
          id: transaction.id,
          overrideAccess: true,
          req,
        })
        applied = true
      }
      await record({ ...base, applied })
      return reply({ received: true })
    }

    /**
     * Failed or rejected: logged, and the transaction left as it is. SkipCash
     * keeps the payment link open for another card and reports this attempt
     * under a copy with a new id — marking the transaction failed here would
     * turn a successful second attempt into a paid customer with no order.
     * The log keeps the decline visible to her (P11).
     */
    await record({ ...base, applied: false })
    return reply({ received: true })
  },
  method: 'post',
  path: '/webhooks',
})
