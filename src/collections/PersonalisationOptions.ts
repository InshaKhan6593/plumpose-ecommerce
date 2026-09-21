import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Hand-embroidery options. Ported from netlify/lib/personalisation.mjs on the
 * existing site, where these were hardcoded. The client can now edit them.
 */
export const PersonalisationOptions: CollectionConfig = {
  slug: 'personalisationOptions',
  labels: { singular: 'Personalisation option', plural: 'Personalisation' },
  admin: {
    defaultColumns: ['name', 'type', 'active', 'sortOrder'],
    description: 'Where embroidery can go, which motifs and thread colours are offered.',
    group: 'Shop settings',
    useAsTitle: 'name',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Placement', value: 'placement' },
        { label: 'Style', value: 'style' },
        { label: 'Symbol', value: 'symbol' },
        { label: 'Thread colour', value: 'thread' },
      ],
      required: true,
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'key',
      type: 'text',
      admin: { description: 'Lowercase identifier, e.g. "cuff".' },
      required: true,
      unique: true,
    },
    { name: 'note', type: 'text' },
    {
      name: 'hex',
      type: 'text',
      admin: {
        condition: (data) => data?.type === 'thread',
        description: 'Thread colour, e.g. #BD9540',
      },
    },
    {
      name: 'svgPath',
      type: 'textarea',
      admin: {
        condition: (data) => data?.type === 'symbol',
        description: 'SVG path data on a 24x24 grid.',
      },
    },
    { name: 'active', type: 'checkbox', admin: { position: 'sidebar' }, defaultValue: true },
    { name: 'sortOrder', type: 'number', admin: { position: 'sidebar' }, defaultValue: 0 },
  ],
}
