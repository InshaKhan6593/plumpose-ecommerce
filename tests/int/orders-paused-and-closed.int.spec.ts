import type { Order } from '@/payload-types'
import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { cancelledNotification, refundedNotification, toOrderView } from '@/email/orderEmails'
import { createSkipcashAdapter } from '@/payments/skipcash/adapter'

/**
 * Orders paused in Site settings, and orders cancelled or refunded (BUILD-LOG §58).
 */

const view = toOrderView(
  {
    amount: 139900,
    createdAt: '2026-09-28T10:00:00.000Z',
    currency: 'QAR',
    customerEmail: 'testonly@plumpose.local',
    id: 7,
    items: [],
    reference: 'PLM-260928-7K4QX2',
    shippingAddress: { firstName: 'Mariam' },
    updatedAt: '2026-09-28T10:00:00.000Z',
  } as unknown as Order,
  { adminUrl: '', footer: {} as never, leadTime: '', orderUrl: 'https://plumpose.com/order/7?token=t' },
)

describe('cancelled and refunded — the emails', () => {
  it('say what happened, by the order code', () => {
    expect(cancelledNotification(view).subject).toBe('Your plumpose order PLM-260928-7K4QX2 has been cancelled')
    expect(refundedNotification(view).subject).toBe('Your plumpose order PLM-260928-7K4QX2 has been refunded')
    expect(refundedNotification(view).text).toContain('Your refund is on its way, Mariam.')
  })

  it('never name an amount — a return may be refunded only in part', () => {
    for (const email of [cancelledNotification(view), refundedNotification(view)]) {
      expect(email.text).not.toMatch(/QAR|1,399/)
      expect(email.html).not.toMatch(/QAR|1,399/)
    }
  })
})

describe('against the database', () => {
  let payload: Payload
  let before: boolean | null | undefined
  const orders: number[] = []

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    before = (await payload.findGlobal({ slug: 'siteSettings' })).ordersOpen
  }, 120_000)

  afterAll(async () => {
    await payload.updateGlobal({
      context: { disableRevalidate: true },
      data: { ordersOpen: before !== false },
      slug: 'siteSettings',
    })
    for (const id of orders) await payload.db.deleteOne({ collection: 'orders', where: { id: { equals: id } } })
  })

  it('with orders paused, no payment can start', async () => {
    await payload.updateGlobal({
      context: { disableRevalidate: true },
      data: { ordersOpen: false },
      slug: 'siteSettings',
    })
    const adapter = createSkipcashAdapter({
      baseUrl: 'https://skipcashtest.azurewebsites.net',
      clientId: 'x',
      isSandbox: true,
      keyId: 'x',
      keySecret: 'x',
      webhookKey: 'x',
    } as never)
    const attempt = adapter.initiatePayment({
      customersSlug: 'users',
      data: { cart: { id: 1, items: [] }, currency: 'QAR', customerEmail: 'testonly@plumpose.local' },
      req: { data: {}, payload },
      transactionsSlug: 'transactions',
    } as never)
    await expect(attempt).rejects.toThrow(/Orders are paused/)
  })

  it('Refunded and Cancelled carry to the locked status; reopening puts it back to Paid', async () => {
    const order = await payload.create({
      collection: 'orders',
      context: { skipOrderEmails: true },
      data: { amount: 1000, currency: 'QAR', customerEmail: 'testonly@plumpose.local', status: 'processing' } as never,
      overrideAccess: true,
    })
    orders.push(order.id as number)

    const set = async (fulfilment: NonNullable<Order['fulfilment']>) => {
      await payload.update({
        collection: 'orders',
        context: { skipOrderEmails: true },
        data: { fulfilment },
        id: order.id,
        overrideAccess: true,
      })
      return (await payload.findByID({ collection: 'orders', depth: 0, id: order.id })).status
    }

    expect(await set('refunded')).toBe('refunded')
    expect(await set('cancelled')).toBe('cancelled')
    expect(await set('delivered')).toBe('processing')
  })
})
