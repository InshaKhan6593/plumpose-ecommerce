import { postgresAdapter } from '@payloadcms/db-postgres'

import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Categories } from '@/collections/Categories'
import { Countries } from '@/collections/Countries'
import { Currencies } from '@/collections/Currencies'
import { DiscountCodes } from '@/collections/DiscountCodes'
import { FAQs } from '@/collections/FAQs'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { PersonalisationOptions } from '@/collections/PersonalisationOptions'
import { Press } from '@/collections/Press'
import { Projects } from '@/collections/Projects'
import { Reviews } from '@/collections/Reviews'
import { ShippingCities } from '@/collections/ShippingCities'
import { ShippingZones } from '@/collections/ShippingZones'
import { SpinSegments } from '@/collections/SpinSegments'
import { Spotted } from '@/collections/Spotted'
import { Subscribers } from '@/collections/Subscribers'
import { Users } from '@/collections/Users'
import { Footer } from '@/globals/Footer'
import { Header } from '@/globals/Header'
import { SiteSettings } from '@/globals/SiteSettings'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    avatar: 'default',
    components: {
      /** The client's own dashboard — orders today, fulfilment queue, low stock. */
      beforeDashboard: ['@/components/BeforeDashboard#BeforeDashboard'],
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      /** Products and Orders pinned above the plugin's collection ordering. */
      beforeNavLinks: ['@/components/AdminQuickLinks#AdminQuickLinks'],
      graphics: {
        Icon: '@/components/AdminBrand#AdminIcon',
        Logo: '@/components/AdminBrand#AdminLogo',
      },
    },
    /** Dates read the way she writes them, not US order. */
    dateFormat: 'd MMMM yyyy',
    meta: {
      description: 'plumpose — manage products, orders and the site.',
      titleSuffix: ' · plumpose',
    },
    /** The brand is light. A dark admin would look like a different product. */
    theme: 'light',
    user: Users.slug,
  },
  /**
   * Order matters: Payload builds the sidebar groups in the order their
   * collections first appear. The client lives in Shop, so it comes first
   * and Users comes last.
   */
  collections: [
    // Shop — the daily work
    DiscountCodes,
    SpinSegments,
    // Content — what she publishes
    Projects,
    FAQs,
    Press,
    Spotted,
    Reviews,
    Subscribers,
    Pages,
    Categories,
    Media,
    // Shop settings — set once, adjusted rarely
    PersonalisationOptions,
    ShippingZones,
    ShippingCities,
    Countries,
    Currencies,
    // Users — least-visited
    Users,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  editor: lexicalEditor({
    features: () => {
      return [
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        LinkFeature({
          enabledCollections: ['pages'],
          fields: ({ defaultFields }) => {
            const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
              if ('name' in field && field.name === 'url') return false
              return true
            })

            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: ({ linkType }) => linkType !== 'internal',
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
              },
            ]
          },
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  //email: nodemailerAdapter(),
  endpoints: [],
  globals: [Header, Footer, SiteSettings],
  /** Required for the responsive imageSizes on the Media collection. */
  sharp,
  plugins,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
