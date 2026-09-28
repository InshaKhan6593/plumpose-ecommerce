import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { orderCode, readOrderCode } from '@/hooks/orderReference'

/**
 * Orders are known by a code — the paid payment's SkipCash reference,
 * "PLM-250928-7K4QX2" — not the database's "No. 105" (BUILD-LOG §57).
 */

describe('order code — reading what a customer types', () => {
  it('takes the code however it is typed', () => {
    expect(readOrderCode('PLM-260928-7K4QX2')).toBe('PLM-260928-7K4QX2')
    expect(readOrderCode(' plm-260928-7k4qx2 ')).toBe('PLM-260928-7K4QX2')
    expect(readOrderCode('PLM 260928 7K4QX2')).toBe('PLM-260928-7K4QX2')
    expect(readOrderCode('plm2609287k4qx2')).toBe('PLM-260928-7K4QX2')
  })

  it('is not a code for an old order number', () => {
    expect(readOrderCode('#105')).toBeNull()
    expect(readOrderCode('105')).toBeNull()
  })

  it('names an order by its code, or by number before codes', () => {
    expect(orderCode({ id: 7, reference: 'PLM-260928-7K4QX2' })).toBe('PLM-260928-7K4QX2')
    expect(orderCode({ id: 7, reference: null })).toBe('no. 7')
  })
})

describe('order code — against the database', () => {
  let payload: Payload
  const made: Array<{ collection: 'orders' | 'transactions'; id: number }> = []

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  }, 120_000)

  afterAll(async () => {
    for (const { collection, id } of made.reverse()) {
      await payload.db.deleteOne({ collection, where: { id: { equals: id } } })
    }
  })

  it('a new order takes its payment’s reference', async () => {
    const reference = `PLM-260928-T${String(Date.now()).slice(-5)}`
    const transaction = await payload.create({
      collection: 'transactions',
      data: {
        amount: 139900,
        currency: 'QAR',
        customerEmail: 'testonly@plumpose.local',
        items: [],
        paymentMethod: 'skipcash',
        skipcash: { reference },
        status: 'succeeded',
      } as never,
      overrideAccess: true,
    })
    made.push({ collection: 'transactions', id: transaction.id as number })

    const order = await payload.create({
      collection: 'orders',
      data: {
        amount: 139900,
        currency: 'QAR',
        customerEmail: 'testonly@plumpose.local',
        transactions: [transaction.id],
      } as never,
      overrideAccess: true,
    })
    made.push({ collection: 'orders', id: order.id as number })
    expect(order.reference).toBe(reference)
  })

  it('an order without a SkipCash payment still gets a code of the same form', async () => {
    const order = await payload.create({
      collection: 'orders',
      data: { amount: 1000, currency: 'QAR', customerEmail: 'testonly@plumpose.local' } as never,
      overrideAccess: true,
    })
    made.push({ collection: 'orders', id: order.id as number })
    expect(order.reference).toMatch(/^PLM-\d{6}-[A-Z0-9]{6}$/)
  })

  it('is kept when the order is edited', async () => {
    const order = await payload.create({
      collection: 'orders',
      data: { amount: 1000, currency: 'QAR', customerEmail: 'testonly@plumpose.local' } as never,
      overrideAccess: true,
    })
    made.push({ collection: 'orders', id: order.id as number })
    const edited = await payload.update({
      collection: 'orders',
      data: { fulfilment: 'inAtelier' } as never,
      id: order.id,
      overrideAccess: true,
    })
    expect(edited.reference).toBe(order.reference)
  })
})
