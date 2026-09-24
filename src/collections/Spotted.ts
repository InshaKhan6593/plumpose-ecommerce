import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'

/**
 * Customer photographs. Nothing appears on the site until it has been
 * approved in the admin — a luxury brand cannot show unmoderated UGC.
 */
export const Spotted: CollectionConfig = {
  slug: 'spotted',
  /** Soft delete — a mistaken delete here costs real work to recreate. */
  trash: true,
  defaultSort: '-createdAt',
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'Spotted post', plural: 'Spotted' },
  admin: {
    defaultColumns: ['instagramHandle', 'status', 'createdAt'],
    description: 'Customer photos. Only approved posts appear on the site.',
    group: 'Content',
    useAsTitle: 'instagramHandle',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: ({ req: { user } }) => {
      if (user) return true
      return { status: { equals: 'approved' } }
    },
    update: adminOnly,
  },
  /** The storefront pages that show this are prerendered; see revalidateStorefront. */
  hooks: withStorefrontRefresh(),
  fields: [
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    {
      name: 'instagramHandle',
      type: 'text',
      admin: { description: 'Including the @.' },
      required: true,
    },
    { name: 'caption', type: 'text', maxLength: 200 },
    { name: 'postUrl', type: 'text', label: 'Link to the Instagram post' },
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
