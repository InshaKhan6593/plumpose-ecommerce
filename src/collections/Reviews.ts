import type { CollectionConfig, FieldAccess } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { publicAccess } from '@/access/publicAccess'
import { checkRole } from '@/access/utilities'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import { validateReview } from '@/hooks/validateReview'

/** Only she may set these — a stranger's value for them is dropped, whatever the request says. */
const adminField: FieldAccess = ({ req: { user } }) => Boolean(user && checkRole(['admin'], user as never))

/**
 * Reviews (REQUIREMENTS S18, A15). Customers send them from the product page;
 * they show only once she approves them, with the average rating beside the
 * price. She can reply (shown under the review) and feature a review on the
 * homepage. The existing site collected reviews and never showed them.
 *
 * Publicly writable, so every public review is checked on the server
 * (@/hooks/validateReview) and always starts as "Pending approval": the
 * approval, the reply and the homepage flag cannot be set from outside.
 */
export const Reviews: CollectionConfig = {
  slug: 'reviews',
  /** Soft delete — a mistaken delete here costs real work to recreate. */
  trash: true,
  defaultSort: '-createdAt',
  admin: {
    defaultColumns: ['name', 'rating', 'product', 'status', 'featured', 'verifiedPurchase', 'createdAt'],
    description: 'New reviews wait here for your approval. Approved ones show on the piece’s page; featured ones on the homepage too.',
    group: 'Content',
    useAsTitle: 'name',
  },
  access: {
    create: publicAccess,
    delete: adminOnly,
    read: ({ req: { user } }) => {
      if (user && checkRole(['admin'], user as never)) return true
      return { status: { equals: 'approved' } }
    },
    update: adminOnly,
  },
  /** The storefront pages that show this are prerendered; see revalidateStorefront. */
  hooks: { ...withStorefrontRefresh(), beforeValidate: [validateReview] },
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products', required: true },
    { name: 'name', type: 'text', required: true },
    {
      name: 'email',
      type: 'email',
      access: { read: adminField },
      admin: { description: 'Never shown on the site.' },
      required: true,
    },
    { name: 'rating', type: 'number', max: 5, min: 1, required: true },
    { name: 'title', type: 'text', maxLength: 120 },
    { name: 'body', type: 'textarea', label: 'Review', maxLength: 2000, required: true },
    {
      name: 'reply',
      type: 'textarea',
      access: { create: adminField, update: adminField },
      admin: { description: 'Optional. Shown under the review as a reply from plumpose.' },
      label: 'Your reply',
      maxLength: 1000,
    },
    {
      name: 'status',
      type: 'select',
      // A public review can never arrive approved: without create access the value is dropped and the default applies.
      access: { create: adminField, update: adminField },
      admin: { position: 'sidebar' },
      defaultValue: 'pending',
      options: [
        { label: 'Pending approval', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      required: true,
    },
    {
      name: 'featured',
      type: 'checkbox',
      access: { create: adminField, update: adminField },
      admin: { description: 'Show this review on the homepage (once approved).', position: 'sidebar' },
      defaultValue: false,
      label: 'Feature on the homepage',
    },
    {
      /** Set by the server when the email has an order for this piece; see validateReview. */
      name: 'verifiedPurchase',
      type: 'checkbox',
      access: { update: adminField },
      admin: { description: 'This email has an order for this piece.', position: 'sidebar', readOnly: true },
      defaultValue: false,
      label: 'Verified purchase',
    },
    {
      /** A salted hash of the sender's address, for the per-device limit. Never the address itself. */
      name: 'ipHash',
      type: 'text',
      access: { read: adminField, update: () => false },
      admin: { hidden: true },
      index: true,
    },
  ],
}
