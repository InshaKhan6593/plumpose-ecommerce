import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import { webAddress } from '@/fields/webAddress'

/**
 * "Made for You" — bespoke and collaboration work shown outside the
 * regular collections. Fully client-managed.
 */
export const Projects: CollectionConfig = {
  slug: 'projects',
  /** Soft delete — a mistaken delete here costs real work to recreate. */
  trash: true,
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'Project', plural: 'Made for You' },
  admin: {
    defaultColumns: ['title', 'category', 'published'],
    description: 'Bridal, bespoke, special embroidery and brand collaborations.',
    group: 'Content',
    useAsTitle: 'title',
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
    { name: 'title', type: 'text', required: true },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'bespoke',
      options: [
        { label: 'Bridal', value: 'bridal' },
        { label: 'Bespoke', value: 'bespoke' },
        { label: 'Special embroidery', value: 'embroidery' },
        { label: 'Collaboration', value: 'collaboration' },
        { label: 'Other', value: 'other' },
      ],
      required: true,
    },
    {
      name: 'brandName',
      type: 'text',
      admin: { description: 'Optional — shown on collaborations.' },
      label: 'Brand or client name',
    },
    { name: 'summary', type: 'textarea', maxLength: 300 },
    { name: 'description', type: 'richText' },
    { name: 'coverImage', type: 'upload', relationTo: 'media', required: true },
    {
      name: 'gallery',
      type: 'array',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
      labels: { singular: 'Image', plural: 'Gallery' },
    },
    {
      name: 'published',
      type: 'checkbox',
      admin: {
        components: { Cell: '@/components/admin/BooleanCell#BooleanCell' },
        position: 'sidebar',
      },
      defaultValue: false,
    },
    webAddress(),
  ],
}
