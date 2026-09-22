import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * One row per spin of the reward wheel (C7) — the issued-codes and redemption
 * report in A8, and the mechanism that enforces one spin per visitor.
 *
 * `ipHash` is a salted hash, never a raw address: this exists to stop somebody
 * spinning fifty times, not to build a record of who visited. N6 asks for rate
 * limiting on the spin endpoint and this is what it counts.
 */
export const SpinEntries: CollectionConfig = {
  slug: 'spinEntries',
  access: {
    /** Written only by the spin endpoint, which picks the segment server-side. */
    create: () => false,
    delete: () => false,
    read: adminOnly,
    update: () => false,
  },
  admin: {
    defaultColumns: ['email', 'segment', 'issuedCode', 'createdAt'],
    description: 'Every spin of the reward wheel, and the code it issued.',
    group: 'Shop',
    hidden: true,
    useAsTitle: 'email',
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'email', type: 'email', index: true, required: true },
    { name: 'segment', type: 'relationship', relationTo: 'spinSegments', required: true },
    {
      name: 'issuedCode',
      type: 'relationship',
      admin: { description: 'Empty for a "roll again" segment, which issues nothing.' },
      relationTo: 'discountCodes',
    },
    {
      name: 'ipHash',
      type: 'text',
      admin: {
        description: 'Salted hash of the visitor IP. Never the address itself.',
      },
      index: true,
    },
  ],
  labels: { plural: 'Wheel spins', singular: 'Wheel spin' },
}
