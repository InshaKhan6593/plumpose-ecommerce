import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { CHECKOUT_LIFETIME_MS, declineReason, paymentOutcome } from '@/lib/payments/outcome'

/**
 * Failed and abandoned payments, visible in the admin (REQUIREMENTS P11).
 *
 * The pure wording first, then against the database: payment records and a
 * logged card decline are written the way a real checkout writes them, and
 * read back through the same afterRead hook the admin's "What happened"
 * column uses. Everything made here is removed afterwards.
 */

const now = new Date('2026-09-25T12:00:00Z')
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)

describe('payments — what happened, in words', () => {
  it('names a paid checkout and its order', () => {
    expect(
      paymentOutcome({ createdAt: minutesAgo(5), now, orderId: 42, status: 'succeeded' }),
    ).toEqual({ fine: true, label: 'Paid — order #42' })
  })

  it('a checkout still within the payment page’s hour is not yet a lost sale', () => {
    expect(paymentOutcome({ createdAt: minutesAgo(10), now, status: 'pending' })).toMatchObject({
      fine: true,
      label: 'On the payment page',
    })
  })

  it('a checkout older than the page’s lifetime, or expired, was left unpaid', () => {
    const old = paymentOutcome({
      createdAt: new Date(now.getTime() - CHECKOUT_LIFETIME_MS - 1000),
      now,
      status: 'pending',
    })
    expect(old).toEqual({ fine: false, label: 'Not paid — left the payment page' })
    expect(paymentOutcome({ createdAt: minutesAgo(5), now, status: 'expired' }).fine).toBe(false)
  })

  it('says how many times the card was declined, and the gateway’s reason', () => {
    expect(
      paymentOutcome({
        createdAt: minutesAgo(90),
        declines: ['Your card was declined', 'Your card has insufficient funds'],
        now,
        status: 'expired',
      }).label,
    ).toBe('Not paid — left the payment page — card declined 2 times ("Your card was declined")')
    expect(
      paymentOutcome({ createdAt: minutesAgo(90), declines: [''], now, status: 'failed' }).label,
    ).toBe('Payment failed — card declined once')
  })

  it('reads the decline reason out of a logged gateway event', () => {
    expect(
      declineReason({
        data: { object: { last_payment_error: { message: 'Your card was declined.' } } },
      }),
    ).toBe('Your card was declined')
    expect(declineReason({})).toBe('')
  })
})

describe('payments — in the admin, against the database', () => {
  let payload: Payload
  const made: { collection: 'carts' | 'transactions' | 'webhookLog'; id: number }[] = []
  const EMAIL = 'e2eonly-payments@plumpose.local'

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  }, 120_000)

  afterAll(async () => {
    for (const { collection, id } of made.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
  })

  const payment = async (status: string, cart: number, createdAt?: Date) => {
    const doc = await payload.create({
      collection: 'transactions',
      data: {
        amount: 139900,
        cart,
        currency: 'QAR',
        customerEmail: EMAIL,
        items: [],
        paymentMethod: 'stripe',
        status,
      } as never,
      overrideAccess: true,
    })
    made.push({ collection: 'transactions', id: doc.id })
    // A checkout from earlier: the record's own timestamp is what the outcome reads.
    if (createdAt)
      await payload.db.updateOne({
        collection: 'transactions',
        data: { createdAt: createdAt.toISOString() },
        id: doc.id,
      })
    return doc.id
  }

  it('shows abandoned checkouts in words, each with its own card declines', async () => {
    const cart = await payload.create({
      collection: 'carts',
      data: { currency: 'QAR', customerEmail: EMAIL, items: [] } as never,
      overrideAccess: true,
    })
    made.push({ collection: 'carts', id: cart.id })

    // One bag, checked out three times: three hours ago, two hours ago, and just now.
    const hour = 60 * 60 * 1000
    const first = await payment('expired', cart.id, new Date(Date.now() - 3 * hour))
    const second = await payment('pending', cart.id, new Date(Date.now() - 2 * hour))
    const third = await payment('pending', cart.id)

    // The gateway declined a card 100 minutes ago — during the second checkout.
    const log = await payload.create({
      collection: 'webhookLog',
      data: {
        applied: false,
        event: 'payment_intent.payment_failed',
        eventId: `evt_e2eonly_${Date.now()}`,
        orderRef: String(cart.id),
        payload: {
          data: { object: { last_payment_error: { message: 'Your card was declined.' } } },
        },
        paymentId: 'pi_e2eonly',
        signatureValid: true,
      } as never,
      overrideAccess: true,
    })
    made.push({ collection: 'webhookLog', id: log.id })
    await payload.db.updateOne({
      collection: 'webhookLog',
      data: { createdAt: new Date(Date.now() - 100 * 60_000).toISOString() },
      id: log.id,
    })

    const read = async (id: number) =>
      (
        (await payload.findByID({
          collection: 'transactions',
          depth: 0,
          id,
          overrideAccess: true,
        })) as unknown as { outcome: string }
      ).outcome

    expect(await read(first)).toBe('Not paid — left the payment page')
    expect(await read(second)).toBe(
      'Not paid — left the payment page — card declined once ("Your card was declined")',
    )
    expect(await read(third)).toBe('On the payment page')
  })

  it('lists payments newest first, for the admin', async () => {
    const { docs } = await payload.find({
      collection: 'transactions',
      depth: 0,
      limit: 3,
      overrideAccess: true,
      where: { customerEmail: { equals: EMAIL } },
    })
    const times = docs.map((d) => new Date(d.createdAt).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })
})
