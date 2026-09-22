import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * One row per redemption — what A7's usage report reads, and what enforces
 * `perCustomerLimit` on `discountCodes`.
 *
 * Written by the server only, on successful payment (P7): a code held in an
 * abandoned basket must never count as used. `usageCount` on the code itself
 * stays as the fast counter; this is the ledger behind it.
 */
export const DiscountUses: CollectionConfig = {
  slug: 'discountUses',
  access: {
    /** Server-written. Nothing in the browser may forge a redemption. */
    create: () => false,
    delete: () => false,
    read: adminOnly,
    update: () => false,
  },
  admin: {
    defaultColumns: ['code', 'email', 'order', 'amountQar', 'createdAt'],
    description: 'Every time a discount code was actually redeemed.',
    group: 'Shop',
    /** A report, not a workspace — surfaced from the code, not the sidebar. */
    hidden: true,
    useAsTitle: 'email',
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'code',
      type: 'relationship',
      index: true,
      relationTo: 'discountCodes',
      required: true,
    },
    { name: 'order', type: 'relationship', relationTo: 'orders' },
    {
      name: 'email',
      type: 'email',
      admin: { description: 'Who redeemed it — this is what per-customer limits count.' },
      index: true,
      required: true,
    },
    {
      name: 'amountQar',
      type: 'number',
      admin: { description: 'What the discount was worth on this order, in minor units.' },
    },
  ],
  labels: { plural: 'Discount redemptions', singular: 'Discount redemption' },
}
