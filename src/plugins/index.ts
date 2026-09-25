import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Field, FieldHook, Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'

import { QAR } from '@/currencies'
import { COUNTRY_OPTIONS } from '@/data/countryOptions'
import { createStripeSandboxAdapter, isStripeSandboxEnabled } from '@/payments/stripeSandbox'

import { Page, Product } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { ProductsCollection } from '@/collections/Products'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isAdminOrStaff, neverEditable } from '@/access/isAdminOrStaff'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import { sendEnquiryAlert } from '@/email/enquiryAlert'
import { resendConfirmationEndpoint, sendOrderEmails } from '@/email/orderHooks'
import { stockAfterSale } from '@/hooks/stockAfterSale'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import { validateEnquiry } from '@/hooks/validateEnquiry'
import { plumposeCartItemMatcher } from '@/lib/cart/itemMatcher'
import { declineReason, paymentOutcome } from '@/lib/payments/outcome'
import { enquirySummary } from '@/lib/enquiries/summary'
import { orderTotalsFields } from '@/fields/orderTotals'
import { extendArrayField, personalisationField } from '@/fields/personalisationLines'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  return doc?.title
    ? `${doc.title} | plumpose`
    : 'plumpose — silk nightwear, hand-finished to order'
}

const generateURL: GenerateURL<Product | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

/**
 * Makes a server-written collection's fields read-only in the admin, keeping
 * their data and access as they are.
 */
const readOnlyFields = (fields: Field[]): Field[] =>
  fields.map((field) =>
    !('name' in field) || field.type === 'ui' ? field : ({ ...field, admin: { ...('admin' in field ? field.admin : {}), readOnly: true } } as Field),
  )

