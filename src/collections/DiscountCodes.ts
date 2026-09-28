import type { CollectionConfig, FieldHook } from 'payload'

import { APIError } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * The admin's date picker keeps a day as 12:00 UTC — 3 pm in Qatar — so a code
 * "ending 30 Sep" stopped mid-afternoon that day. Picked in the admin, Starts
 * becomes the start of that day and Ends its last moment, Qatar time (UTC+3,
 * no daylight saving). Read by its Qatar calendar day, which the noon pick and
 * both results share, so saving again never moves it. Wheel codes, written by
 * the server with an exact expiry, are left as they are.
 */
const qatarDay =
  (edge: 'end' | 'start'): FieldHook =>
  ({ req, value }) => {
    if (!req.user || !value) return value
    const day = new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Qatar' })
    return new Date(`${day}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}+03:00`).toISOString()
  }

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
    // Source and owner show wheel codes apart from her own promotions; usage count is the redemption report.
    defaultColumns: [
      'code',
      'type',
      'value',
      'usageCount',
      'source',
      'issuedToEmail',
      'expiresAt',
      'active',
    ],
    description:
      'Codes customers type at checkout — yours, and the ones the reward wheel gives out. Untick Active to stop one.',
    group: 'Shop',
    useAsTitle: 'code',
  },
  /** A copy kept the code, which must be unique, and the original's use count. */
  disableDuplicate: true,
  /** Editing several at once could switch every code on or off in one go. */
  disableBulkEdit: true,
  hooks: {
    /**
     * A used code is part of its orders' records (discountUses points at it),
     * so the database refused to delete it with an error she could not read.
     */
    beforeDelete: [
      async ({ id, req }) => {
        const uses = await req.payload.count({
          collection: 'discountUses',
          overrideAccess: true,
          req,
          where: { code: { equals: id } },
        })
        if (uses.totalDocs > 0) {
          throw new APIError(
            'This code has been used, so it is kept with those orders. Untick Active to stop it working.',
            400,
            null,
            true,
          )
        }
      },
    ],
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
      admin: {
        description: 'What customers type at checkout, e.g. EID15. Small or capital letters both work.',
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'type',
      type: 'select',
      admin: { isClearable: false },
      defaultValue: 'percent',
      options: [
        { label: 'Percentage off', value: 'percent' },
        { label: 'Fixed amount off (QAR)', value: 'fixed' },
        { label: 'Free delivery', value: 'freeShipping' },
        { label: 'Free hand embroidery', value: 'freeEmbroidery' },
      ],
      required: true,
    },
    {
      name: 'value',
      type: 'number',
      admin: {
        condition: (data) => data?.type !== 'freeShipping',
        description:
          'Type 15 for 15% off, or 100 for QAR 100 off. Free hand embroidery: how many placements are free (e.g. 1) — empty makes all of them free.',
      },
      min: 0,
    },
    {
      name: 'minSpendQar',
      type: 'number',
      admin: {
        description: 'In riyals, on the pieces and embroidery in the bag. Empty: no minimum.',
      },
      label: 'Minimum spend (QAR)',
      min: 0,
    },
    {
      name: 'usageLimit',
      type: 'number',
      admin: { description: 'How many times it can be used in all, by everyone. Empty: no limit.' },
      label: 'Total uses allowed',
      min: 0,
    },
    {
      name: 'perCustomerLimit',
      type: 'number',
      admin: { description: 'How many times one customer (one email) may use it. Empty: no limit.' },
      defaultValue: 1,
      label: 'Uses per customer',
      min: 0,
    },
    {
      name: 'usageCount',
      type: 'number',
      admin: { description: 'Counted when an order is paid.', position: 'sidebar', readOnly: true },
      defaultValue: 0,
      label: 'Times used',
    },
    {
      name: 'startsAt',
      type: 'date',
      admin: { description: 'Works from the start of this day, Qatar time. Empty: straight away.' },
      hooks: { beforeChange: [qatarDay('start')] },
      label: 'Starts',
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: { description: 'Works until the end of this day, Qatar time. Empty: never ends.' },
      hooks: { beforeChange: [qatarDay('end')] },
      label: 'Ends',
    },
    {
      name: 'appliesTo',
      type: 'relationship',
      admin: { allowCreate: false, description: 'Only these pieces. Empty: every piece.' },
      hasMany: true,
      label: 'Only for these pieces',
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
      admin: {
        description:
          'Only this customer’s email can use it. The wheel sets it to the winner’s email. Empty: anyone.',
        position: 'sidebar',
      },
      label: 'Only for this email',
    },
    {
      name: 'active',
      type: 'checkbox',
      admin: {
        components: { Cell: '@/components/admin/BooleanCell#BooleanCell' },
        description: 'Untick to stop the code working. Customers are told it is not valid.',
        position: 'sidebar',
      },
      defaultValue: true,
    },
  ],
}
