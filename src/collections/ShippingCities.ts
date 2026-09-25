import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import { autoKey } from '@/fields/autoKey'

/**
 * Qatar delivery is priced by city rather than by zone.
 * Ported from QATAR_CITIES in netlify/lib/shipping.mjs.
 */
export const ShippingCities: CollectionConfig = {
  slug: 'shippingCities',
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'Qatar city', plural: 'Qatar delivery' },
  admin: {
    defaultColumns: ['name', 'feeQar', 'active'],
    group: 'Shop settings',
    useAsTitle: 'name',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  /** The storefront pages that show this are prerendered; see revalidateStorefront. */
  hooks: withStorefrontRefresh(),
  fields: [
    { name: 'name', type: 'text', required: true },
    autoKey('name'),
    { name: 'feeQar', type: 'number', label: 'Delivery fee (QAR)', min: 0, required: true },
    {
      name: 'active',
      type: 'checkbox',
      admin: {
        components: { Cell: '@/components/admin/BooleanCell#BooleanCell' },
        position: 'sidebar',
      },
      defaultValue: true,
    },
  ],
}
