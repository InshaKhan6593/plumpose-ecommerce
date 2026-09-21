import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { publicAccess } from '@/access/publicAccess'

/**
 * Reviews are submitted by anyone but only render once approved.
 * The existing site collected reviews and never displayed them — this fixes that.
 */
export const Reviews: CollectionConfig = {
  slug: 'reviews',
  /** Soft delete — a mistaken delete here costs real work to recreate. */
  trash: true,
  defaultSort: '-createdAt',
  admin: {
    defaultColumns: ['name', 'rating', 'product', 'status', 'createdAt'],
    group: 'Content',
    useAsTitle: 'name',
  },
  access: {
    create: publicAccess,
    delete: adminOnly,
    read: ({ req: { user } }) => {
      if (user) return true
      return { status: { equals: 'approved' } }
    },
    update: adminOnly,
  },
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products', required: true },
    { name: 'name', type: 'text', required: true },
    {
      name: 'email',
      type: 'email',
      access: { read: ({ req }) => Boolean(req.user) },
      required: true,
    },
    { name: 'rating', type: 'number', max: 5, min: 1, required: true },
    { name: 'title', type: 'text' },
    { name: 'body', type: 'textarea', maxLength: 2000, required: true },
    {
      name: 'status',
      type: 'select',
      admin: { position: 'sidebar' },
      defaultValue: 'pending',
      options: [
        { label: 'Pending approval', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      required: true,
    },
  ],
}
