/**
 * A paid order for video 04, made through the local API: orders cannot be
 * created over REST or in the admin (only a paid checkout makes one — see the
 * orders access in @/plugins). Called by `addPaidOrder()` in demo-data.ts with
 * the piece and size it made; prints the order's id and private link token as
 * JSON on the last line. Refuses anything but the local plumpose_demo database.
 *
 *   npx tsx scripts/record/add-demo-order.ts <productId> <variantId>
 */
import path from 'node:path'

import { getPayload } from 'payload'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

const { default: config } = await import('@/payload.config')
const { isLocalDatabase } = await import('@/utilities/database')

if (!isLocalDatabase() || !/plumpose_demo/.test(process.env.DATABASE_URL ?? '')) {
  console.error('add-demo-order runs only against the local plumpose_demo database.')
  process.exit(1)
}

const [productId, variantId] = process.argv.slice(2).map(Number)
if (!productId || !variantId) {
  console.error('usage: add-demo-order.ts <productId> <variantId>')
  process.exit(1)
}

const payload = await getPayload({ config: await config })

// The customer is made up.
const order = await payload.create({
  collection: 'orders',
  context: { disableRevalidate: true, skipOrderEmails: true },
  data: {
    amount: 157900,
    currency: 'QAR',
    customerEmail: 'mariam.hassan@example.com',
    fulfilment: 'unfulfilled',
    gift: true,
    giftNote: 'Happy birthday, Sara — with love, Mariam',
    items: [
      {
        personalisation: [
          {
            feeQar: 16000,
            lettering: 'S.H',
            placement: 'pocket',
            placementName: 'Pocket',
            style: 'lettering',
            thread: 'gold',
            threadName: 'Gold',
          },
        ],
        product: productId,
        quantity: 1,
        variant: variantId,
      },
    ],
    personalisationTotalQar: 16000,
    shippingAddress: {
      addressLine1: 'Building 12, Street 840',
      addressLine2: 'Al Sadd',
      city: 'Doha',
      country: 'QA',
      firstName: 'Mariam',
      lastName: 'Hassan',
      phone: '+974 5555 0123',
    },
    shippingLabel: 'Doha',
    shippingQar: 2000,
    shippingZone: 'qatar',
    status: 'processing',
    subtotalQar: 139900,
  },
  overrideAccess: true,
})

console.log(JSON.stringify({ id: order.id, token: order.accessToken ?? '' }))
process.exit(0)
