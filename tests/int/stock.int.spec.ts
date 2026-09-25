import { describe, expect, it } from 'vitest'

import type { Product, Variant } from '@/payload-types'

import { purchaseLimit, readyStock, stockRefusal, stockShortages, stockSummary } from '@/lib/pricing/stock'

const product = (madeToOrder: boolean): Product =>
  ({ id: 1, madeToOrder, priceInQAR: 139900, title: 'Al Shaheen Nights — Silk Pyjama Set' }) as unknown as Product
const size = (id: number, label: string, inventory: null | number): Variant =>
  ({ id, inventory, priceInQAR: 139900, title: `Al Shaheen Nights — Silk Pyjama Set — ${label}` }) as unknown as Variant

describe('stock — ready stock', () => {
  it('never counts below zero, whatever the database says', () => {
    expect(readyStock({ inventory: -24 })).toBe(0)
    expect(readyStock({ inventory: null })).toBe(0)
    expect(readyStock({ inventory: 3 })).toBe(3)
  })

  it('limits a customer to what is ready, unless the piece is made to order', () => {
    expect(purchaseLimit(product(false), { inventory: 2 })).toBe(2)
    expect(purchaseLimit(product(false), { inventory: -5 })).toBe(0)
    expect(purchaseLimit(product(true), { inventory: 0 })).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('stock — made to order off: stock is a hard limit', () => {
  const p = product(false)

  it('refuses a sold-out size, by name', () => {
    expect(stockRefusal([{ product: p, quantity: 1, variant: size(2, 'M', 0) }])).toBe(
      'Al Shaheen Nights, size M is sold out. Please remove it from your bag or choose another size.',
    )
  })

  it('refuses more than there are', () => {
    expect(stockRefusal([{ product: p, quantity: 3, variant: size(2, 'M', 2) }])).toBe(
      'Only 2 left in Al Shaheen Nights, size M. Please lower the quantity in your bag.',
    )
  })

  it('adds up lines of the same size — a plain and an embroidered M cannot each pass alone', () => {
    const m = size(2, 'M', 1)
    expect(
      stockRefusal([
        { product: p, quantity: 1, variant: m },
        { product: p, quantity: 1, variant: m },
      ]),
    ).toMatch(/Only 1 left/)
  })

  it('treats negative stock as sold out', () => {
    expect(stockRefusal([{ product: p, quantity: 1, variant: size(2, 'M', -24) }])).toMatch(/sold out/)
  })

  it('passes a basket that fits', () => {
    expect(
      stockRefusal([
        { product: p, quantity: 2, variant: size(1, 'S', 4) },
        { product: p, quantity: 1, variant: size(3, 'L', 1) },
      ]),
    ).toBeNull()
  })
})

describe('stock — made to order on: never refused, noted instead', () => {
  const p = product(true)

  it('sells a size with no stock, and says how many will be made', () => {
    const lines = [{ product: p, quantity: 3, variant: size(2, 'M', 1) }]
    expect(stockRefusal(lines)).toBeNull()
    expect(stockSummary(lines).madeToOrder).toEqual([{ count: 2, label: 'Al Shaheen Nights, size M', variantId: 2 }])
  })

  it('reports nothing when everything is ready to send', () => {
    const lines = [{ product: p, quantity: 1, variant: size(1, 'S', 4) }]
    expect(stockShortages(lines)).toEqual([])
    expect(stockSummary(lines)).toEqual({ madeToOrder: [], refusal: null })
  })
})

describe('stock — naming a choice', () => {
  const p = { id: 9, madeToOrder: false, title: 'Classic — Silk Pyjama Set' } as unknown as Product
  const v = (title: string) => ({ id: 1, inventory: 0, title }) as unknown as Variant

  it('a size reads as "size M"; a size and colour in brackets', () => {
    expect(stockRefusal([{ product: p, quantity: 1, variant: v('Classic — Silk Pyjama Set — M') }])).toMatch(/^Classic, size M is sold out/)
    expect(stockRefusal([{ product: p, quantity: 1, variant: v('Classic — Silk Pyjama Set — M — Blush') }])).toMatch(/^Classic \(M \/ Blush\) is sold out/)
    expect(stockRefusal([{ product: p, quantity: 1, variant: v('Classic — Silk Pyjama Set — Blush') }])).toMatch(/^Classic \(Blush\) is sold out/)
  })
})
