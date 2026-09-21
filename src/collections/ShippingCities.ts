import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Qatar delivery is priced by city rather than by zone.
 * Ported from QATAR_CITIES in netlify/lib/shipping.mjs.
 */
export const ShippingCities: CollectionConfig = {
  slug: 'shippingCities',
  labels: { singular: 'Qatar city', plural: 'Qatar delivery' },
  admin: {
    defaultColumns: ['name', 'key', 'feeQar', 'active'],
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
    { name: 'name', type: 'text', required: true },
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'feeQar', type: 'number', label: 'Delivery fee (QAR)', min: 0, required: true },
    { name: 'active', type: 'checkbox', admin: { position: 'sidebar' }, defaultValue: true },
    { name: 'sortOrder', type: 'number', admin: { position: 'sidebar' }, defaultValue: 0 },
  ],
}
