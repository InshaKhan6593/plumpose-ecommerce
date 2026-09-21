import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Everything the client needs to change without a developer:
 * contact details, the WhatsApp number, socials and the free-shipping threshold.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'siteSettings',
  label: 'Site settings',
  admin: { group: 'Settings' },
  access: {
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            { name: 'contactEmail', type: 'email', defaultValue: 'info@plumpose.com' },
            {
              name: 'whatsappNumber',
              type: 'text',
              admin: {
                description:
                  'International format, e.g. +974 1234 5678. Used for click-to-chat links.',
              },
              label: 'WhatsApp number',
            },
            { name: 'instagramHandle', type: 'text', defaultValue: '@plumpose' },
            { name: 'instagramUrl', type: 'text' },
          ],
          label: 'Contact',
        },
        {
          fields: [
            { name: 'announcementEnabled', type: 'checkbox', defaultValue: true },
            { name: 'announcementText', type: 'text' },
          ],
          label: 'Announcement',
        },
        {
          fields: [
            {
              name: 'freeShippingEnabled',
              type: 'checkbox',
              defaultValue: false,
              label: 'Offer free delivery above a spend',
            },
            {
              name: 'freeShippingThresholdQar',
              type: 'number',
              admin: {
                condition: (_, siblingData) => siblingData?.freeShippingEnabled === true,
              },
              label: 'Free delivery above (QAR)',
              min: 0,
            },
            {
              name: 'intlSurchargePct',
              type: 'number',
              admin: {
                description:
                  'Added to every international zone fee. Use when carrier fuel costs rise.',
              },
              defaultValue: 0,
              label: 'International surcharge (%)',
              min: 0,
            },
          ],
          label: 'Shipping',
        },
        {
          fields: [
            { name: 'spinWheelEnabled', type: 'checkbox', defaultValue: true },
            { name: 'spinWheelHeading', type: 'text', defaultValue: 'Before anyone else.' },
            { name: 'spinWheelBody', type: 'textarea' },
          ],
          label: 'Reward wheel',
        },
      ],
    },
  ],
}
