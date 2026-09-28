import type { Field, FieldHook } from 'payload'

import { newReference } from '@/payments/skipcash/protocol'

/**
 * The code a customer knows their order by — "PLM-250928-7K4QX2", on the order
 * page, the account page, every email and Track order — in place of the database's
 * "No. 105". It is the paid payment's own reference, so the receipt, the
 * SkipCash portal and the admin all show one code. An order made without a
 * SkipCash payment (a demo order, a test) gets a new one of the same form.
 * Existing orders were given theirs by migration 20260928_*_order_reference.
 */
const fillReference: FieldHook = async ({ data, operation, req, value }) => {
  if (value || operation !== 'create') return value
  const ids = Array.isArray(data?.transactions) ? data.transactions : []
  for (const t of ids) {
    const id = typeof t === 'object' && t ? (t as { id: number }).id : t
    if (!id) continue
    // Inside the plugin's confirm-order transaction: `req` threads it, or the row is not visible yet.
    const transaction = await req.payload
      .findByID({ collection: 'transactions', depth: 0, id, overrideAccess: true, req })
      .catch(() => null)
    const reference = (transaction as { skipcash?: { reference?: null | string } } | null)?.skipcash
      ?.reference
    if (reference) return reference
  }
  return newReference()
}

export const orderReferenceField: Field = {
  name: 'reference',
  type: 'text',
  admin: {
    description: 'The code your customer sees on their receipt and in every email — also the Transaction ID in SkipCash.',
    position: 'sidebar',
    readOnly: true,
  },
  hooks: { beforeValidate: [fillReference] },
  index: true,
  label: 'Order code',
  unique: true,
}

/** "PLM-250928-7K4QX2" as typed: any case, spaces or missing hyphens. Null if it is not one. */
export const readOrderCode = (typed: string): null | string => {
  const m = typed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .match(/^PLM(\d{6})([A-Z0-9]{6})$/)
  return m ? `PLM-${m[1]}-${m[2]}` : null
}

/** How an order is named to a customer: its code, or "no. 105" for an order from before codes. */
export const orderCode = (order: { id: number | string; reference?: null | string }): string =>
  order.reference || `no. ${order.id}`
