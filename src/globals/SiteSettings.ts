import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { refreshStorefront } from '@/hooks/revalidateStorefront'
import { syncReturnDays } from '@/hooks/syncReturnDays'

/**
 * The storefront reads these through `getCachedGlobal('siteSettings')`, which
 * is cached under this tag. Without clearing it, a new announcement or
 * WhatsApp number would not appear until the next deploy. `expire: 0` because
 * she expects to see her change on the next page load, not eventually.
 */
const revalidateSiteSettings: GlobalAfterChangeHook = ({ doc, req }) => {
  // At once, and again once the save has committed — see refreshStorefront.
  refreshStorefront(req, { tags: ['global_siteSettings'] })
  return doc
}

/**
 * Everything the client needs to change without a developer: contact
 * details, the announcement, delivery, stock emails, currencies, the reward
 * wheel and embroidery. Labels and descriptions are in her words (video 07).
 */
export const SiteSettings: GlobalConfig = {
  slug: 'siteSettings',
  label: 'Site settings',
  admin: { group: 'Settings' },
  access: {
    read: () => true,
    update: adminOnly,
  },
  hooks: { afterChange: [syncReturnDays, revalidateSiteSettings] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          /**
           * The shop's open sign. Unticked, checkout shows "Orders open soon"
           * in place of Pay and the server refuses to start a payment
           * (src/payments/skipcash/adapter.ts) — browsing and the bag still
           * work. For the weeks the site is public on SkipCash's test system.
           */
          fields: [
            {
              name: 'ordersOpen',
              type: 'checkbox',
              admin: {
                description:
                  'Untick to pause orders: customers can still browse and fill their bag, but checkout says orders open soon and no payment can start. Tick it again to take orders.',
              },
              defaultValue: true,
              label: 'Take orders',
            },
          ],
          label: 'Orders',
        },
        {
          fields: [
            {
              name: 'contactEmail',
              type: 'email',
              admin: {
                description:
                  'Shown in the footer, on the Contact page and at the foot of every email. Customers’ replies to order emails arrive here.',
              },
              defaultValue: 'info@plumpose.com',
              label: 'Contact email',
            },
            {
              name: 'orderAlertEmail',
              type: 'email',
              admin: {
                description:
                  'Every new order, and every message from the Contact page, is emailed here. Leave empty to use the contact email.',
              },
              label: 'New-order alerts go to',
            },
            {
              name: 'whatsappNumber',
              type: 'text',
              admin: {
                description:
                  'A WhatsApp link in the footer and on the Contact page. Type it with the country code, e.g. +974 1234 5678. Leave empty to hide it.',
              },
              label: 'WhatsApp number',
            },
            {
              name: 'instagramHandle',
              type: 'text',
              admin: { description: 'Shown beside the Instagram links, e.g. @plumpose.' },
              defaultValue: '@plumpose',
              label: 'Instagram name',
            },
            {
              name: 'instagramUrl',
              type: 'text',
              admin: {
                description: 'Where the Instagram links go. Leave empty to use the name above.',
              },
              label: 'Instagram link',
            },
          ],
          label: 'Contact',
        },
        {
          fields: [
            {
              name: 'announcementEnabled',
              type: 'checkbox',
              admin: { description: 'The dark line above the menu, on every page. Untick to hide it.' },
              defaultValue: true,
              label: 'Show the announcement',
            },
            {
              name: 'announcementText',
              type: 'text',
              admin: {
                description:
                  'Separate phrases with a bar ( | ) or a dot ( · ) — the site shows a dot. On a phone they take turns, one at a time. It shows in capitals, however you type it.',
              },
              label: 'Announcement',
            },
          ],
          label: 'Announcement',
        },
        {
          fields: [
            {
              name: 'freeShippingEnabled',
              type: 'checkbox',
              admin: {
                description:
                  'Delivery becomes free, to anywhere, when the pieces and embroidery in a bag come to the amount below or more.',
              },
              defaultValue: false,
              label: 'Offer free delivery above a spend',
            },
            {
              name: 'freeShippingThresholdQar',
              type: 'number',
              admin: {
                condition: (_, siblingData) => siblingData?.freeShippingEnabled === true,
                description: 'In riyals: type 2000 for QAR 2,000. Shown on the Shipping page and every piece.',
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
            {
              name: 'returnWindowDays',
              type: 'number',
              admin: {
                description:
                  'How many days after receiving an order a customer has to ask for a return or exchange. Shown on Shipping & returns and told to Google; when you save, any FAQ that said "within" the old number of days says the new one.',
              },
              defaultValue: 14,
              label: 'Days to ask for a return',
              max: 365,
              min: 1,
              required: true,
            },
          ],
          label: 'Returns',
        },
        {
          /**
           * Emails about stock, sent when a sale changes it (src/email/stockAlert.ts).
           * Everything here is hers to change; an empty field falls back to the
           * sensible default rather than switching anything off.
           */
          fields: [
            {
              name: 'stockAlertsEnabled',
              type: 'checkbox',
              admin: {
                description:
                  'Untick to stop all stock emails. The dashboard still shows low stock.',
              },
              defaultValue: true,
              label: 'Email me about stock',
            },
            {
              name: 'stockAlertEmail',
              type: 'email',
              admin: {
                condition: (data) => data?.stockAlertsEnabled !== false,
                description:
                  'Leave empty to use “New-order alerts go to”, or else the contact email.',
              },
              label: 'Stock emails go to',
            },
            {
              name: 'lowStockThreshold',
              type: 'number',
              admin: {
                description:
                  'A size counts as running low at this many pieces or fewer. Also used on the dashboard.',
              },
              defaultValue: 2,
              label: 'Running low at',
              min: 0,
            },
            {
              type: 'row',
              admin: { condition: (data) => data?.stockAlertsEnabled !== false },
              fields: [
                {
                  name: 'alertLowStock',
                  type: 'checkbox',
                  defaultValue: true,
                  label: 'When a size runs low',
                },
                {
                  name: 'alertSoldOut',
                  type: 'checkbox',
                  defaultValue: true,
                  label: 'When a size sells out',
                },
                {
                  name: 'alertBeyondStock',
                  type: 'checkbox',
                  admin: { description: 'Made to order, or oversold when made to order is off.' },
                  defaultValue: true,
                  label: 'When an order goes beyond stock',
                },
              ],
            },
          ],
          label: 'Stock alerts',
        },
        {
          /**
           * Display currencies (src/lib/pricing/currency.ts). The prices
           * themselves are set per currency under Shop settings → Currencies.
           */
          fields: [
            {
              name: 'currencyDisplayEnabled',
              type: 'checkbox',
              admin: {
                description:
                  'Visitors can see prices in their own currency. Every order is still charged in QAR, and the site says so beside every price.',
              },
              defaultValue: true,
              label: 'Show prices in the visitor’s currency',
            },
            {
              name: 'currencyDetectLocation',
              type: 'checkbox',
              admin: {
                condition: (data) => data?.currencyDisplayEnabled !== false,
                description:
                  'Start a first-time visitor in the currency of the country they are browsing from. They can always change it.',
              },
              defaultValue: true,
              label: 'Choose the currency from where they are',
            },
            {
              name: 'currencyAnchorQar',
              type: 'number',
              admin: {
                condition: (data) => data?.currencyDisplayEnabled !== false,
                description:
                  'Leave this as it is unless your developer asks. The QAR price your hand-set prices under Currencies are for — Al Shaheen Nights, QAR 1,399. A piece at this price shows exactly your figure; other amounts convert at the rate it implies.',
              },
              defaultValue: 1399,
              label: 'Hand-set prices are for a piece at (QAR)',
              min: 1,
            },
          ],
          label: 'Currencies',
        },
        {
          fields: [
            {
              name: 'spinWheelEnabled',
              type: 'checkbox',
              admin: {
                description:
                  'Untick to take the wheel off the site. Codes already issued keep working.',
              },
              defaultValue: true,
              label: 'Show the wheel to first-time visitors',
            },
            {
              name: 'spinWheelHeading',
              type: 'text',
              defaultValue: 'Before anyone else.',
              label: 'Heading',
            },
            { name: 'spinWheelBody', type: 'textarea', label: 'Words under the heading' },
            {
              name: 'spinWheelMaxRerolls',
              type: 'number',
              admin: {
                description:
                  'How many extra spins "Roll again" can give one person. After that it cannot be landed on.',
              },
              defaultValue: 1,
              label: 'Extra spins from "Roll again"',
              max: 5,
              min: 0,
            },
            {
              name: 'spinWheelNewCustomersOnly',
              type: 'checkbox',
              admin: { description: 'Ticked: an email that has already ordered cannot spin.' },
              defaultValue: false,
              label: 'Only for people who have not ordered yet',
            },
            {
              name: 'spinWheelDailyLimit',
              type: 'number',
              admin: {
                description:
                  'Most spins one device may make in a day, across every email typed — stops one person collecting codes. A household sharing Wi-Fi counts as one device.',
              },
              defaultValue: 5,
              label: 'Spins per device per day',
              min: 1,
            },
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
              admin: { description: 'In riyals: type 160 for QAR 160. Charged per placement, per garment.' },
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
              admin: { description: 'Most placements allowed on a single piece.' },
              defaultValue: 2,
              label: 'Maximum placements',
              min: 1,
              required: true,
            },
            {
              name: 'personalisationLeadTime',
              type: 'text',
              admin: {
                description:
                  'How long embroidery takes, e.g. "4–10 working days". Shown with the embroidery choices, on Our Story, and on the customer’s order page and email.',
              },
              defaultValue: '4–10 working days',
              label: 'Lead time',
            },
            {
              name: 'personalisationReturnable',
              type: 'checkbox',
              admin: {
                description:
                  'Unticked, the piece’s page and Shipping & Returns say embroidered pieces cannot be returned — your current policy. Tick only if that changes.',
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
