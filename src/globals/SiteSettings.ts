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
        {
          /**
           * Ported from the constants at the top of
           * netlify/lib/personalisation.mjs, where they were hardcoded.
           * The individual placements, symbols and threads live in the
           * Personalisation collection.
           */
          fields: [
            {
              name: 'personalisationFeeQar',
              type: 'number',
              admin: { description: 'Charged per placement, per garment.' },
              defaultValue: 160,
              label: 'Embroidery fee (QAR)',
              min: 0,
              required: true,
            },
            {
              name: 'personalisationMaxChars',
              type: 'number',
              admin: { description: 'Longest piece of lettering that will be embroidered.' },
              defaultValue: 6,
              label: 'Maximum characters',
              min: 1,
              required: true,
            },
            {
              name: 'personalisationMaxPlacements',
              type: 'number',
              admin: { description: 'Most placements allowed on a single set.' },
              defaultValue: 2,
              label: 'Maximum placements',
              min: 1,
              required: true,
            },
            {
              name: 'personalisationLeadTime',
              type: 'text',
              admin: { description: 'Shown beside the picker, e.g. "4–10 working days".' },
              defaultValue: '4–10 working days',
              label: 'Lead time',
            },
            {
              name: 'personalisationReturnable',
              type: 'checkbox',
              admin: {
                description:
                  'Leave unticked — personalised pieces are not eligible for return under the current policy.',
              },
              defaultValue: false,
              label: 'Personalised pieces can be returned',
            },
          ],
          label: 'Personalisation',
        },
      ],
    },
  ],
}
