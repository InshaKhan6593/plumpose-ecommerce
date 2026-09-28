import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Field, FieldHook, Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'

import { QAR } from '@/currencies'
import { COUNTRY_OPTIONS } from '@/data/countryOptions'
import { createSkipcashAdapter } from '@/payments/skipcash/adapter'
import { isSkipcashEnabled, missingSkipcashConfig } from '@/payments/skipcash/api'

import { Page, Product } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { ProductsCollection } from '@/collections/Products'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isAdminOrStaff, neverEditable } from '@/access/isAdminOrStaff'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import { checkRole } from '@/access/utilities'
import { sendEnquiryAlert } from '@/email/enquiryAlert'
import { resendConfirmationEndpoint, sendOrderEmails } from '@/email/orderHooks'
import { stockAfterSale } from '@/hooks/stockAfterSale'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import { validateEnquiry } from '@/hooks/validateEnquiry'
import { plumposeCartItemMatcher } from '@/lib/cart/itemMatcher'
import { DECLINE_EVENTS, declineReason, paymentOutcome } from '@/lib/payments/outcome'
import { enquirySummary } from '@/lib/enquiries/summary'
import { orderTotalsFields } from '@/fields/orderTotals'
import { orderReferenceField } from '@/hooks/orderReference'
import { lockFields } from '@/fields/lockFields'
import { mapFieldsDeep } from '@/fields/mapFieldsDeep'
import { extendArrayField, personalisationField } from '@/fields/personalisationLines'

/** The order status in her words: a paid order read "Processing". Values unchanged. */
const ORDER_STATUS_LABELS: Record<string, string> = {
  cancelled: 'Cancelled',
  completed: 'Completed',
  processing: 'Paid',
  refunded: 'Refunded',
}

/**
 * The order screen in her words. Each line is headed by what to make ("Al
 * Shaheen Nights — Silk Pyjama Set — M × 1 · Embroidery: Pocket, S.H, Gold")
 * and starts open, instead of a closed "Item 01"; the status reads Paid.
 */
/**
 * The order's own fields (breakdown, notes, gift) in its first tab. Below the
 * plugin's tabs they showed under every tab, so on Shipping the money and the
 * gift note read as part of the address. Unnamed tabs are layout only: the
 * stored data does not move. Sidebar fields stay where they are.
 */
const mainFieldsIntoFirstTab = (fields: Field[]): Field[] => {
  const tabsAt = fields.findIndex((field) => field.type === 'tabs')
  if (tabsAt < 0) return fields
  const tabs = fields[tabsAt] as Extract<Field, { type: 'tabs' }>
  const isMain = (field: Field) =>
    !('admin' in field && field.admin && 'position' in field.admin && field.admin.position === 'sidebar')
  const after = fields.slice(tabsAt + 1)
  const moved = after.filter(isMain)
  const [first, ...rest] = tabs.tabs
  return [
    ...fields.slice(0, tabsAt),
    { ...tabs, tabs: [{ ...first, fields: [...first.fields, ...moved] }, ...rest] },
    ...after.filter((field) => !isMain(field)),
  ]
}

const tidyOrderFields = (fields: Field[]): Field[] =>
  fields.map((field) => {
    if (field.type === 'tabs') {
      return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: tidyOrderFields(tab.fields) })) }
    }
    if (!('name' in field) && 'fields' in field && Array.isArray(field.fields)) {
      return { ...field, fields: tidyOrderFields(field.fields) } as Field
    }
    if (field.type === 'array' && field.name === 'items') {
      return {
        ...field,
        // The line's own fields: "Variant" is plugin vocabulary.
        fields: field.fields.map((sub) =>
          'name' in sub && sub.name === 'variant'
            ? ({ ...sub, label: 'Size' } as Field)
            : 'name' in sub && sub.name === 'product'
              ? ({ ...sub, label: 'Piece' } as Field)
              : sub,
        ),
        admin: {
          ...field.admin,
          components: { ...field.admin?.components, RowLabel: '@/components/admin/OrderItemLabel#OrderItemLabel' },
          initCollapsed: false,
        },
      }
    }
    // The payment record SkipCash's reply is kept in; empty on an order made any other way.
    if (field.type === 'relationship' && field.name === 'transactions') {
      return {
        ...field,
        admin: {
          ...field.admin,
          condition: (data: Record<string, unknown>) =>
            Array.isArray(data?.transactions) && data.transactions.length > 0,
        },
        label: 'Payment',
      } as Field
    }
    // Set at checkout (empty for a guest); a picker with "Add new User" invited a change.
    if (field.type === 'relationship' && field.name === 'customer') {
      return {
        ...field,
        admin: {
          ...field.admin,
          description: 'Their account, if they were signed in. Empty for a guest checkout.',
          readOnly: true,
        },
        label: 'Customer account',
      } as Field
    }
    if (field.type === 'select' && field.name === 'status') {
      return {
        ...field,
        options: field.options.map((option) =>
          typeof option === 'object' && ORDER_STATUS_LABELS[option.value]
            ? { ...option, label: ORDER_STATUS_LABELS[option.value] }
            : option,
        ),
      }
    }
    return field
  })

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
    !('name' in field) || field.type === 'ui'
      ? field
      : ({
          ...field,
          admin: { ...('admin' in field ? field.admin : {}), readOnly: true },
        } as Field),
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
        where: {
          and: [{ cart: { equals: cartId } }, { createdAt: { greater_than: data.createdAt } }],
        },
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
            { event: { in: DECLINE_EVENTS } },
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

