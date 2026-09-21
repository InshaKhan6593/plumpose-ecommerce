import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Press: CollectionConfig = {
  slug: 'press',
  labels: { singular: 'Press item', plural: 'Press' },
  admin: {
    defaultColumns: ['headline', 'publication', 'date', 'published'],
    group: 'Content',
    useAsTitle: 'headline',
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
    { name: 'publication', type: 'text', required: true },
    { name: 'headline', type: 'text', required: true },
    { name: 'excerpt', type: 'textarea', maxLength: 300 },
    { name: 'url', type: 'text', label: 'Link to the article' },
    { name: 'date', type: 'date', required: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'published', type: 'checkbox', admin: { position: 'sidebar' }, defaultValue: true },
    { name: 'sortOrder', type: 'number', admin: { position: 'sidebar' }, defaultValue: 0 },
  ],
}
