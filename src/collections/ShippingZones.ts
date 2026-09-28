import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import { autoKey } from '@/fields/autoKey'

/**
 * International delivery zones. Ported from netlify/lib/shipping.mjs.
 * Fees are in QAR. Which country sits in which zone is set on the country record.
 */
export const ShippingZones: CollectionConfig = {
  slug: 'shippingZones',
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'Delivery zone', plural: 'International delivery' },
  admin: {
    defaultColumns: ['name', 'feeQar', 'active'],
    description:
      'What delivery costs outside Qatar. Each country is priced from one of these zones (see Countries).',
    group: 'Shop settings',
    useAsTitle: 'name',
  },
  /**
   * The zones are a fixed set: countries point at them by a hidden key she
   * cannot see or set, so a new zone applied to no country, and deleting one
   * stopped every country in it from checking out. She changes a zone's name,
   * fee and Active; a new zone is a developer's job.
   */
  disableBulkEdit: true,
  disableDuplicate: true,
  access: {
    create: () => false,
    delete: () => false,
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
      admin: {
        description:
          'In riyals: type 200 for QAR 200. The international surcharge in Site settings is added on top.',
      },
      label: 'Delivery fee (QAR)',
      min: 0,
      required: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      admin: {
        components: { Cell: '@/components/admin/BooleanCell#BooleanCell' },
        description:
          'Untick to stop delivering to every country in this zone — customers there are asked to email you.',
        position: 'sidebar',
      },
      defaultValue: true,
    },
  ],
}
