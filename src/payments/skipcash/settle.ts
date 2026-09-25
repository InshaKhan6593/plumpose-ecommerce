import type { Payload } from 'payload'

import {
  confirmInProcess,
  customerOfTransaction,
  orderForTransaction,
  type SettleResult,
} from '../checkout'
import { getPayment, type SkipCashConfig, skipcashConfig } from './api'
import { isPaymentId, PAID } from './protocol'
import { findTransactionByReference, SKIPCASH } from './records'

/**
 * Turns a SkipCash payment into an order, if it has been paid. Safe to call
 * any number of times, from anywhere: the return page, the webhook, a retry.
 *
 * It always asks SkipCash what happened — never the browser, and never the
 * webhook body on its own. `confirmOrder` in `./adapter.ts` asks again and
 * checks amount, currency, cart and customer before any order exists.
 */
export const settleSkipcashPayment = async (args: {
  config?: SkipCashConfig
  payload: Payload
  paymentId: string
}): Promise<SettleResult> => {
  const { payload, paymentId } = args
  const config = args.config ?? skipcashConfig()

  if (!isPaymentId(paymentId))
    return { reason: 'That payment could not be found.', status: 'error' }

  let payment: Awaited<ReturnType<typeof getPayment>>
  try {
    payment = await getPayment(config, paymentId)
  } catch (error) {
    payload.logger.warn({ err: error, paymentId }, 'SkipCash could not be asked about a payment.')
    return { status: 'pending' }
  }
  if (!payment) return { reason: 'That payment could not be found.', status: 'error' }

  const transaction = await findTransactionByReference(payload, String(payment.transactionId ?? ''))
  if (!transaction) return { reason: 'No record of this payment on our side.', status: 'error' }

  const existing = await orderForTransaction(payload, transaction.id)
  if (existing) return { ...existing, status: 'confirmed' }

  switch (Number(payment.statusId)) {
    case PAID:
      break
    /** On the card form now, or being authorised. */
    case 1:
    case 12:
      return { status: 'pending' }
    /**
     * Refused. SkipCash keeps the original payment link open for another try
     * and reports the refusal under a copy with a new id, so this payment's
     * own record stays pending — a second card may yet pay it.
     */
    case 4:
    case 5:
      return { status: 'failed' }
    /** 0 — never paid (the customer came back without paying); 3 — cancelled. */
    default:
      return { status: 'unpaid' }
  }

  const cartID = typeof transaction.cart === 'object' ? transaction.cart?.id : transaction.cart
  const cart = cartID
    ? await payload
        .findByID({ collection: 'carts', depth: 0, id: cartID, overrideAccess: true })
        .catch(() => null)
    : null

  const { missing, user } = await customerOfTransaction(payload, transaction.customer)
  if (missing) {
    return { reason: 'The account this payment belongs to no longer exists.', status: 'error' }
  }

  const response = await confirmInProcess({
    data: {
      cartID,
      customerEmail: transaction.customerEmail ?? undefined,
      paymentId: payment.id,
      /** A guest is authorised by the cart's own secret, the way the browser would be. */
      secret: cart?.secret ?? undefined,
    },
    payload,
    provider: SKIPCASH,
    user,
  })

  if (response?.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      accessToken?: string
      orderID?: number
    }
    if (body.orderID) {
      return {
        accessToken: body.accessToken ?? '',
        orderId: Number(body.orderID),
        status: 'confirmed',
      }
    }
  }

  /** The other caller may have won the race while we were confirming. */
  const settled = await orderForTransaction(payload, transaction.id)
  if (settled) return { ...settled, status: 'confirmed' }

  const detail = response ? await response.text().catch(() => '') : 'no response'
  payload.logger.error(
    {
      detail: detail.slice(0, 300),
      paymentId,
      status: response?.status,
      transaction: transaction.id,
    },
    'A paid SkipCash payment could not be confirmed into an order.',
  )
  return { status: 'pending' }
}
