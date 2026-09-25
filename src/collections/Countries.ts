import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Where plumpose delivers. Ported from netlify/lib/countries.mjs.
 *
 * Each country carries its own currency (so a visitor sees a price in their
 * own money) and the delivery zone its shipping is priced from.
 *
 * `blockedReason` reflects comprehensive sanctions, carrier service
 * suspensions and destinations with no workable route from Doha. The original
 * source file is explicit that this "is a sensible starting point, not legal
 * advice" — so opening a blocked country is deliberately a developer action,
 * not a checkbox the client can tick by accident.
 */
export const Countries: CollectionConfig = {
  slug: 'countries',
  defaultSort: 'name',
  labels: { singular: 'Country', plural: 'Countries' },
  admin: {
    defaultColumns: ['name', 'code', 'currencyCode', 'zoneKey', 'blockedReason'],
    description: 'Delivery destinations. A country with a blocked reason cannot be ordered to.',
    group: 'Shop settings',
    listSearchableFields: ['name', 'code'],
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
    {
      name: 'code',
      type: 'text',
      admin: { description: 'The two-letter country code, for example QA.' },
      index: true,
      maxLength: 2,
      required: true,
      unique: true,
    },
    {
      name: 'currencyCode',
      type: 'text',
      admin: { description: 'The currency prices are shown in here, for example QAR.' },
      label: 'Shown in currency',
      maxLength: 3,
      required: true,
    },
    {
      name: 'zoneKey',
      type: 'text',
      admin: {
        description:
          'Which delivery zone this country is priced from. Change this and delivery costs change.',
        readOnly: true,
      },
      index: true,
      label: 'Delivery zone',
      required: true,
    },
    {
      name: 'blockedReason',
      type: 'text',
      admin: {
        description:
          'Set this and the country cannot be ordered to. Leave empty to allow delivery.',
        readOnly: true,
      },
      label: 'Blocked — reason',
    },
  ],
}
