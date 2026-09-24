import type { Payload } from 'payload'

// `.js`: the e2e suite loads the Payload config as strict ESM, where `next/server` alone does not resolve.
import { after } from 'next/server.js'

import type { Order } from '@/payload-types'

import { isUndeliverable, siteUrl } from './config'
import {
  customerConfirmation,
  customerEmailOf,
  type EmailContent,
  type OrderView,
  ownerNotification,
  shippedNotification,
  toOrderView,
} from './orderEmails'

/**
 * Sending an order email, exactly once.
 *
 * ## Why it re-reads the order instead of taking the document
 *
 * Orders are created inside the plugin's `/confirm-order` transaction, which
 * commits only after every hook has run. An email sent from inside that
 * transaction could announce an order that is then rolled back. So the send
 * is scheduled with `after()` — once the response has gone, and therefore
 * after the commit — and it reads the order **without `req`**, on a fresh
 * connection that can only see committed rows. No order, no email.
 *
 * ## Once, and on the record
 *
 * Each kind stamps its own field on the order (`confirmationEmailSentAt`, …),
 * the equivalent of the legacy `notifyOnce()`. A second trigger for the same
 * order is a no-op; the admin's "Resend confirmation" passes `force`.
 *
 * A failure never fails the order — the customer has paid. It is written to
 * `emailError` on the order, where the client can see it and resend.
 */

export type OrderEmailKind = 'confirmation' | 'notification' | 'shipped'

type SentField = 'confirmationEmailSentAt' | 'notificationEmailSentAt' | 'shippedEmailSentAt'

const SENT_FIELD: Record<OrderEmailKind, SentField> = {
  confirmation: 'confirmationEmailSentAt',
  notification: 'notificationEmailSentAt',
  shipped: 'shippedEmailSentAt',
}

const BUILD: Record<OrderEmailKind, (view: OrderView) => EmailContent> = {
  confirmation: customerConfirmation,
  notification: ownerNotification,
  shipped: shippedNotification,
}

export type SendResult =
  | { ok: false; reason: string; skipped?: true }
  | { ok: true; to: string }

/** Tells the orders hook that this write is ours, so it does not schedule another email. */
export const ORDER_EMAIL_CONTEXT = { skipOrderEmails: true } as const

/**
 * The customer's own view of the order. The random access token is the key;
 * the email address is deliberately left out of the link so it does not sit in
 * browser history, analytics or server logs. See `app/(app)/order/[id]`.
 */
export const orderLink = (order: Pick<Order, 'accessToken' | 'id'>): string => {
  if (!order.accessToken) return ''
  return `${siteUrl()}/order/${order.id}?${new URLSearchParams({ token: order.accessToken })}`
}

export const sendOrderEmail = async (
  payload: Payload,
  orderId: number,
  kind: OrderEmailKind,
  opts: { force?: boolean } = {},
): Promise<SendResult> => {
  const order = (await payload
    .findByID({ collection: 'orders', depth: 2, id: orderId, overrideAccess: true })
    .catch(() => null)) as null | Order

  if (!order) {
    payload.logger.warn({ kind, order: orderId }, 'Order email skipped — the order does not exist (rolled back?).')
    return { ok: false, reason: 'Order not found.', skipped: true }
  }

  const sentField = SENT_FIELD[kind]
  if (!opts.force && order[sentField]) {
    return { ok: false, reason: 'Already sent.', skipped: true }
  }

  const settings = await payload.findGlobal({ depth: 0, overrideAccess: true, slug: 'siteSettings' })

  const to =
    kind === 'notification'
      ? settings.orderAlertEmail || settings.contactEmail || ''
      : customerEmailOf(order)

  if (!to) {
    payload.logger.warn({ kind, order: orderId }, 'Order email skipped — no recipient.')
    return { ok: false, reason: 'No email address to send to.', skipped: true }
  }

  if (isUndeliverable(to)) {
    payload.logger.info({ kind, order: orderId, to }, 'Order email skipped — test address.')
    return { ok: false, reason: `${to} cannot receive email.`, skipped: true }
  }

  const view = toOrderView(order, {
    adminUrl: `${siteUrl()}/admin/collections/orders/${order.id}`,
    footer: {
      contactEmail: settings.contactEmail,
      instagramHandle: settings.instagramHandle,
      instagramUrl: settings.instagramUrl,
      whatsappNumber: settings.whatsappNumber,
    },
    leadTime: settings.personalisationLeadTime ?? '',
    orderUrl: orderLink(order),
  })

  const content = BUILD[kind](view)

  /**
   * Replies from the customer reach the shop; replies to the owner's alert
   * reach the customer, so she can answer an order question in one step.
   */
  const replyTo =
    kind === 'notification' ? customerEmailOf(order) || undefined : settings.contactEmail || undefined

  try {
    await payload.sendEmail({
      html: content.html,
      replyTo,
      subject: content.subject,
      text: content.text,
      to,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    payload.logger.error({ err: error, kind, order: orderId }, 'Order email failed.')

    await payload
      .update({
        collection: 'orders',
        context: ORDER_EMAIL_CONTEXT,
        data: { emailError: `${kind} — ${message}`.slice(0, 500) },
        depth: 0,
        id: orderId,
        overrideAccess: true,
      })
      .catch(() => undefined)

    return { ok: false, reason: message }
  }

  await payload.update({
    collection: 'orders',
    context: ORDER_EMAIL_CONTEXT,
    data: { [sentField]: new Date().toISOString(), emailError: null },
    depth: 0,
    id: orderId,
    overrideAccess: true,
  })

  payload.logger.info({ kind, order: orderId }, 'Order email sent.')
  return { ok: true, to }
}

/**
 * Runs `task` once the current response has been sent (and the transaction
 * committed). Outside a request — a seed script, the Local API — `after()`
 * throws, and the task runs straight away instead; if the order is not
 * committed yet the sender finds nothing and skips.
 */
export const runAfterResponse = (payload: Payload, task: () => Promise<unknown>): void => {
  const safe = async () => {
    try {
      await task()
    } catch (error) {
      payload.logger.error({ err: error }, 'Scheduled order email failed.')
    }
  }

  try {
    after(safe)
  } catch {
    void safe()
  }
}
