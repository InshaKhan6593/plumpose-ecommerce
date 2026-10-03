/**
 * One clearly marked test order on whatever database `.env` points at, for
 * trying "Send to QBAS" and QBAS's webhook without paying (production SkipCash
 * moves real money). No emails are sent (`skipOrderEmails`), stock is not
 * touched, and the order is QAR 1.00 with "TEST ORDER" in the name and notes.
 *
 *   npx tsx scripts/create-test-order.ts
 *
 * Afterwards set its Fulfilment to Cancelled — orders are archived, never deleted.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

const dirname = path.dirname(fileURLToPath(import.meta.url))
process.loadEnvFile(path.resolve(dirname, '../.env'))

const AL_SAAD = 570561 // Zone 38 · Al Saad

const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

const order = await payload.create({
  collection: 'orders',
  context: { skipOrderEmails: true },
  data: {
    adminNotes: 'TEST ORDER — QBAS webhook test, created by a script. Not a sale: cancel it afterwards.',
    amount: 100,
    currency: 'QAR',
    customerEmail: 'testonly@plumpose.local',
    deliveryZone: AL_SAAD,
    shippingAddress: {
      addressLine1: 'Building 885, Street 9',
      city: 'Doha',
      country: 'QA',
      firstName: 'TEST ORDER',
      lastName: 'do not deliver',
      phone: process.env.QBAS_SENDER_PHONE || '33501133',
    },
  } as never,
  overrideAccess: true,
})

console.log(`Created test order id ${order.id}`)
process.exit(0)
