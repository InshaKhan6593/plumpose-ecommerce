import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'

import { QAR } from '@/currencies'

import { Page, Product } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { ProductsCollection } from '@/collections/Products'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isAdminOrStaff, neverEditable } from '@/access/isAdminOrStaff'
import { isDocumentOwner } from '@/access/isDocumentOwner'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | plumpose` : 'plumpose — silk nightwear, hand-finished to order'
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
        group: 'Content',
      },
    },
    formOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
        create: isAdmin,
      },
      admin: {
        group: 'Content',
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
        },
        fields: [
          /**
           * Money and payment state are locked at field level. See
           * @/access/isAdminOrStaff — the gateway is the source of truth and a
           * hand-edited total breaks reconciliation against SkipCash.
           */
          ...(defaultCollection.fields.map((field) => {
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
          }) as typeof defaultCollection.fields),
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
       * TODO(payments): add the SkipCash adapter once sandbox credentials
       * arrive from the client. It implements `initiatePayment` and
       * `confirmOrder`, ported from the existing Netlify Functions:
       *   netlify/functions/skipcash-create-payment.mjs  -> initiatePayment
       *   netlify/functions/skipcash-confirm.mjs         -> confirmOrder
       * The plugin's finalizeOrder callback handles the order/payment binding,
       * discount consumption and stock decrement atomically.
       */
      paymentMethods: [],
    },
    products: {
      productsCollectionOverride: ProductsCollection,
    },
  }),
]
