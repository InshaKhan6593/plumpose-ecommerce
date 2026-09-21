import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * "Made for You" — bespoke and collaboration work shown outside the
 * regular collections. Fully client-managed.
 */
export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: 'Project', plural: 'Made for You' },
  admin: {
    defaultColumns: ['title', 'category', 'published', 'sortOrder'],
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
    { name: 'published', type: 'checkbox', admin: { position: 'sidebar' }, defaultValue: false },
    { name: 'sortOrder', type: 'number', admin: { position: 'sidebar' }, defaultValue: 0 },
    slugField(),
  ],
}
