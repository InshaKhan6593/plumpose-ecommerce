import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { publicAccess } from '@/access/publicAccess'

/**
 * "The List" — the newsletter signup on the existing site.
 * Exportable to CSV from the admin via the import/export plugin.
 */
export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  defaultSort: '-createdAt',
  admin: {
    defaultColumns: ['email', 'source', 'createdAt'],
    group: 'Content',
    listSearchableFields: ['email'],
    useAsTitle: 'email',
  },
  access: {
    create: publicAccess,
    delete: adminOnly,
    // Never publicly readable — this is a list of customer email addresses.
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    { name: 'email', type: 'email', index: true, required: true, unique: true },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'footer',
      options: [
        { label: 'Footer signup', value: 'footer' },
        { label: 'Reward wheel', value: 'spinWheel' },
        { label: 'Checkout', value: 'checkout' },
        { label: 'Added by hand', value: 'manual' },
      ],
    },
    { name: 'unsubscribed', type: 'checkbox', admin: { position: 'sidebar' }, defaultValue: false },
  ],
}