/** Chosen but not configured is a silent "payments are not switched on" at checkout — say why here. */
if (process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === 'skipcash' && !isSkipcashEnabled()) {
  console.warn(
    `SkipCash is chosen but not configured. Missing: ${missingSkipcashConfig().join(', ')}.`,
  )
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
        description:
          'Messages from the Contact page. Opening a new one marks it read; set Replied or Archived as you go.',
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
        {
          name: 'markRead',
          type: 'ui',
          admin: { components: { Field: '@/components/admin/MarkEnquiryRead#MarkEnquiryRead' } },
        },
        ...(['from', 'about', 'preview'] as const).map((name): Field => ({
          name,
          type: 'text',
          admin: { readOnly: true },
          hooks: {
            afterRead: [({ siblingData }) => enquirySummary(siblingData?.submissionData)[name]],
          },
          label: { about: 'About', from: 'From', preview: 'Message' }[name],
          virtual: true,
        })),
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
          /**
           * Orders are made only by a paid checkout (the plugin's confirmOrder,
           * through the local API). By hand — the admin's Create New, or
           * Duplicate — an order emails the customer a confirmation for
           * something she never bought and counts in the list and exports.
           */
          create: () => false,
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
              {
                clientProps: { kind: 'orders', label: 'Download as a spreadsheet' },
                path: '@/components/admin/ExportButton#ExportButton',
              },
            ],
          },
          // The first column is the link: the customer's email, not the bare "ID: 1" chip.
          defaultColumns: ['customerEmail', 'reference', 'status', 'amount', 'fulfilment', 'createdAt'],
          // The plugin's text ("Orders represent a customer's intent to purchase…") was written for developers.
          description:
            'Every paid order. Open one to see what to make and where it goes, then move Fulfilment along as you go.',
          group: 'Shop',
          listSearchableFields: ['customerEmail', 'reference'],
          /** Rows were titled by createdAt, so every order looked the same. */
          useAsTitle: 'customerEmail',
        },
        /**
         * Ticking orders in the list offered Edit for all of them at once: one
         * tracking number or email on several orders, or several Shipped
         * emails in one go. Each order is moved along on its own.
         */
        disableBulkEdit: true,
        disableDuplicate: true,
        endpoints: [...(defaultCollection.endpoints || []), resendConfirmationEndpoint],
        hooks: {
          ...defaultCollection.hooks,
          afterChange: [...(defaultCollection.hooks?.afterChange ?? []), sendOrderEmails],
        },
        fields: mainFieldsIntoFirstTab([
          /**
           * Money, payment state and what was bought are locked at field
           * level. See @/access/isAdminOrStaff — the gateway is the source of
           * truth and a hand-edited total or line breaks reconciliation
           * against SkipCash.
           *
           * `extendArrayField` hangs personalisation off each order line. The
           * plugin nests `items` inside a tabs field and `amount` / `currency`
           * in an unnamed row, so both helpers walk the tree.
           */
          ...(tidyOrderFields(
            lockFields(
              extendArrayField(defaultCollection.fields, 'items', [personalisationField]),
              ['amount', 'currency', 'items', 'status', 'transactions'],
            ),
          ) as typeof defaultCollection.fields),
          ...orderTotalsFields,
          orderReferenceField,
          {
            name: 'accessToken',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              // The order's private link key: nothing for her to read or change.
              hidden: true,
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
              // Its × emptied the stage altogether; an order is always at one of the four.
              isClearable: false,
              position: 'sidebar',
            },
            defaultValue: 'unfulfilled',
            /**
             * Shipped emails the customer their tracking number, so it has to
             * be there first. Only on the change to Shipped: an order shipped
             * before this rule, without one, can still be edited.
             */
            validate: (
              value: null | string | undefined,
              { previousValue, siblingData }: { previousValue?: string; siblingData: Record<string, unknown> },
            ) =>
              value !== 'shipped' ||
              previousValue === 'shipped' ||
              Boolean(String(siblingData?.trackingNumber ?? '').trim()) ||
              // Short: the admin shows it in a one-line label over the field, and cut the long one off.
              'Add the tracking number first.',
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
          ).map(([name, label]): Field => ({
            name,
            type: 'date',
            access: { update: neverEditable },
            admin: {
              // Only once it has been sent: an empty date box looked like something to fill in.
              condition: (data) => Boolean(data?.[name]),
              date: { displayFormat: 'd MMM yyyy, HH:mm', pickerAppearance: 'dayAndTime' },
              position: 'sidebar',
              readOnly: true,
            },
            label,
          })),
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
        ]),
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
       * SkipCash, the Qatari gateway — see @/payments/skipcash/adapter.
       * Switched on by PAYMENT_PROVIDER=skipcash with all four keys set;
       * SKIPCASH_ENV chooses sandbox or production. With neither, the store
       * has no way to take payment, which is the safe default: checkout says
       * payments are not switched on.
       */
      paymentMethods: isSkipcashEnabled() ? [createSkipcashAdapter()] : [],
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
          access: {
            ...defaultCollection.access,
            /**
             * A size is shown when its piece is. The plugin's rule read the
             * size's own draft status, which is gone (below).
             */
            read: ({ req }) =>
              (req.user && checkRole(['admin', 'staff'], req.user)) || {
                'product._status': { equals: 'published' },
              },
          },
          admin: {
            ...defaultCollection?.admin,
            components: {
              ...defaultCollection?.admin?.components,
              edit: {
                ...defaultCollection?.admin?.components?.edit,
                // Closes the size's window after Save when opened from its piece.
                SaveButton: '@/components/admin/SizeSaveButton#SizeSaveButton',
              },
            },
            defaultColumns: ['title', 'product', 'inventory', 'priceInQAR'],
            // The plugin's text was written for developers (and misspelt).
            description:
              'Each size of a piece, with its own stock. Changes are live as soon as you save.',
            group: 'Shop',
            listSearchableFields: ['title'],
          },
          fields: mapFieldsDeep(defaultCollection.fields, (field) => {
            if (!('name' in field)) return field
            // Filled in by the plugin ("Piece — S") and used as the list title; not hers to type.
            if (field.name === 'title') {
              return { ...field, admin: { ...field.admin, condition: () => false } } as typeof field
            }
            // "Variant options" is the plugin's label; it heads a column on every piece's sizes list.
            if (field.name === 'options') {
              return { ...field, label: 'Size, colour or pattern' } as typeof field
            }
            if (field.name === 'priceInQAREnabled') {
              return {
                ...field,
                admin: {
                  ...field.admin,
                  description:
                    'Only if this size costs more or less than the piece. Left unticked, it is charged at the piece’s price.',
                },
                label: 'This size has its own price',
              } as typeof field
            }
            if (field.name === 'priceInQAR') {
              return { ...field, label: 'Price for this size (QAR)' } as typeof field
            }
            // Was "Inventory", as on the piece (Products relabels it there too).
            if (field.name === 'inventory') {
              return {
                ...field,
                admin: { ...field.admin, description: 'How many of this size you have ready to send.' },
                label: 'Stock',
              } as typeof field
            }
            return field
          }),
          /**
           * No drafts for a size. With them every stock change needed its own
           * Publish, and a size left in draft quietly did not count. Saving
           * the size makes it live; the piece's own Publish decides whether
           * any of it is on the shop.
           */
          versions: false,
          // A size's price is on the prerendered homepage; see @/hooks/revalidateStorefront.
          hooks: withStorefrontRefresh(defaultCollection.hooks),
          // Her words, not the plugin's: the stock alert emails point her here by this name.
          labels: { plural: 'Sizes & stock', singular: 'Size' },
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
          // In the order they were added — S, M, L — not newest first (L, M, S).
          defaultSort: 'createdAt',
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
            admin: {
              description:
                'Worked out from the payment status and the card declines the gateway reported.',
              readOnly: true,
            },
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
