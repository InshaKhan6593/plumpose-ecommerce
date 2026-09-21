import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Press: CollectionConfig = {
  slug: 'press',
  /** Soft delete — a mistaken delete here costs real work to recreate. */
  trash: true,
  defaultSort: '-date',
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
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
    { name: 'published', type: 'checkbox', admin: { components: { Cell: '@/components/admin/BooleanCell#BooleanCell' }, position: 'sidebar' }, defaultValue: true },
  ],
}
