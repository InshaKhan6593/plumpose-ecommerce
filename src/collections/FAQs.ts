import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  labels: { singular: 'FAQ', plural: 'FAQs' },
  admin: {
    defaultColumns: ['question', 'category', 'published', 'sortOrder'],
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
    { name: 'published', type: 'checkbox', admin: { position: 'sidebar' }, defaultValue: true },
    { name: 'sortOrder', type: 'number', admin: { position: 'sidebar' }, defaultValue: 0 },
  ],
}
