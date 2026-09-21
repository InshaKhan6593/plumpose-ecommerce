import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * International delivery zones. Ported from netlify/lib/shipping.mjs.
 * Fees are in QAR. Which country sits in which zone is set on the country record.
 */
export const ShippingZones: CollectionConfig = {
  slug: 'shippingZones',
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'Shipping zone', plural: 'Shipping zones' },
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
    { name: 'active', type: 'checkbox', admin: { components: { Cell: '@/components/admin/BooleanCell#BooleanCell' }, position: 'sidebar' }, defaultValue: true },
  ],
}
