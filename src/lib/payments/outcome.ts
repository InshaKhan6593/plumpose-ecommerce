/**
 * What happened to a payment attempt, in words she can act on (REQUIREMENTS
 * P11: failed and abandoned payments stored and visible in admin).
 *
 * Every checkout creates one payment record before the customer is sent to
 * the payment page, so a customer who never pays is still here — with the
 * email, the bag and the amount — for her to follow up.
 *
 * Pure, so it can be tested; the admin column and the dashboard both use it.
 */

/** SkipCash cancels a payment left unfinished after an hour (dev.skipcash.app, Webhooks). */
export const CHECKOUT_LIFETIME_MS = 60 * 60 * 1000

export type PaymentStatus =
  'cancelled' | 'expired' | 'failed' | 'pending' | 'processing' | 'refunded' | 'succeeded'

export type Outcome = {
  /** Paid, or still able to become paid: nothing to follow up. */
  fine: boolean
  label: string
}

export function paymentOutcome(args: {
  createdAt: Date | string
  /** Card declines the gateway reported during this checkout, newest first. */
  declines?: string[]
  now?: Date
  orderId?: null | number | string
  status?: null | PaymentStatus | string
}): Outcome {
  const age = (args.now ?? new Date()).getTime() - new Date(args.createdAt).getTime()
  const declines = args.declines ?? []
  const declined = declines.length
    ? ` — card declined ${declines.length === 1 ? 'once' : `${declines.length} times`}${declines[0] ? ` ("${declines[0]}")` : ''}`
    : ''

  switch (args.status) {
    case 'succeeded':
      return { fine: true, label: args.orderId ? `Paid — order #${args.orderId}` : 'Paid' }
    case 'refunded':
      return { fine: true, label: 'Refunded' }
    case 'processing':
      return { fine: true, label: 'Paying now' }
    case 'failed':
      return { fine: false, label: `Payment failed${declined}` }
    case 'cancelled':
      return { fine: false, label: `Cancelled${declined}` }
    case 'expired':
      return { fine: false, label: `Not paid — left the payment page${declined}` }
    case 'pending':
    default:
      // The page is still open: the customer may yet pay.
      if (age < CHECKOUT_LIFETIME_MS) return { fine: true, label: `On the payment page${declined}` }
      return { fine: false, label: `Not paid — left the payment page${declined}` }
  }
}

/**
 * The logged webhook events that mean "a card was refused during this
 * checkout" — SkipCash's failed (4) and rejected (5). See
 * `payments/skipcash/webhook.ts`, which names them.
 */
export const DECLINE_EVENTS = ['skipcash.failed', 'skipcash.rejected']

/**
 * The gateway's own reason for a declined card, from a logged callback.
 * SkipCash sends none — only that it failed or was rejected — so a
 * rejection says so and a plain failure adds nothing.
 */
export function declineReason(event: unknown): string {
  const statusId = Number((event as { StatusId?: unknown })?.StatusId)
  return statusId === 5 ? 'rejected by the bank' : ''
}
