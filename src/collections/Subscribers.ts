import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { publicAccess } from '@/access/publicAccess'

/**
 * "The List" — the newsletter signup on the existing site.
 * Downloadable as a spreadsheet from the button above the list
 * (REQUIREMENTS S19 / A17; @/endpoints/exports).
 */
export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  defaultSort: '-createdAt',
  admin: {
    components: {
      beforeListTable: [
        { clientProps: { kind: 'subscribers', label: 'Download as a spreadsheet' }, path: '@/components/admin/ExportButton#ExportButton' },
      ],
    },
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
