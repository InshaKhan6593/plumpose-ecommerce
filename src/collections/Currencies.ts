import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Display currencies. Ported from netlify/lib/pricing.mjs.
 *
 * IMPORTANT: these are for display only. The card is always charged in QAR,
 * because SkipCash is a Qatari gateway and settles in riyals. Every price
 * shown in another currency is a guide, and the storefront says so.
 *
 * `priceOverride` is the hand-set retail price for that market — the old site
 * called these "set by hand" rows. Where it is empty the price is derived from
 * `rate` instead.
 */
export const Currencies: CollectionConfig = {
  slug: 'currencies',
  labels: { singular: 'Currency', plural: 'Currencies' },
  admin: {
    defaultColumns: ['code', 'name', 'symbol', 'priceOverride', 'rate', 'updatedAt'],
    description:
      'Display prices only — every card is charged in QAR. Set a price by hand for the markets that matter.',
    group: 'Shop settings',
    listSearchableFields: ['code', 'name'],
    useAsTitle: 'code',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      index: true,
      maxLength: 3,
      required: true,
      unique: true,
    },
    { name: 'name', type: 'text', required: true },
    { name: 'symbol', type: 'text', required: true },
    {
      name: 'decimals',
      type: 'number',
      admin: { description: 'Decimal places shown.' },
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'step',
      type: 'number',
      admin: { description: 'Round displayed delivery to the nearest this many units.' },
      defaultValue: 1,
      min: 1,
    },
    {
      name: 'priceOverride',
      type: 'number',
      admin: {
        description:
          'Hand-set retail price in this currency. Leave empty to derive it from the rate.',
      },
      label: 'Price set by hand',
      min: 0,
    },
    {
      name: 'rate',
      type: 'number',
      admin: { description: 'Units of this currency per 1 QAR.' },
      min: 0,
    },
    {
      name: 'rateUpdatedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
