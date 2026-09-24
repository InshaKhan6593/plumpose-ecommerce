import { slugField } from 'payload'
import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'

export const Categories: CollectionConfig = {
  slug: 'categories',
  /** She calls these collections, and so does the product screen. */
  labels: { singular: 'Collection', plural: 'Collections' },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    group: 'Content',
    listSearchableFields: ['title', 'slug'],
    useAsTitle: 'title',
  },
  // The collection's name is on the prerendered homepage.
  hooks: withStorefrontRefresh(),
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
    }),
  ],
}
