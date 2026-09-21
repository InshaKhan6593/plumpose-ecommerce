import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { autoKey } from '@/fields/autoKey'

/**
 * Hand-embroidery options. Ported from netlify/lib/personalisation.mjs on the
 * existing site, where these were hardcoded. The client can now edit them.
 */
export const PersonalisationOptions: CollectionConfig = {
  slug: 'personalisationOptions',
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'Personalisation option', plural: 'Personalisation' },
  admin: {
    defaultColumns: ['name', 'type', 'hex', 'active'],
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
    autoKey('name'),
    { name: 'note', type: 'text' },
    {
      name: 'hex',
      type: 'text',
      admin: {
        components: { Cell: '@/components/admin/SwatchCell#SwatchCell' },
        condition: (data) => data?.type === 'thread',
        description: 'A colour code, for example #BD9540. Your developer can help if unsure.',
      },
    },
    {
      name: 'svgPath',
      type: 'textarea',
      admin: {
        condition: (data) => data?.type === 'symbol',
        description:
          'The drawing itself. Ask your developer to change this — it is not something you edit by hand.',
        readOnly: true,
      },
      label: 'Motif drawing',
    },
    { name: 'active', type: 'checkbox', admin: { components: { Cell: '@/components/admin/BooleanCell#BooleanCell' }, position: 'sidebar' }, defaultValue: true },
  ],
}
