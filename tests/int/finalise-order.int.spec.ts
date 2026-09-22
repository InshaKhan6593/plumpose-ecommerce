import { describe, expect, it } from 'vitest'

import {
  itemsWithPersonalisation,
  orderTotalsFromSnapshot,
  type PricingSnapshot,
} from '@/payments/finaliseOrder'

/**
 * Turning a paid cart into an order.
 *
 * These cover the two transformations that decide whether an order is usable
 * afterwards: the money breakdown behind `amount`, and the embroidery
 * instructions the atelier works from. Both are written once, at payment, and
 * are read-only forever after — so a mistake here is not correctable later.
 */

const embroidery = [
  {
    feeQar: 16000,
    lettering: 'AK',
    placement: 'pocket',
    placementName: 'Pocket',
    style: 'text',
    symbol: '',
    symbolName: '',
    thread: 'gold',
    threadName: 'Gold',
  },
]

const snapshot: PricingSnapshot = {
  discountCode: 'WELCOME10',
  lines: [
    { personalisation: embroidery, productId: 1, quantity: 1, variantId: 2 },
    { personalisation: [], productId: 1, quantity: 2, variantId: 3 },
  ],
  discountTotal: 13990,
  freeShippingApplied: false,
  personalisationTotal: 16000,
  shipping: 2000,
  shippingLabel: 'Delivery to Doha',
  shippingZone: 'qatar',
  subtotal: 139900,
  total: 143910,
}

describe('orderTotalsFromSnapshot', () => {
  it('maps every part of the breakdown onto the order', () => {
    expect(orderTotalsFromSnapshot(snapshot)).toEqual({
      discountCode: 'WELCOME10',
      discountTotalQar: 13990,
      freeShippingApplied: false,
      personalisationTotalQar: 16000,
      shippingLabel: 'Delivery to Doha',
      shippingQar: 2000,
      shippingZone: 'qatar',
      subtotalQar: 139900,
    })
  })

  it('omits an empty discount code rather than writing a blank one', () => {
    const totals = orderTotalsFromSnapshot({ ...snapshot, discountCode: '' })
    expect(totals.discountCode).toBeUndefined()
  })

  /**
   * An order with a correct `amount` and a blank breakdown is recoverable. One
   * carrying zeros looks like a bag that genuinely cost nothing to deliver,
   * which is worse than an obvious gap.
   */
  it('writes nothing at all when there is no snapshot', () => {
    expect(orderTotalsFromSnapshot(null)).toEqual({})
    expect(orderTotalsFromSnapshot(undefined)).toEqual({})
    expect(orderTotalsFromSnapshot({ nonsense: true })).toEqual({})
  })

  it('keeps a waived delivery distinguishable from a zero fee', () => {
    const totals = orderTotalsFromSnapshot({
      ...snapshot,
      freeShippingApplied: true,
      shipping: 0,
      shippingLabel: 'Delivery — with our compliments',
    })
    expect(totals.freeShippingApplied).toBe(true)
    expect(totals.shippingQar).toBe(0)
  })
})

describe('itemsWithPersonalisation', () => {
  it('re-attaches embroidery to the line it belongs to', () => {
    const items = itemsWithPersonalisation(
      [
        { product: 1, quantity: 1, variant: 2 },
        { product: 1, quantity: 2, variant: 3 },
      ],
      snapshot,
    ) as Array<Record<string, unknown>>

    expect(items[0].personalisation).toEqual(embroidery)
    expect(items[1].personalisation).toBeUndefined()
  })

  it('matches lines whether ids arrive raw or populated', () => {
    const items = itemsWithPersonalisation(
      [{ product: { id: 1 }, quantity: 1, variant: { id: 2 } }],
      snapshot,
    ) as Array<Record<string, unknown>>

    expect(items[0].personalisation).toEqual(embroidery)
  })

  it('does not attach embroidery to a different variant of the same piece', () => {
    const items = itemsWithPersonalisation(
      [{ product: 1, quantity: 1, variant: 99 }],
      snapshot,
    ) as Array<Record<string, unknown>>

    expect(items[0].personalisation).toBeUndefined()
  })

  it('leaves the items alone when there is no snapshot to read', () => {
    const items = [{ product: 1, quantity: 1 }]
    expect(itemsWithPersonalisation(items, null)).toBe(items)
    expect(itemsWithPersonalisation(items, { ...snapshot, lines: [] })).toBe(items)
  })

  it('survives items that are not an array', () => {
    expect(itemsWithPersonalisation(undefined, snapshot)).toBeUndefined()
  })

  /**
   * The bug this guards: the order used to copy the cart's raw personalisation,
   * which has `placement: "pocket"` but no `placementName` and no fee — leaving
   * the atelier a placement with no name and nothing to reconcile against.
   */
  it('carries the resolved names and the fee, not the raw cart values', () => {
    const items = itemsWithPersonalisation(
      [{ product: 1, quantity: 1, variant: 2 }],
      snapshot,
    ) as Array<Record<string, unknown>>

    const placement = (items[0].personalisation as Array<Record<string, unknown>>)[0]
    expect(placement.placementName).toBe('Pocket')
    expect(placement.threadName).toBe('Gold')
    expect(placement.feeQar).toBe(16000)
  })
})
