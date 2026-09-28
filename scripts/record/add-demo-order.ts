/**
 * A paid order for video 04, made through the local API: orders cannot be
 * created over REST or in the admin (only a paid checkout makes one — see the
 * orders access in @/plugins). Called by `addPaidOrder()` in demo-data.ts with
 * the piece and size it made; prints the order's id and private link token as
 * JSON on the last line. Refuses anything but the local plumpose_demo database.
 *
 *   npx tsx scripts/record/add-demo-order.ts <productId> <variantId> [--payments]
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

const [productId, variantId] = process.argv.slice(2, 4).map(Number)
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

/*
 * Its payment, as SkipCash's callback leaves one — plus, with `--payments`,
 * two checkouts that did not end in an order (video 13): one left on the
 * payment page an afternoon ago, one whose card was refused.
 */
if (process.argv.includes('--payments')) {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const skipcash = (reference: string) => ({
    cardNumber: '520000******0007',
    cardType: 'Credit Card',
    paymentId: crypto.randomUUID(),
    reference,
  })
  const made = [
    {
      amount: 139900,
      createdAt: hoursAgo(5),
      customerEmail: 'hessa.m@example.com',
      skipcash: { ...skipcash('PLM-260928-K7Q2VD'), cardNumber: '' },
      status: 'pending',
    },
    {
      amount: 157900,
      createdAt: hoursAgo(1.5),
      customerEmail: 'mariam.hassan@example.com',
      order: order.id,
      skipcash: skipcash(String((order as { reference?: string }).reference ?? '')),
      status: 'succeeded',
    },
    {
      amount: 141900,
      createdAt: hoursAgo(0.5),
      customerEmail: 'latifa@example.com',
      skipcash: skipcash('PLM-260928-R3TW8N'),
      status: 'failed',
    },
  ] as const
  for (const data of made) {
    const doc = await payload.create({
      collection: 'transactions',
      context: { disableRevalidate: true },
      data: { ...data, currency: 'QAR', paymentMethod: 'skipcash' } as never,
      overrideAccess: true,
    })
    // Payload stamps createdAt itself; the list should read like a real day.
    await payload.db.updateOne({
      collection: 'transactions',
      data: { createdAt: data.createdAt },
      id: doc.id,
    })
  }
}

console.log(JSON.stringify({ id: order.id, token: order.accessToken ?? '' }))
process.exit(0)
