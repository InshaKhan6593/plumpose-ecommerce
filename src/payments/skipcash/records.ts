import type { Payload, PayloadRequest } from 'payload'

import type { Transaction } from '@/payload-types'

/** The payment method's name: `/api/payments/skipcash/…`, `transactions.skipcash`. */
export const SKIPCASH = 'skipcash'

/**
 * The transaction a SkipCash payment belongs to, by the reference we sent as
 * its `TransactionId`. Exactly one, or none — two would mean the reference was
 * not unique, and neither can then be trusted.
 */
export const findTransactionByReference = async (
  payload: Payload,
  reference: string,
  req?: PayloadRequest,
): Promise<null | Transaction> => {
  if (!reference) return null
  const found = await payload.find({
    collection: 'transactions',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    pagination: false,
    req,
    where: { 'skipcash.reference': { equals: reference } },
  })
  return found.docs.length === 1 ? found.docs[0]! : null
}
