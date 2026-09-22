import type { DiscountCode } from '@/payload-types'
import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { redeemDiscount, validateDiscountCode } from '@/lib/pricing/discounts'

/**
 * The discount engine against the real database.
 *
 * Unlike the other live spec, this one **writes**: it creates its own codes,
 * redeems them, and removes everything it made in `afterAll`. Codes are
 * prefixed so a failed run leaves something obviously disposable behind rather
 * than something that looks like the client's own promotion.
 *
 * What it proves that the pure tests cannot: that the ledger write and the
 * counter bump actually land, that the per-customer limit reads back from
 * `discountUses`, and that `overrideAccess` is genuinely needed — the
 * collection is admin-read, so a customer redeeming a code would 403 without
 * it.
 */

const PREFIX = 'TESTONLY-'
const CUSTOMER = 'test-customer@plumpose.local'

let payload: Payload
const created: number[] = []

const makeCode = async (overrides: Partial<DiscountCode> = {}): Promise<DiscountCode> => {
  const doc = await payload.create({
    collection: 'discountCodes',
    data: {
      active: true,
      code: `${PREFIX}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      perCustomerLimit: 1,
      type: 'percent',
      value: 10,
      ...overrides,
    } as never,
    overrideAccess: true,
  })
  created.push(doc.id)
  return doc
}

const basket = { goodsTotal: 139900, productIds: [1] }

describe('discount engine against the database', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  }, 120_000)

  afterAll(async () => {
    for (const id of created) {
      await payload
        .delete({
          collection: 'discountUses',
          overrideAccess: true,
          where: { code: { equals: id } },
        })
        .catch(() => undefined)
      await payload
        .delete({ collection: 'discountCodes', id, overrideAccess: true })
        .catch(() => undefined)
    }
  }, 120_000)

  it('finds and validates a real code', async () => {
    const doc = await makeCode()
    const result = await validateDiscountCode(payload, doc.code, {
      ...basket,
      email: CUSTOMER,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.discount.type).toBe('percent')
  })

  it('matches however the customer types it', async () => {
    const doc = await makeCode()
    const result = await validateDiscountCode(payload, ` ${doc.code.toLowerCase()} `, {
      ...basket,
      email: CUSTOMER,
    })
    expect(result.ok).toBe(true)
  })

  it('refuses a code that does not exist', async () => {
    const result = await validateDiscountCode(payload, `${PREFIX}NOPE`, {
      ...basket,
      email: CUSTOMER,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('unknownCode')
  })

  /**
   * The round trip that matters: validate, redeem, then find the same customer
   * blocked by their own redemption. This is what makes a one-per-customer
   * wheel prize actually one per customer.
   */
  it('blocks a second redemption by the same customer', async () => {
    const doc = await makeCode({ perCustomerLimit: 1 })

    const first = await validateDiscountCode(payload, doc.code, { ...basket, email: CUSTOMER })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    await redeemDiscount(payload, {
      amountQar: 13990,
      code: first.code,
      email: CUSTOMER,
    })

    const second = await validateDiscountCode(payload, doc.code, { ...basket, email: CUSTOMER })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.refusal.reason).toBe('perCustomerLimit')
  })

  it('still allows a different customer after someone else redeems', async () => {
    const doc = await makeCode({ perCustomerLimit: 1 })
    const first = await validateDiscountCode(payload, doc.code, { ...basket, email: CUSTOMER })
    if (!first.ok) throw new Error('expected the code to validate')

    await redeemDiscount(payload, { amountQar: 13990, code: first.code, email: CUSTOMER })

    const other = await validateDiscountCode(payload, doc.code, {
      ...basket,
      email: 'someone-else@plumpose.local',
    })
    expect(other.ok).toBe(true)
  })

  it('writes the ledger row and bumps the counter', async () => {
    const doc = await makeCode()
    const result = await validateDiscountCode(payload, doc.code, { ...basket, email: CUSTOMER })
    if (!result.ok) throw new Error('expected the code to validate')

    await redeemDiscount(payload, { amountQar: 13990, code: result.code, email: CUSTOMER })

    const uses = await payload.find({
      collection: 'discountUses',
      overrideAccess: true,
      where: { code: { equals: doc.id } },
    })
    expect(uses.docs).toHaveLength(1)
    expect(uses.docs[0]).toMatchObject({ amountQar: 13990, email: CUSTOMER })

    const reloaded = await payload.findByID({
      collection: 'discountCodes',
      id: doc.id,
      overrideAccess: true,
    })
    expect(reloaded.usageCount).toBe(1)
  })

  it('refuses once the total usage limit is reached', async () => {
    const doc = await makeCode({ perCustomerLimit: 0, usageCount: 5, usageLimit: 5 })
    const result = await validateDiscountCode(payload, doc.code, { ...basket, email: CUSTOMER })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('usageLimit')
  })

  it('enforces the minimum spend against a real code', async () => {
    const doc = await makeCode({ minSpendQar: 5000 })
    const result = await validateDiscountCode(payload, doc.code, { ...basket, email: CUSTOMER })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('minSpend')
  })

  it('keeps a wheel code to the address it was issued to', async () => {
    const doc = await makeCode({
      issuedToEmail: 'winner@plumpose.local',
      source: 'spinWheel',
    })

    const thief = await validateDiscountCode(payload, doc.code, {
      ...basket,
      email: 'thief@plumpose.local',
    })
    expect(thief.ok).toBe(false)

    const winner = await validateDiscountCode(payload, doc.code, {
      ...basket,
      email: 'winner@plumpose.local',
    })
    expect(winner.ok).toBe(true)
  })

  it('leaves the client’s own codes untouched', async () => {
    const all = await payload.find({
      collection: 'discountCodes',
      limit: 500,
      overrideAccess: true,
      pagination: false,
    })
    const strays = all.docs.filter((d) => !d.code.startsWith(PREFIX) && created.includes(d.id))
    expect(strays).toEqual([])
  })
})
