import type { CollectionAfterChangeHook } from 'payload'

import type { Order, Product, Transaction, Variant } from '@/payload-types'

const idOf = (value: unknown): null | number =>
  typeof value === 'number' ? value : value && typeof value === 'object' && 'id' in value ? Number((value as { id: unknown }).id) : null

/**
 * Stock after a payment settles — the safety net under `./../lib/pricing/stock.ts`.
 *
 * The plugin takes each piece off stock with a raw `$inc` when it creates the
 * order (`endpoints/confirmOrder.js`), and nothing stops that going below
 * zero: two customers paying at the same moment for the last piece both pass
 * the check before payment. Failing a paid order would be worse than the
 * oversell, so instead, the moment the transaction is marked `succeeded` —
 * which the plugin does right after its decrement, in the same database
 * transaction —
 *
 *   - any stock below zero goes back to zero, so the figure in the admin
 *     always means "ready to send", never a debt;
 *   - the order gets a line in its internal notes saying which sizes went
 *     beyond stock: **made to order** when the product allows it, or
 *     **oversold — contact the customer** when it does not.
 */
export const stockAfterSale: CollectionAfterChangeHook<Transaction> = async ({ doc, previousDoc, req }) => {
  if (doc.status !== 'succeeded' || previousDoc?.status === 'succeeded') return doc
  const orderID = idOf(doc.order)
  if (!orderID) return doc

  const notes: string[] = []

  for (const item of doc.items ?? []) {
    const variantID = idOf(item.variant)
    const productID = idOf(item.product)
    const collection = variantID ? 'variants' : 'products'
    const id = variantID ?? productID
    if (!id) continue

    const record = (await req.payload
      .findByID({ collection, depth: 0, id, overrideAccess: true, req })
      .catch(() => null)) as null | Product | Variant
    if (!record || (record.inventory ?? 0) >= 0) continue

    const beyond = -(record.inventory ?? 0)
    await req.payload.db.updateOne({ collection, data: { inventory: 0 }, id, req })

    const product = variantID
      ? ((await req.payload.findByID({ collection: 'products', depth: 0, id: productID!, overrideAccess: true, req }).catch(() => null)) as null | Product)
      : (record as Product)
    const what = (record as Variant).title ?? product?.title ?? `item ${id}`

    notes.push(
      product?.madeToOrder === false
        ? `OVERSOLD — ${what}: ${beyond} more than were in stock when paid. Contact the customer.`
        : `Made to order — ${what}: ${beyond} beyond ready stock when paid.`,
    )
  }

  if (notes.length) {
    const order = (await req.payload.findByID({ collection: 'orders', depth: 0, id: orderID, overrideAccess: true, req })) as Order
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
    await req.payload.update({
      collection: 'orders',
      // Only the note changes: no order emails, no storefront refresh for it.
      context: { disableRevalidate: true, skipOrderEmails: true },
      data: { adminNotes: [order.adminNotes, ...notes.map((n) => `[${stamp}] ${n}`)].filter(Boolean).join('\n') },
      id: orderID,
      overrideAccess: true,
      req,
    })
    req.payload.logger.warn({ notes, order: orderID }, 'Stock went beyond what was ready; clamped to zero and noted on the order.')
  }

  return doc
}
