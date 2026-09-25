import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  /** Soft delete — a mistaken delete here costs real work to recreate. */
  trash: true,
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'FAQ', plural: 'FAQs' },
  admin: {
    defaultColumns: ['question', 'category', 'published'],
    group: 'Content',
    useAsTitle: 'question',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: ({ req: { user } }) => {
      if (user) return true
      return { published: { equals: true } }
    },
    update: adminOnly,
  },
  /** The storefront pages that show this are prerendered; see revalidateStorefront. */
  hooks: withStorefrontRefresh(),
  fields: [
    { name: 'question', type: 'text', required: true },
    { name: 'answer', type: 'richText', required: true },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'orders',
      options: [
        { label: 'Orders & Payment', value: 'orders' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Returns & Exchanges', value: 'returns' },
        { label: 'Personalisation', value: 'personalisation' },
        { label: 'Product & Care', value: 'care' },
      ],
    },
    {
      name: 'published',
      type: 'checkbox',
      admin: {
        components: { Cell: '@/components/admin/BooleanCell#BooleanCell' },
        position: 'sidebar',
      },
      defaultValue: true,
    },
  ],
}