/** "What happened" on a payment: its status, plus any card declines logged during that checkout. */
const paymentOutcomeField: FieldHook = async ({ data, req }) => {
  if (!data?.createdAt) return null
  const cartId = typeof data.cart === 'object' ? data.cart?.id : data.cart
  let declines: string[] = []
  if (cartId && data.status !== 'succeeded') {
    /*
     * A decline belongs to this checkout if it came after it began and before
     * the same bag's next checkout — a customer who tries again gets a new
     * payment record, and the earlier declines stay with the earlier one.
     */
    const next = await req.payload
      .find({
        collection: 'transactions',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req,
        select: { createdAt: true },
        sort: 'createdAt',
        where: { and: [{ cart: { equals: cartId } }, { createdAt: { greater_than: data.createdAt } }] },
      })
      .catch(() => null)
    const until = next?.docs[0]?.createdAt
    const logged = await req.payload
      .find({
        collection: 'webhookLog',
        depth: 0,
        limit: 20,
        overrideAccess: true,
        req,
        sort: '-createdAt',
        where: {
          and: [
            { event: { equals: 'payment_intent.payment_failed' } },
            { orderRef: { equals: String(cartId) } },
            { createdAt: { greater_than_equal: data.createdAt } },
            ...(until ? [{ createdAt: { less_than: until } }] : []),
          ],
        },
      })
      .catch(() => null)
    declines = (logged?.docs ?? []).map((d) => declineReason(d.payload))
  }
  const orderId = typeof data.order === 'object' ? data.order?.id : data.order
  return paymentOutcome({ createdAt: data.createdAt, declines, orderId, status: data.status }).label
}

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      /*
       * An inbox (REQUIREMENTS A16): who, about what, the start of the message,
       * and a status she moves along — New → Read (on opening) → Replied → Archived.
       */
      admin: {
        defaultColumns: ['status', 'from', 'about', 'preview', 'createdAt'],
        description: 'Messages from the Contact page. Opening a new one marks it read; set Replied or Archived as you go.',
        group: 'Content',
        // Computed fields cannot be the title; the From column carries who it is from.
        useAsTitle: 'id',
      },
      defaultSort: '-createdAt',
      fields: ({ defaultFields }) => [
        ...defaultFields,
        {
          name: 'status',
          type: 'select',
          // A stranger's submission can never arrive "archived": no create access, so the default applies.
          access: { create: ({ req }) => Boolean(req.user && isAdmin({ req } as never)) },
          admin: { position: 'sidebar' },
          defaultValue: 'new',
          index: true,
          options: [
            { label: 'New', value: 'new' },
            { label: 'Read', value: 'read' },
            { label: 'Replied', value: 'replied' },
            { label: 'Archived', value: 'archived' },
          ],
        },
        { name: 'markRead', type: 'ui', admin: { components: { Field: '@/components/admin/MarkEnquiryRead#MarkEnquiryRead' } } },
        ...(['from', 'about', 'preview'] as const).map(
          (name): Field => ({
            name,
            type: 'text',
            admin: { readOnly: true },
            hooks: { afterRead: [({ siblingData }) => enquirySummary(siblingData?.submissionData)[name]] },
            label: { about: 'About', from: 'From', preview: 'Message' }[name],
            virtual: true,
          }),
        ),
      ],
      /*
       * The plugin checks nothing about what is submitted and emails values
       * unescaped: validate on the server, and send our own escaped alert.
       */
      hooks: {
        afterChange: [sendEnquiryAlert],
        beforeValidate: [validateEnquiry],
      },
      labels: { singular: 'Enquiry', plural: 'Enquiries' },
    },
    formOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
        create: isAdmin,
      },
      admin: {
        defaultColumns: ['title', 'updatedAt'],
        group: 'Content',
        /** Built once by a developer; she reads the Enquiries they produce. */
        hidden: true,
        useAsTitle: 'title',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    customers: {
      slug: 'users',
    },
    orders: {
      ordersCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        access: {
          ...defaultCollection.access,
          /** Orders are archived, never deleted — they are financial records. */
          delete: () => false,
          /** Staff may work through orders; only admins see everything else. */
          update: isAdminOrStaff,
        },
        admin: {
          ...defaultCollection?.admin,
          components: {
            ...defaultCollection?.admin?.components,
            // A spreadsheet of the orders the list shows (REQUIREMENTS A6); see @/endpoints/exports.
            beforeListTable: [
              { clientProps: { kind: 'orders', label: 'Download as a spreadsheet' }, path: '@/components/admin/ExportButton#ExportButton' },
            ],
          },
          defaultColumns: ['id', 'customerEmail', 'status', 'amount', 'fulfilment', 'createdAt'],
          group: 'Shop',
          listSearchableFields: ['customerEmail'],
          /** Rows were titled by createdAt, so every order looked the same. */
          useAsTitle: 'customerEmail',
        },
        endpoints: [...(defaultCollection.endpoints || []), resendConfirmationEndpoint],
        hooks: {
          ...defaultCollection.hooks,
          afterChange: [...(defaultCollection.hooks?.afterChange ?? []), sendOrderEmails],
        },
        fields: [
          /**
           * Money and payment state are locked at field level. See
           * @/access/isAdminOrStaff — the gateway is the source of truth and a
           * hand-edited total breaks reconciliation against SkipCash.
           *
           * `extendArrayField` hangs personalisation off each order line. The
           * plugin nests `items` inside a tabs field here, so it has to be
           * walked for rather than mapped over.
           */
          ...(extendArrayField(defaultCollection.fields, 'items', [personalisationField]).map(
            (field) => {
              if (
                'name' in field &&
                ['amount', 'currency', 'status', 'transactions'].includes(field.name as string)
              ) {
                return {
                  ...field,
                  access: { ...('access' in field ? field.access : {}), update: neverEditable },
                  admin: { ...('admin' in field ? field.admin : {}), readOnly: true },
                }
              }
              return field
            },
          ) as typeof defaultCollection.fields),
          ...orderTotalsFields,
          {
            name: 'accessToken',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            hooks: {
              beforeValidate: [
                ({ value, operation }) => {
                  if (operation === 'create' || !value) {
                    return crypto.randomUUID()
                  }
                  return value
                },
              ],
            },
          },
          /* ---- what the client and her staff CAN change ---- */
          {
            name: 'fulfilment',
            type: 'select',
            admin: {
              description:
                'Setting this to Shipped emails the customer — add the tracking number first.',
              position: 'sidebar',
            },
            defaultValue: 'unfulfilled',
            options: [
              { label: 'Awaiting fulfilment', value: 'unfulfilled' },
              { label: 'In the atelier', value: 'inAtelier' },
              { label: 'Shipped', value: 'shipped' },
              { label: 'Delivered', value: 'delivered' },
            ],
          },
          {
            name: 'trackingNumber',
            type: 'text',
            admin: { position: 'sidebar' },
          },
          {
            name: 'adminNotes',
            type: 'textarea',
            admin: { description: 'Internal only. Never shown to the customer.' },
          },
          {
            name: 'gift',
            type: 'checkbox',
            admin: { description: 'Order is a gift — include a card, omit the invoice.' },
            defaultValue: false,
          },
          {
            name: 'giftNote',
            type: 'textarea',
            admin: { condition: (data) => data?.gift === true },
            maxLength: 200,
          },
          /* ---- email — written by the server, see @/email/sendOrderEmail ---- */
          {
            name: 'resendConfirmation',
            type: 'ui',
            admin: {
              components: {
                Field: '@/components/admin/ResendConfirmation#ResendConfirmation',
              },
              position: 'sidebar',
            },
          },
          ...(
            [
              ['confirmationEmailSentAt', 'Confirmation emailed'],
              ['notificationEmailSentAt', 'New-order alert sent'],
              ['shippedEmailSentAt', 'Shipped email sent'],
            ] as const
          ).map(
            ([name, label]): Field => ({
              name,
              type: 'date',
              access: { update: neverEditable },
              admin: {
                date: { displayFormat: 'd MMM yyyy, HH:mm', pickerAppearance: 'dayAndTime' },
                position: 'sidebar',
                readOnly: true,
              },
              label,
            }),
          ),
          {
            name: 'emailError',
            type: 'text',
            access: { update: neverEditable },
            admin: {
              condition: (data) => Boolean(data?.emailError),
              description: 'The last email that failed. Use "Resend confirmation" once fixed.',
              position: 'sidebar',
              readOnly: true,
            },
            label: 'Email problem',
          },
        ],
      }),
    },
    /**
     * plumpose settles in Qatari Riyal. SkipCash is a Qatari gateway and
     * charges QAR; other currencies on the storefront are display only.
     */
    currencies: {
      defaultCurrency: 'QAR',
      supportedCurrencies: [QAR],
    },
    /** Track stock per product and per variant, and decrement on a paid order. */
    inventory: true,
    payments: {
      /**
       * Stripe sandbox is a **development harness only** — see
       * @/payments/stripeSandbox for what it does and does not prove. It is
       * enabled by PAYMENT_PROVIDER=stripe and refuses to load in production.
       *
       * TODO(payments): add the SkipCash adapter once sandbox credentials
       * arrive from the client. It implements `initiatePayment` and
       * `confirmOrder`, ported from the existing Netlify Functions:
       *   netlify/functions/skipcash-create-payment.mjs  -> initiatePayment
       *   netlify/functions/skipcash-confirm.mjs         -> confirmOrder
       * It must price through `priceOrder()` exactly as the Stripe wrapper
       * does — the plugin's own adapters charge `cart.subtotal`, which omits
       * delivery, embroidery and discounts.
       */
      paymentMethods: isStripeSandboxEnabled() ? [createStripeSandboxAdapter()] : [],
    },
    /**
     * The plugin's own collections ship with generic list views. These give
     * each one the columns that are actually useful to the client, and group
     * them so the sidebar reads as Shop / Shop settings rather than one long
     * undifferentiated list.
     */
    products: {
      productsCollectionOverride: ProductsCollection,
      variants: {
        variantsCollectionOverride: ({ defaultCollection }) => ({
          ...defaultCollection,
          admin: {
            ...defaultCollection?.admin,
            defaultColumns: ['title', 'product', 'inventory', 'priceInQAR', '_status'],
            group: 'Shop',
            listSearchableFields: ['title'],
          },
          // A size's price is on the prerendered homepage; see @/hooks/revalidateStorefront.
          hooks: withStorefrontRefresh(defaultCollection.hooks),
          // Her words, not the plugin's: the stock alert emails point her here by this name.
          labels: { plural: 'Sizes & stock', singular: 'Size & stock' },
        }),
        variantTypesCollectionOverride: ({ defaultCollection }) => ({
          ...defaultCollection,
          admin: {
            ...defaultCollection?.admin,
            defaultColumns: ['label', 'name', 'updatedAt'],
            group: 'Shop settings',
            /** Set once — Size, Colour and Pattern are seeded (src/seed/index.ts). A new kind is rare. */
            hidden: true,
          },
        }),
        variantOptionsCollectionOverride: ({ defaultCollection }) => ({
          ...defaultCollection,
          admin: {
            ...defaultCollection?.admin,
            defaultColumns: ['label', 'variantType', 'value'],
            description:
              'The sizes, colours and patterns a piece can come in. To offer a colour: add it here with "Colour" as its kind, then tick Colour under "Options offered" on the piece and add a row for each size and colour it is made in. Renaming one renames it on every piece that uses it.',
            group: 'Shop settings',
          },
          hooks: withStorefrontRefresh(defaultCollection.hooks),
          labels: { singular: 'Size, colour or pattern', plural: 'Sizes, colours & patterns' },
        }),
      },
    },
    transactions: {
      transactionsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        /**
         * "Payments" (REQUIREMENTS P11): one row per checkout, made before the
         * customer is sent to the payment page — so a customer who never paid
         * is here too, with the email, the bag and the amount, and the
         * "What happened" column says so in words. Written only by the server;
         * every field is read-only here.
         */
        admin: {
          ...defaultCollection?.admin,
          defaultColumns: ['createdAt', 'customerEmail', 'amount', 'outcome', 'order'],
          description:
            'Every checkout, paid or not. "Not paid" rows are customers who reached the payment page and left — their email and bag are here if you would like to follow up.',
          group: 'Shop',
          listSearchableFields: ['customerEmail'],
          useAsTitle: 'customerEmail',
        },
        defaultSort: '-createdAt',
        fields: [
          // The plugin's amount field already has its own PriceCell.
          ...readOnlyFields(defaultCollection.fields),
          {
            name: 'outcome',
            type: 'text',
            admin: { description: 'Worked out from the payment status and the card declines the gateway reported.', readOnly: true },
            hooks: { afterRead: [paymentOutcomeField] },
            label: 'What happened',
            virtual: true,
          },
        ],
        labels: { plural: 'Payments', singular: 'Payment' },
        hooks: {
          ...defaultCollection.hooks,
          // Stock never stays below zero after a sale; see @/hooks/stockAfterSale.
          afterChange: [...(defaultCollection.hooks?.afterChange ?? []), stockAfterSale],
        },
      }),
    },
    carts: {
      /** Embroidery is part of a line's identity — see @/lib/cart/itemMatcher. */
      cartItemMatcher: plumposeCartItemMatcher,
      cartsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        /**
         * The bag has to carry personalisation or it is lost at checkout, plus
         * the two things the pricing engine needs that an address cannot
         * supply: which Qatar city was picked (the address `city` is free
         * text, the rate table is keyed) and which discount code is attached.
         */
        fields: [
          ...extendArrayField(defaultCollection.fields, 'items', [personalisationField]),
          {
            name: 'shippingCityKey',
            type: 'text',
            admin: {
              description: 'Qatar only — the delivery rate this bag was quoted against.',
              readOnly: true,
            },
          },
          {
            name: 'discountCode',
            type: 'text',
            admin: {
              description:
                'Attached at checkout. Re-validated server-side before payment; never trusted from here.',
              readOnly: true,
            },
          },
          {
            name: 'pricingSnapshot',
            type: 'json',
            admin: {
              description:
                'What the pricing engine computed when payment was initiated — the breakdown behind the amount the gateway was given. Copied onto the order at confirmation.',
              readOnly: true,
            },
          },
        ],
        admin: {
          ...defaultCollection?.admin,
          /**
           * Hidden from the nav. The useful read here is abandoned carts,
           * which needs a report rather than a raw row list — until that
           * exists this is just noise to the client. No admin screen while
           * hidden (404); the rows are kept and readable through the API.
           */
          defaultColumns: ['id', 'customer', 'status', 'subtotal', 'updatedAt'],
          group: 'Shop',
          hidden: true,
        },
      }),
    },
    addresses: {
      // The plugin's default list has 40 countries and no Qatar — the store's own table instead.
      supportedCountries: COUNTRY_OPTIONS,
      addressesCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        admin: {
          ...defaultCollection?.admin,
          defaultColumns: ['title', 'customer', 'city', 'country', 'updatedAt'],
          group: 'Shop',
          listSearchableFields: ['firstName', 'lastName', 'city'],
        },
      }),
    },
  }),
]
