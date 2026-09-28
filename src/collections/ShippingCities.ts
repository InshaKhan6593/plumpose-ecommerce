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
    description:
      'What delivery costs to each place in Qatar. Checkout lists them in this order — drag a row by its handle to move it.',
    group: 'Shop settings',
    useAsTitle: 'name',
  },
  /** A copy kept the hidden key, which must be unique, so Duplicate only ever failed. */
  /** Editing several at once gave them all one fee. */
  disableBulkEdit: true,
  disableDuplicate: true,
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
    {
      name: 'feeQar',
      type: 'number',
      admin: { description: 'In riyals: type 20 for QAR 20. Live on checkout as soon as you save.' },
      label: 'Delivery fee (QAR)',
      min: 0,
      required: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      admin: {
        components: { Cell: '@/components/admin/BooleanCell#BooleanCell' },
        description: 'Untick to stop delivering here: it leaves the checkout list and the Shipping page.',
        position: 'sidebar',
      },
      defaultValue: true,
    },
  ],
}
