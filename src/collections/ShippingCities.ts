import type { CollectionConfig, NumberFieldSingleValidation } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import { cityKeyForZone, qbasZone } from '@/data/qbasZones'
import { autoKey } from '@/fields/autoKey'

/** A zone with its own price must be one of QBAS's, in this city, and listed once. */
const zoneFeeValidate: NumberFieldSingleValidation = (value, { data }) => {
  const zone = qbasZone(value)
  if (!zone) return 'Choose a zone from the list.'

  const cityKey = (data as { key?: unknown })?.key
  if (typeof cityKey === 'string' && cityKey && cityKeyForZone(zone) !== cityKey)
    return 'This zone belongs to another city — add it there.'

  const rows = ((data as { zoneFees?: Array<{ zone?: unknown }> })?.zoneFees ?? []).filter(
    (row) => Number(row?.zone) === zone.id,
  )
  if (rows.length > 1) return 'This zone is already in the list — change its price there.'

  return true
}

/**
 * Qatar delivery is priced by city, with a price of its own for any zone she
 * lists under the city (QBAS charges more for far places such as Shagra).
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
      /**
       * A zone that costs more (or less) than the rest of its city — Shagra in
       * Al Wakrah, say. Every zone not listed pays the city's fee. The zone
       * decides the city on the server (`cityKeyForZone`), so a customer
       * cannot reach this price by choosing another city.
       */
      name: 'zoneFees',
      type: 'array',
      admin: {
        components: { RowLabel: '@/components/admin/CityZoneRowLabel#CityZoneRowLabel' },
        description:
          'Only for zones that should cost something different from the fee above — every other zone in this city pays that fee. Add or remove one at any time.',
        initCollapsed: false,
      },
      label: 'Zones with a different price',
      labels: { plural: 'Zones with a different price', singular: 'Zone with a different price' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'zone',
              type: 'number',
              admin: {
                components: { Field: '@/components/admin/CityZoneField#CityZoneField' },
                width: '60%',
              },
              label: 'Zone',
              required: true,
              validate: zoneFeeValidate,
            },
            {
              name: 'feeQar',
              type: 'number',
              admin: { description: 'In riyals: type 50 for QAR 50.', width: '40%' },
              label: 'Delivery fee (QAR)',
              min: 0,
              required: true,
            },
          ],
        },
      ],
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
