import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { slugField } from 'payload'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
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

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
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
              label: false,
              required: false,
            },
            {
              name: 'gallery',
              type: 'array',
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
                  admin: {
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
              blocks: [CallToAction, Content, MediaBlock],
            },
          ],
          label: 'Content',
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
                description:
                  'Hand-finished to order — allows ordering a size that is out of stock.',
              },
              defaultValue: true,
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
            ...(defaultCollection.fields.map((field) => {
              if ('name' in field && String(field.name).startsWith('priceIn')) {
                return {
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
                }
              }
              return field
            }) as typeof defaultCollection.fields),
            {
              name: 'relatedProducts',
              type: 'relationship',
              filterOptions: ({ id }) => {
                if (id) {
                  return {
                    id: {
                      not_in: [id],
                    },
                  }
                }

                // ID comes back as undefined during seeding so we need to handle that case
                return {
                  id: {
                    exists: true,
                  },
                }
              },
              hasMany: true,
              relationTo: 'products',
            },
          ],
          label: 'Product Details',
        },
        {
          name: 'meta',
          label: 'SEO',
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
        position: 'sidebar',
        sortOptions: 'title',
      },
      hasMany: true,
      relationTo: 'categories',
    },
    slugField(),
  ],
})
