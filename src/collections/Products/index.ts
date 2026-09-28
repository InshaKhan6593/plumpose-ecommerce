import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

import { mapFieldsDeep } from '@/fields/mapFieldsDeep'
import { webAddress } from '@/fields/webAddress'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { DefaultDocumentIDType, PayloadRequest, Where } from 'payload'
import { amountField } from '@payloadcms/plugin-ecommerce'
import { QAR } from '@/currencies'
import type { Product, VariantOption } from '@/payload-types'


export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  /** The homepage and Our Story show the product and its price, and they are prerendered. */
  hooks: withStorefrontRefresh(defaultCollection.hooks),
  /**
   * Drafts, but no autosave. With autosave, "Create new" saved an empty draft
   * the moment it opened, so each abandoned click left an untitled piece in
   * the list. She saves a draft or publishes by hand.
   */
  versions: { drafts: true },
  admin: {
    ...defaultCollection?.admin,
    /** What she needs to see at a glance: what it is, what it costs, is it live. */
    /* inventory is per-variant, so it reads 0 here — variants carry stock */
    defaultColumns: ['title', 'priceInQAR', 'colour', '_status', 'categories', 'updatedAt'],
    group: 'Shop',
    listSearchableFields: ['title', 'slug', 'colour', 'fabric'],
    pagination: { defaultLimit: 25, limits: [10, 25, 50, 100] },
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'products',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'products',
        req,
      }),
    useAsTitle: 'title',
  },
  defaultPopulate: {
    ...defaultCollection?.defaultPopulate,
    title: true,
    slug: true,
    variantOptions: true,
    variants: true,
    enableVariants: true,
    gallery: true,
    priceInQAR: true,
    inventory: true,
    meta: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              admin: {
                description:
                  'The main description shown under the product name. Two or three sentences reads best.',
              },
              label: 'Description',
              required: false,
            },
            {
              name: 'gallery',
              type: 'array',
              admin: {
                description:
                  'The photographs shown on the product page. Drag to reorder — the first one is the main image.',
              },
              label: 'Photos',
              labels: { singular: 'Photo', plural: 'Photos' },
              /**
               * `minRows` alone lets an empty gallery through (Payload checks it
               * only once there is a row), and a piece went live with no photo.
               * Drafts are not validated, so she can still save one without.
               */
              validate: (value: unknown, { data }: { data: Partial<Product> }) =>
                data?._status !== 'published' ||
                (Array.isArray(value) && value.length > 0) ||
                'Add at least one photo before publishing.',
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'variantOption',
                  type: 'relationship',
                  relationTo: 'variantOptions',
                  label: 'Only show for',
                  admin: {
                    description:
                      'Leave empty to show this photo whatever is chosen. Set it (a colour, say) to show the photo only when that is chosen.',
                    condition: (data) => {
                      return data?.enableVariants === true && data?.variantTypes?.length > 0
                    },
                  },
                  filterOptions: ({ data }) => {
                    if (data?.enableVariants && data?.variantTypes?.length) {
                      const variantTypeIDs = data.variantTypes.map((item: any) => {
                        if (typeof item === 'object' && item?.id) {
                          return item.id
                        }
                        return item
                      }) as DefaultDocumentIDType[]

                      if (variantTypeIDs.length === 0)
                        return {
                          variantType: {
                            in: [],
                          },
                        }

                      const query: Where = {
                        variantType: {
                          in: variantTypeIDs,
                        },
                      }

                      return query
                    }

                    return {
                      variantType: {
                        in: [],
                      },
                    }
                  },
                },
              ],
            },

            {
              name: 'layout',
              type: 'blocks',
              admin: {
                /*
                 * Template page-builder blocks. No piece uses them and they
                 * were one more thing to wonder about, so the field shows
                 * only on a piece that already has sections (the product page
                 * still renders them).
                 */
                condition: (data) => Boolean(data?.layout?.length),
                description:
                  'Optional extra sections shown further down the product page, such as a story about the print. Most products do not need any.',
              },
              blocks: [CallToAction, Content, MediaBlock],
              label: 'Extra page sections',
              labels: { singular: 'Section', plural: 'Sections' },
            },
          ],
          label: 'Description & photos',
        },
        {
          /**
           * The detail the existing product page carries and a bare
           * description cannot: fabric, colour, fit and the care copy.
           * All client-editable — she changes a fabric weight herself.
           */
          fields: [
            {
              name: 'fabric',
              type: 'text',
              admin: {
                description: 'Shown under the product name, e.g. "in 22-momme Silk".',
              },
              label: 'Fabric descriptor',
            },
            { name: 'colour', type: 'text', admin: { description: 'e.g. Midnight Navy' } },
            {
              name: 'composition',
              type: 'text',
              admin: { description: 'e.g. 97% silk, 3% spandex' },
            },
            {
              name: 'fabricWeight',
              type: 'text',
              admin: { description: 'e.g. 22 momme' },
            },
            { name: 'trims', type: 'text', admin: { description: 'e.g. contrast piping' } },
            {
              name: 'fitNote',
              type: 'text',
              admin: { description: 'e.g. Model is 175cm and wears a size M' },
              label: 'Fit note',
            },
            { name: 'materialCare', type: 'richText', label: 'Material & care' },
            { name: 'deliveryReturns', type: 'richText', label: 'Delivery & returns' },
            { name: 'giftPackaging', type: 'richText', label: 'Gift packaging' },
            {
              name: 'madeToOrder',
              type: 'checkbox',
              admin: {
                /** The rule itself lives in @/lib/pricing/stock; the storefront and payment both follow it. */
                description:
                  'Ticked: a size with no stock left can still be ordered — it is made to order, the customer is told it takes a little longer, and the order is noted for the atelier. Unticked: a size with no stock is sold out, and no one can buy more than you have.',
              },
              defaultValue: true,
              label: 'Made to order',
            },
            {
              name: 'personalisationEnabled',
              type: 'checkbox',
              admin: {
                description:
                  'Ticked: customers can add hand embroidery to this piece (the fees are in Personalisation). Unticked: no embroidery offered.',
              },
              defaultValue: true,
              // Was "Personalisation Enabled", made from the field's name.
              label: 'Offer hand embroidery',
            },
          ],
          label: 'Fabric & Care',
        },
        {
          fields: [
            /**
             * Money is stored in minor units, so a price column renders as
             * "139900" without a Cell. PriceCell formats it as QAR 1,399.00.
             */
            ...(mapFieldsDeep(defaultCollection.fields, (field) => {
              if (!('name' in field)) return field
              const name = String(field.name)

              /**
               * Money is stored in minor units, so a price column renders as
               * "139900" without a Cell. PriceCell formats it as QAR 1,399.00.
               */
              if (name.startsWith('priceIn') && !name.endsWith('Enabled')) {
                field = {
                  ...field,
                  admin: {
                    ...('admin' in field ? field.admin : {}),
                    components: {
                      ...('admin' in field && field.admin && 'components' in field.admin
                        ? field.admin.components
                        : {}),
                      Cell: '@/components/admin/PriceCell#PriceCell',
                    },
                  },
                } as typeof field
              }

              /** The plugin's own labels are written for developers. */
              const relabel: Record<string, { description?: string; label: string }> = {
                enableVariants: {
                  description: 'Tick this if the piece is made in more than one size or colour.',
                  label: 'This piece comes in different sizes',
                },
                // Was "Inventory". Hidden by the plugin once the piece has sizes.
                inventory: {
                  description:
                    'How many you have ready to send. A piece in different sizes keeps its stock on each size instead.',
                  label: 'Stock',
                },
                // The price sits in an unnamed group and row, hence mapFieldsDeep.
                priceInQAR: {
                  description:
                    'The price shown in the shop. A size with its own price is charged at that price instead.',
                  label: 'Price (QAR)',
                },
                /*
                 * Every piece needs a price, so the box starts ticked and is
                 * hidden (see below): unticked, the price field was hidden and a
                 * new piece looked as if it had nowhere to type one.
                 */
                priceInQAREnabled: { label: 'Set a price' },
                variantTypes: {
                  description: 'Which options this piece is offered in — for example Size.',
                  label: 'Options offered',
                },
                // Was "Available variants": the plugin's heading over this piece's list of sizes.
                variants: { label: 'Sizes & stock' },
              }

              /*
               * Only the kinds that have at least one option. Colour and Pattern
               * are seeded with none, so ticking them did nothing; they appear
               * here once she adds a colour or pattern.
               */
              if (name === 'variantTypes') {
                field = {
                  ...field,
                  // No "+": it made a new kind of option (beside Size, Colour,
                  // Pattern) — a developer's job. New sizes go in "Sizes,
                  // colours & patterns".
                  admin: { ...('admin' in field ? field.admin : {}), allowCreate: false },
                  filterOptions: async ({ req }: { req: PayloadRequest }) => {
                    const { docs } = await req.payload.find({
                      collection: 'variantOptions',
                      depth: 0,
                      pagination: false,
                      req,
                      select: { variantType: true },
                    })
                    const ids = docs.map((option: Pick<VariantOption, 'variantType'>) =>
                      typeof option.variantType === 'object'
                        ? option.variantType.id
                        : option.variantType,
                    )
                    return { id: { in: [...new Set(ids)] } }
                  },
                } as typeof field
              }

              /*
               * Hidden as well: every piece has a price, so the box had nothing
               * to decide, and sharing a row with it pushed the price box to
               * the right of Stock and Was price.
               */
              /*
               * The piece's own list of sizes: oldest first (she adds S, M, L
               * and it read L, M, S), and only the size and its stock — the
               * title column repeated the piece's whole name on every row.
               */
              if (name === 'variants' && field.type === 'join') {
                field = {
                  ...field,
                  admin: { ...field.admin, defaultColumns: ['options', 'inventory'] },
                  defaultSort: 'createdAt',
                } as typeof field
              }

              if (name === 'priceInQAREnabled') {
                field = {
                  ...field,
                  admin: { ...('admin' in field ? field.admin : {}), hidden: true },
                  defaultValue: true,
                } as typeof field
              }

              if (relabel[name]) {
                return {
                  ...field,
                  admin: {
                    ...('admin' in field ? field.admin : {}),
                    ...(relabel[name].description
                      ? { description: relabel[name].description }
                      : {}),
                  },
                  label: relabel[name].label,
                } as typeof field
              }

              return field
            }) as typeof defaultCollection.fields),
            /*
             * The template's "You may also like" picker was removed: nothing on
             * the storefront shows it, so anything she chose there did nothing.
             * Add it back together with the section that renders it.
             */
            /**
             * A sale (REQUIREMENTS A3): the price it was, shown struck through
             * beside today's price in the shop, on the piece's page and on the
             * homepage. What the customer pays is always the price above.
             */
            amountField({
              currenciesConfig: { defaultCurrency: 'QAR', supportedCurrencies: [QAR] },
              currency: QAR,
              overrides: {
                admin: {
                  description:
                    'Optional — for a sale. The price it was, shown crossed out beside the price. Leave empty when it is not on sale.',
                },
                label: 'Was price',
                name: 'compareAtPriceInQAR',
                validate: (
                  value: null | number | undefined,
                  { siblingData }: { siblingData: Record<string, unknown> },
                ) => {
                  if (value === null || value === undefined) return true
                  const price =
                    typeof siblingData?.priceInQAR === 'number' ? siblingData.priceInQAR : null
                  return (
                    price === null ||
                    value > price ||
                    'The was-price must be higher than the price, or empty.'
                  )
                },
              } as never,
            }),
          ],
          label: 'Price & sizes',
        },
        {
          name: 'meta',
          /*
           * The SEO plugin marks empty boxes "Missing" in red, which read as
           * something broken. Nothing is: the page falls back to these.
           */
          description:
            'Optional. Left empty, Google and shared links use the piece’s name, its description and its first photo — the red “Missing” marks can be ignored. Fill these in only to word it differently for Google.',
          label: 'Google & sharing',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      admin: {
        description: 'Which collection this piece belongs to, for example Resort 2026.',
        position: 'sidebar',
        sortOptions: 'title',
      },
      label: 'Collection',
      hasMany: true,
      relationTo: 'categories',
    },
    webAddress(),
  ],
})
