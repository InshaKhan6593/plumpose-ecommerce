import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Segments on the first-visit reward wheel. The client edits the prizes and
 * their odds here.
 *
 * `weight` is restricted at field level so the win probabilities are never
 * sent to the browser — otherwise anyone could read the odds from the API.
 */
export const SpinSegments: CollectionConfig = {
  slug: 'spinSegments',
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'Wheel segment', plural: 'Reward wheel' },
  admin: {
    defaultColumns: ['label', 'rewardType', 'rewardValue', 'weight', 'active'],
    description: 'Prizes on the first-visit wheel. Weight controls how often each is won.',
    group: 'Shop',
    useAsTitle: 'label',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      admin: { description: 'Shown on the wheel, e.g. "10% off".' },
      required: true,
    },
    {
      name: 'rewardType',
      type: 'select',
      defaultValue: 'percent',
      options: [
        { label: 'Percentage off', value: 'percent' },
        { label: 'Fixed amount off (QAR)', value: 'fixed' },
        { label: 'Free delivery', value: 'freeShipping' },
        { label: 'Roll again', value: 'rollAgain' },
      ],
      required: true,
    },
    {
      name: 'rewardValue',
      type: 'number',
      admin: { condition: (data) => ['fixed', 'percent'].includes(data?.rewardType) },
      min: 0,
    },
    {
      name: 'weight',
      type: 'number',
      access: { read: ({ req }) => Boolean(req.user) },
      admin: { description: 'Relative chance of winning. Higher wins more often.' },
      defaultValue: 1,
      min: 0,
      required: true,
    },
    {
      name: 'colour',
      type: 'text',
      admin: { description: 'Segment background, e.g. #f6f4f0' },
      defaultValue: '#f6f4f0',
    },
    {
      name: 'expiryDays',
      type: 'number',
      admin: { description: 'How many days the issued code stays valid.' },
      defaultValue: 30,
    },
    { name: 'active', type: 'checkbox', admin: { components: { Cell: '@/components/admin/BooleanCell#BooleanCell' }, position: 'sidebar' }, defaultValue: true },
  ],
}
