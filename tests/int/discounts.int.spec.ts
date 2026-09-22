import type { DiscountCode, Product, SiteSetting } from '@/payload-types'

import { describe, expect, it } from 'vitest'

import { evaluateDiscount, normaliseCode } from '@/lib/pricing/discounts'
import { personalisationRules } from '@/lib/pricing/personalisation'
import { priceOrder } from '@/lib/pricing/priceOrder'

/**
 * Discount validation, branch by branch.
 *
 * `evaluateDiscount` is pure on purpose: every refusal path is reachable here
 * without seeding a code, a customer and an order first.
 */

const code = (overrides: Partial<DiscountCode> = {}): DiscountCode =>
  ({
    active: true,
    code: 'WELCOME10',
    createdAt: '',
    id: 1,
    perCustomerLimit: 1,
    type: 'percent',
    updatedAt: '',
    usageCount: 0,
    value: 10,
    ...overrides,
  }) as DiscountCode

const basket = {
  goodsTotal: 139900,
  productIds: [1],
  usesByThisCustomer: 0,
}

describe('normaliseCode', () => {
  it('forgives how a customer retypes a code', () => {
    expect(normaliseCode(' welcome 10 ')).toBe('WELCOME10')
    expect(normaliseCode('Welcome10')).toBe('WELCOME10')
    expect(normaliseCode(null)).toBe('')
  })
})

describe('evaluateDiscount', () => {
  it('accepts a straightforward code', () => {
    const result = evaluateDiscount(code(), basket)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.discount).toMatchObject({ code: 'WELCOME10', type: 'percent', value: 10 })
  })

  it('refuses an inactive code without saying it exists', () => {
    const result = evaluateDiscount(code({ active: false }), basket)
    expect(result.ok).toBe(false)
    if (result.ok) return
    // Deliberately indistinguishable from an unknown code.
    expect(result.refusal.reason).toBe('unknownCode')
  })

  it('refuses a code before its start date', () => {
    const result = evaluateDiscount(code({ startsAt: '2027-01-01T00:00:00.000Z' }), {
      ...basket,
      now: new Date('2026-09-22T00:00:00.000Z'),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('notStarted')
  })

  it('refuses an expired code', () => {
    const result = evaluateDiscount(code({ expiresAt: '2026-01-01T00:00:00.000Z' }), {
      ...basket,
      now: new Date('2026-09-22T00:00:00.000Z'),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('expired')
  })

  it('accepts a code inside its window', () => {
    const result = evaluateDiscount(
      code({ expiresAt: '2026-12-31T00:00:00.000Z', startsAt: '2026-01-01T00:00:00.000Z' }),
      { ...basket, now: new Date('2026-09-22T00:00:00.000Z') },
    )
    expect(result.ok).toBe(true)
  })

  it('refuses a wheel code claimed by a different email', () => {
    const wheelCode = code({ issuedToEmail: 'her@example.com', source: 'spinWheel' })
    const result = evaluateDiscount(wheelCode, { ...basket, email: 'someone@else.com' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('notYours')
  })

  it('refuses a wheel code with no email at all', () => {
    const wheelCode = code({ issuedToEmail: 'her@example.com', source: 'spinWheel' })
    expect(evaluateDiscount(wheelCode, basket).ok).toBe(false)
  })

  it('accepts a wheel code for its owner, however they capitalise it', () => {
    const wheelCode = code({ issuedToEmail: 'her@example.com', source: 'spinWheel' })
    const result = evaluateDiscount(wheelCode, { ...basket, email: '  HER@Example.com ' })
    expect(result.ok).toBe(true)
  })

  it('refuses a code that has been fully redeemed', () => {
    const result = evaluateDiscount(code({ usageCount: 50, usageLimit: 50 }), basket)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('usageLimit')
  })

  it('treats an empty usage limit as unlimited', () => {
    expect(evaluateDiscount(code({ usageCount: 9999, usageLimit: null }), basket).ok).toBe(true)
  })

  it('refuses a customer who has already used it', () => {
    const result = evaluateDiscount(code({ perCustomerLimit: 1 }), {
      ...basket,
      usesByThisCustomer: 1,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('perCustomerLimit')
  })

  it('refuses a basket under the minimum spend, in the right units', () => {
    // minSpend is stored in major units: 2000 means QAR 2,000.
    const result = evaluateDiscount(code({ minSpendQar: 2000 }), basket)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('minSpend')
    expect(result.refusal.message).toContain('2,000')
  })

  it('accepts a basket that meets the minimum spend exactly', () => {
    expect(evaluateDiscount(code({ minSpendQar: 1399 }), basket).ok).toBe(true)
  })

  it('refuses a restricted code when the bag holds none of its products', () => {
    const result = evaluateDiscount(code({ appliesTo: [99] }), basket)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('notEligible')
  })

  it('accepts a restricted code when the bag qualifies', () => {
    const result = evaluateDiscount(code({ appliesTo: [1] }), basket)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.discount.appliesToProductIds).toEqual([1])
  })

  it('reads a restriction whether it arrives as an id or a document', () => {
    const populated = code({ appliesTo: [{ id: 1 } as Product] })
    const result = evaluateDiscount(populated, basket)
    expect(result.ok && result.discount.appliesToProductIds).toEqual([1])
  })
})

describe('a restricted discount inside the pricing engine', () => {
  const settings: Partial<SiteSetting> = { personalisationFeeQar: 160 }
  const context = {
    personalisationRules: personalisationRules([], settings),
    settings,
    shipping: {
      cities: [{ active: true, feeQar: 20, key: 'doha', name: 'Doha' }],
      countries: [{ blockedReason: null, code: 'QA', name: 'Qatar', zoneKey: 'qatar' }],
      zones: [],
    },
  } as never

  const covered = { id: 1, priceInQAR: 100000, title: 'Covered' } as Product
  const other = { id: 2, priceInQAR: 100000, title: 'Other' } as Product
  const doha = { cityKey: 'doha', countryCode: 'QA' }

  it('discounts only the line the code covers', () => {
    const result = priceOrder(
      {
        destination: doha,
        discount: { appliesToProductIds: [1], code: 'X', type: 'percent', value: 10 },
        lines: [
          { product: covered, quantity: 1 },
          { product: other, quantity: 1 },
        ],
      },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')

    // 10% of the covered QAR 1,000 only — not of the QAR 2,000 basket.
    expect(result.order.discountTotal).toBe(10000)
  })

  it('caps a fixed discount at the eligible lines, not the whole bag', () => {
    const result = priceOrder(
      {
        destination: doha,
        discount: { appliesToProductIds: [1], code: 'X', type: 'fixed', value: 5000 },
        lines: [
          { product: covered, quantity: 1 },
          { product: other, quantity: 1 },
        ],
      },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')

    // The code claims QAR 5,000 off; only QAR 1,000 of goods are eligible.
    expect(result.order.discountTotal).toBe(100000)
    expect(result.order.total).toBe(100000 + 2000)
  })

  it('discounts the whole bag when the code is unrestricted', () => {
    const result = priceOrder(
      {
        destination: doha,
        discount: { code: 'X', type: 'percent', value: 10 },
        lines: [
          { product: covered, quantity: 1 },
          { product: other, quantity: 1 },
        ],
      },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')
    expect(result.order.discountTotal).toBe(20000)
  })
})
