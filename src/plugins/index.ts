import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'

import { QAR } from '@/currencies'
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
      admin: {
        defaultColumns: ['id', 'form', 'createdAt'],
        group: 'Content',
        useAsTitle: 'id',
      },
      defaultSort: '-createdAt',
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
          defaultColumns: ['id', 'customerEmail', 'status', 'amount', 'fulfilment', 'createdAt'],
          group: 'Shop',
          listSearchableFields: ['customerEmail'],
          /** Rows were titled by createdAt, so every order looked the same. */
          useAsTitle: 'customerEmail',
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
            admin: { position: 'sidebar' },
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
        }),
        variantTypesCollectionOverride: ({ defaultCollection }) => ({
          ...defaultCollection,
          admin: {
            ...defaultCollection?.admin,
            defaultColumns: ['label', 'name', 'updatedAt'],
            group: 'Shop settings',
            /** Set once (Size, Colour, Pattern). Adding one needs code too. */
            hidden: true,
          },
        }),
        variantOptionsCollectionOverride: ({ defaultCollection }) => ({
          ...defaultCollection,
          admin: {
            ...defaultCollection?.admin,
            defaultColumns: ['label', 'variantType', 'value'],
            description: 'The individual sizes and colours a product can come in.',
            group: 'Shop settings',
          },
          labels: { singular: 'Size or colour', plural: 'Sizes & colours' },
        }),
      },
    },
    transactions: {
      transactionsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        admin: {
          ...defaultCollection?.admin,
          defaultColumns: ['id', 'customerEmail', 'status', 'amount', 'order', 'createdAt'],
          group: 'Shop',
          /**
           * Hidden: one row per payment attempt, including failures. The
           * order record is what she works from. Kept for audit and
           * reachable by URL when a payment needs investigating.
           */
          hidden: true,
          listSearchableFields: ['customerEmail'],
          useAsTitle: 'customerEmail',
        },
      }),
    },
    carts: {
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
           * exists this is just noise to the client. Still reachable by URL.
           */
          defaultColumns: ['id', 'customer', 'status', 'subtotal', 'updatedAt'],
          group: 'Shop',
          hidden: true,
        },
      }),
    },
    addresses: {
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
