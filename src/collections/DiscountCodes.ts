import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Promotions, and the codes issued by the first-visit reward wheel.
 *
 * Never publicly readable — a public list of valid codes would be handed
 * straight to anyone who asked for it. Validation happens server-side at
 * checkout using the Local API.
 */
export const DiscountCodes: CollectionConfig = {
  slug: 'discountCodes',
  defaultSort: '-createdAt',
  labels: { singular: 'Discount code', plural: 'Discount codes' },
  admin: {
    defaultColumns: ['code', 'type', 'value', 'usageCount', 'active', 'expiresAt'],
    group: 'Shop',
    useAsTitle: 'code',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value),
        ],
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'percent',
      options: [
        { label: 'Percentage off', value: 'percent' },
        { label: 'Fixed amount off (QAR)', value: 'fixed' },
        { label: 'Free delivery', value: 'freeShipping' },
      ],
      required: true,
    },
    {
      name: 'value',
      type: 'number',
      admin: {
        condition: (data) => data?.type !== 'freeShipping',
        description: 'Percentage (e.g. 10) or amount in QAR (e.g. 100).',
      },
      min: 0,
    },
    { name: 'minSpendQar', type: 'number', label: 'Minimum spend (QAR)', min: 0 },
    {
      name: 'usageLimit',
      type: 'number',
      admin: { description: 'Total uses allowed. Leave empty for unlimited.' },
      min: 0,
    },
    { name: 'perCustomerLimit', type: 'number', defaultValue: 1, min: 0 },
    {
      name: 'usageCount',
      type: 'number',
      admin: { position: 'sidebar', readOnly: true },
      defaultValue: 0,
    },
    { name: 'startsAt', type: 'date' },
    { name: 'expiresAt', type: 'date' },
    {
      name: 'appliesTo',
      type: 'relationship',
      admin: { description: 'Leave empty to apply to everything.' },
      hasMany: true,
      relationTo: 'products',
    },
    {
      name: 'source',
      type: 'select',
      admin: { position: 'sidebar', readOnly: true },
      defaultValue: 'manual',
      options: [
        { label: 'Created manually', value: 'manual' },
        { label: 'Reward wheel', value: 'spinWheel' },
      ],
    },
    {
      name: 'issuedToEmail',
      type: 'email',
      admin: { description: 'Set when the code came from the wheel.', position: 'sidebar' },
    },
    { name: 'active', type: 'checkbox', admin: { components: { Cell: '@/components/admin/BooleanCell#BooleanCell' }, position: 'sidebar' }, defaultValue: true },
  ],
}
