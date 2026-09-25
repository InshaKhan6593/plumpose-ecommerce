import { describe, expect, it } from 'vitest'

import { embroiderySignature, plumposeCartItemMatcher } from '@/lib/cart/itemMatcher'

/**
 * Bag-line matching. The plugin's default merges any two lines with the same
 * product and size, which would fold an embroidered piece into a plain one and
 * lose the embroidery. See src/lib/cart/itemMatcher.ts.
 */

const gold = {
  lettering: 'M.K',
  placement: 'pocket',
  style: 'both',
  symbol: 'star',
  thread: 'gold',
}
const silverCuff = { lettering: 'N', placement: 'cuff', style: 'text', thread: 'silver' }

const match = (existingItem: object, newItem: object) =>
  plumposeCartItemMatcher({ existingItem, newItem } as never)

describe('cart line matching', () => {
  it('merges the same plain piece in the same size', () => {
    expect(match({ product: 1, variant: 2 }, { product: 1, variant: 2 })).toBe(true)
  })

  it('merges when the stored line has populated relationships', () => {
    expect(match({ product: { id: 1 }, variant: { id: 2 } }, { product: 1, variant: 2 })).toBe(true)
  })

  it('keeps different sizes apart', () => {
    expect(match({ product: 1, variant: 2 }, { product: 1, variant: 3 })).toBe(false)
  })

  it('never folds an embroidered piece into a plain one', () => {
    expect(
      match({ product: 1, variant: 2 }, { personalisation: [gold], product: 1, variant: 2 }),
    ).toBe(false)
    expect(
      match({ personalisation: [gold], product: 1, variant: 2 }, { product: 1, variant: 2 }),
    ).toBe(false)
  })

  it('keeps different embroidery apart', () => {
    expect(
      match(
        { personalisation: [gold], product: 1, variant: 2 },
        { personalisation: [{ ...gold, thread: 'silver' }], product: 1, variant: 2 },
      ),
    ).toBe(false)
  })

  it('merges identical embroidery, whatever order the placements were added in', () => {
    expect(
      match(
        { personalisation: [gold, silverCuff], product: 1, variant: 2 },
        { personalisation: [silverCuff, gold], product: 1, variant: 2 },
      ),
    ).toBe(true)
  })

  it('treats an empty list the same as no embroidery', () => {
    expect(embroiderySignature([])).toBe('')
    expect(embroiderySignature(undefined)).toBe('')
    expect(match({ personalisation: [], product: 1, variant: 2 }, { product: 1, variant: 2 })).toBe(
      true,
    )
  })
})
