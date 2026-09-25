import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

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
import { DefaultDocumentIDType, Where } from 'payload'
import { amountField } from '@payloadcms/plugin-ecommerce'
import { QAR } from '@/currencies'

type Fields = Parameters<CollectionOverride>[0]['defaultCollection']['fields']

/**
 * Maps every field, walking into unnamed groups and rows — which only lay
 * fields out, so their children behave as top-level fields. The plugin puts
 * the price in one, where a top-level map never reached it.
 */
const mapFieldsDeep = (fields: Fields, fn: (field: Fields[number]) => Fields[number]): Fields =>
  fields.map((field) =>
    !('name' in field) && 'fields' in field && (field.type === 'group' || field.type === 'row')
      ? ({ ...field, fields: mapFieldsDeep(field.fields, fn) } as Fields[number])
      : fn(field),
  )

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  /** The homepage and Our Story show the product and its price, and they are prerendered. */
  hooks: withStorefrontRefresh(defaultCollection.hooks),
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
              minRows: 1,
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
              admin: { description: 'Offer hand embroidery on this piece.' },
              defaultValue: true,
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
                // The price sits in an unnamed group and row, hence mapFieldsDeep.
                priceInQAR: {
                  description:
                    'The price shown in the shop. A size with its own price is charged at that price instead.',
                  label: 'Price (QAR)',
                },
                priceInQAREnabled: { label: 'Set a price' },
                variantTypes: {
                  description: 'Which options this piece is offered in — for example Size.',
                  label: 'Options offered',
                },
                // Was "Available variants": the plugin's heading over this piece's list of sizes.
                variants: { label: 'Sizes & stock' },
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
