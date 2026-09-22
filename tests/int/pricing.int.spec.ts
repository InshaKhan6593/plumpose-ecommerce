import type {
  Country,
  PersonalisationOption,
  Product,
  ShippingCity,
  ShippingZone,
  SiteSetting,
  Variant,
} from '@/payload-types'

import { describe, expect, it } from 'vitest'

import { toMinor } from '@/lib/pricing/money'
import {
  cleanLettering,
  normalisePersonalisationList,
  personalisationRules,
} from '@/lib/pricing/personalisation'
import { priceOrder, type ValidatedDiscount } from '@/lib/pricing/priceOrder'
import { deliveryFor, qualifiesForFreeShipping } from '@/lib/pricing/shipping'

/**
 * Pricing engine tests.
 *
 * These run against fixtures rather than the database on purpose: the engine
 * is pure, and the figures below are the ones from the client's own seeded
 * data, so a failure here means the arithmetic changed rather than that
 * somebody edited a row.
 *
 * QAR 1,399 piece · QAR 160 per embroidery placement · Doha 20 · Al Khor 50 ·
 * UAE 150 — exactly the legacy `shipping.mjs` and `personalisation.mjs`.
 */

const option = (
  type: PersonalisationOption['type'],
  key: string,
  name: string,
): PersonalisationOption =>
  ({ active: true, createdAt: '', id: 0, key, name, type, updatedAt: '' }) as PersonalisationOption

const options: PersonalisationOption[] = [
  option('placement', 'pocket', 'Pocket'),
  option('placement', 'neck', 'Neck'),
  option('placement', 'cuff', 'Cuff'),
  option('style', 'text', 'Letters only'),
  option('style', 'symbol', 'Symbol only'),
  option('style', 'both', 'Letters + symbol'),
  option('symbol', 'star', 'Four-pointed star'),
  option('symbol', 'heart', 'Heart'),
  option('thread', 'gold', 'Gold'),
  option('thread', 'cream', 'Cream'),
]

const settings: Partial<SiteSetting> = {
  freeShippingEnabled: false,
  intlSurchargePct: 0,
  personalisationFeeQar: 160,
  personalisationMaxChars: 6,
  personalisationMaxPlacements: 2,
}

const countries = [
  { blockedReason: null, code: 'QA', name: 'Qatar', zoneKey: 'qatar' },
  { blockedReason: null, code: 'AE', name: 'United Arab Emirates', zoneKey: 'uae' },
  {
    blockedReason: 'No reliable carrier service',
    code: 'AF',
    name: 'Afghanistan',
    zoneKey: 'world',
  },
] as unknown as Country[]

const cities = [
  { active: true, feeQar: 20, key: 'doha', name: 'Doha' },
  { active: true, feeQar: 50, key: 'al-khor', name: 'Al Khor & Al Dhakhira' },
] as unknown as ShippingCity[]

const zones = [
  { active: true, feeQar: 150, key: 'uae', name: 'United Arab Emirates' },
  { active: true, feeQar: 300, key: 'world', name: 'Rest of world' },
] as unknown as ShippingZone[]

const shipping = { cities, countries, zones }

const product = { id: 1, priceInQAR: 139900, title: 'Al Shaheen Nights' } as Product
const variantM = { id: 2, priceInQAR: 139900, title: 'M' } as Variant

const context = {
  personalisationRules: personalisationRules(options, settings),
  settings,
  shipping,
}

const contextWith = (overrides: Partial<SiteSetting>) => {
  const merged = { ...settings, ...overrides }
  return {
    personalisationRules: personalisationRules(options, merged),
    settings: merged,
    shipping,
  }
}

const doha = { cityKey: 'doha', countryCode: 'QA' }

describe('money units', () => {
  it('converts the client-edited major units the admin stores', () => {
    // QAR 20 typed into the admin is 2000 to the engine.
    expect(toMinor(20)).toBe(2000)
    expect(toMinor(160)).toBe(16000)
  })
})

describe('shipping', () => {
  it('prices a Doha address from the city table', () => {
    const result = deliveryFor(doha, shipping, settings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.quote.feeQar).toBe(2000)
    expect(result.quote.label).toBe('Delivery to Doha')
  })

  it('charges the higher rate outside greater Doha', () => {
    const result = deliveryFor({ cityKey: 'al-khor', countryCode: 'QA' }, shipping, settings)
    expect(result.ok && result.quote.feeQar).toBe(5000)
  })

  it('prices an international address from its zone', () => {
    const result = deliveryFor({ countryCode: 'AE' }, shipping, settings)
    expect(result.ok && result.quote.feeQar).toBe(15000)
  })

  it('applies the international surcharge without touching Qatar', () => {
    const withSurcharge = { ...settings, intlSurchargePct: 10 }
    expect(deliveryFor({ countryCode: 'AE' }, shipping, withSurcharge)).toMatchObject({
      quote: { feeQar: 16500 },
    })
    // Qatar is a domestic courier run; the fuel surcharge is a freight thing.
    expect(deliveryFor(doha, shipping, withSurcharge)).toMatchObject({ quote: { feeQar: 2000 } })
  })

  it('refuses a blocked country and explains why (C23)', () => {
    const result = deliveryFor({ countryCode: 'AF' }, shipping, settings)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.blocked).toBe(true)
    expect(result.refusal.message).toContain('No reliable carrier service')
  })

  it('refuses Qatar without a city rather than guessing one', () => {
    const result = deliveryFor({ countryCode: 'QA' }, shipping, settings)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('unknownCity')
    expect(result.refusal.blocked).toBe(false)
  })

  it('only offers free shipping when it is switched on', () => {
    expect(qualifiesForFreeShipping(toMinor(2000), { freeShippingThresholdQar: 1500 })).toBe(false)
    expect(
      qualifiesForFreeShipping(toMinor(2000), {
        freeShippingEnabled: true,
        freeShippingThresholdQar: 1500,
      }),
    ).toBe(true)
  })
})

describe('personalisation', () => {
  const rules = personalisationRules(options, settings)

  it('rebuilds a valid placement from our own tables', () => {
    const [line] = normalisePersonalisationList(
      [{ lettering: 'AK', placement: 'pocket', style: 'both', symbol: 'heart', thread: 'gold' }],
      rules,
    )
    expect(line).toMatchObject({
      feeQar: 16000,
      lettering: 'AK',
      placementName: 'Pocket',
      symbolName: 'Heart',
      threadName: 'Gold',
    })
  })

  it('drops a placement we do not offer', () => {
    expect(
      normalisePersonalisationList([{ placement: 'sleeve', style: 'symbol' }], rules),
    ).toHaveLength(0)
  })

  it('falls back to the house mark rather than stitching an unknown symbol', () => {
    const [line] = normalisePersonalisationList(
      [{ placement: 'pocket', style: 'symbol', symbol: 'dragon' }],
      rules,
    )
    expect(line.symbol).toBe('star')
  })

  it('refuses lettering that is asked for but empty', () => {
    expect(
      normalisePersonalisationList(
        [{ lettering: '   ', placement: 'pocket', style: 'text' }],
        rules,
      ),
    ).toHaveLength(0)
  })

  it('strips characters that cannot be embroidered', () => {
    expect(cleanLettering('A🙂K', 6)).toBe('AK')
  })

  it('caps lettering at the configured length', () => {
    expect(cleanLettering('ABCDEFGHIJ', 6)).toBe('ABCDEF')
  })

  it('refuses a second embroidery on the same placement', () => {
    const lines = normalisePersonalisationList(
      [
        { lettering: 'AK', placement: 'pocket', style: 'text' },
        { lettering: 'ZZ', placement: 'pocket', style: 'text' },
      ],
      rules,
    )
    expect(lines).toHaveLength(1)
  })

  it('never exceeds the maximum number of placements', () => {
    const lines = normalisePersonalisationList(
      [
        { lettering: 'A', placement: 'pocket', style: 'text' },
        { lettering: 'B', placement: 'neck', style: 'text' },
        { lettering: 'C', placement: 'cuff', style: 'text' },
      ],
      rules,
    )
    expect(lines).toHaveLength(2)
  })
})

describe('priceOrder', () => {
  it('prices a plain one-piece order to Doha', () => {
    const result = priceOrder(
      { destination: doha, lines: [{ product, quantity: 1, variant: variantM }] },
      context,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // QAR 1,399 + QAR 20 delivery
    expect(result.order.subtotal).toBe(139900)
    expect(result.order.shipping).toBe(2000)
    expect(result.order.total).toBe(141900)
  })

  it('charges the embroidery fee per placement, per garment', () => {
    const result = priceOrder(
      {
        destination: doha,
        lines: [
          {
            personalisation: [
              { lettering: 'AK', placement: 'pocket', style: 'text' },
              { placement: 'cuff', style: 'symbol', symbol: 'star' },
            ],
            product,
            quantity: 2,
            variant: variantM,
          },
        ],
      },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')

    // 2 placements x QAR 160 x 2 garments = QAR 640
    expect(result.order.personalisationTotal).toBe(64000)
    expect(result.order.subtotal).toBe(279800)
    expect(result.order.total).toBe(279800 + 64000 + 2000)
  })

  it('is not fooled by the mixed money units across collections', () => {
    // The regression this guards: 139900 + 20 + 160 would be QAR 1,400.80.
    const result = priceOrder(
      {
        destination: doha,
        lines: [
          {
            personalisation: [{ lettering: 'AK', placement: 'pocket', style: 'text' }],
            product,
            quantity: 1,
          },
        ],
      },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')
    // QAR 1,399 + 160 + 20 = QAR 1,579
    expect(result.order.total).toBe(157900)
  })

  it('takes a percentage off goods but never off delivery', () => {
    const discount: ValidatedDiscount = { code: 'SPIN10', type: 'percent', value: 10 }
    const result = priceOrder(
      { destination: doha, discount, lines: [{ product, quantity: 1 }] },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')

    expect(result.order.discountTotal).toBe(13990)
    expect(result.order.shipping).toBe(2000)
    expect(result.order.total).toBe(139900 - 13990 + 2000)
  })

  it('converts a fixed discount out of the major units the admin stores', () => {
    const discount: ValidatedDiscount = { code: 'QAR100', type: 'fixed', value: 100 }
    const result = priceOrder(
      { destination: doha, discount, lines: [{ product, quantity: 1 }] },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')
    expect(result.order.discountTotal).toBe(10000)
  })

  it('never lets a discount push an order below zero', () => {
    const discount: ValidatedDiscount = { code: 'HUGE', type: 'fixed', value: 99999 }
    const result = priceOrder(
      { destination: doha, discount, lines: [{ product, quantity: 1 }] },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')
    expect(result.order.discountTotal).toBe(139900)
    expect(result.order.total).toBe(2000)
  })

  it('waives delivery on a free-shipping code', () => {
    const discount: ValidatedDiscount = { code: 'FREEDEL', type: 'freeShipping', value: 0 }
    const result = priceOrder(
      { destination: { countryCode: 'AE' }, discount, lines: [{ product, quantity: 1 }] },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')
    expect(result.order.shipping).toBe(0)
    expect(result.order.total).toBe(139900)
  })

  it('waives delivery once the spend threshold is met', () => {
    const result = priceOrder(
      { destination: doha, lines: [{ product, quantity: 1 }] },
      contextWith({ freeShippingEnabled: true, freeShippingThresholdQar: 1000 }),
    )
    if (!result.ok) throw new Error('expected a priced order')
    expect(result.order.freeShippingApplied).toBe(true)
    expect(result.order.shipping).toBe(0)
    expect(result.order.shippingLabel).toContain('compliments')
  })

  it('does not let a discount buy free delivery it no longer qualifies for', () => {
    // QAR 1,399 goods, threshold QAR 1,300, 50% off -> QAR 699.50 of goods.
    const discount: ValidatedDiscount = { code: 'HALF', type: 'percent', value: 50 }
    const result = priceOrder(
      { destination: doha, discount, lines: [{ product, quantity: 1 }] },
      contextWith({ freeShippingEnabled: true, freeShippingThresholdQar: 1300 }),
    )
    if (!result.ok) throw new Error('expected a priced order')
    expect(result.order.freeShippingApplied).toBe(false)
    expect(result.order.shipping).toBe(2000)
  })

  it('refuses to price a basket bound for a blocked country', () => {
    const result = priceOrder(
      { destination: { countryCode: 'AF' }, lines: [{ product, quantity: 1 }] },
      context,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.blocked).toBe(true)
  })

  it('refuses an empty basket', () => {
    const result = priceOrder({ destination: doha, lines: [] }, context)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('emptyBasket')
  })

  it('prefers the variant price over the product price', () => {
    const dearer = { id: 3, priceInQAR: 159900, title: 'L' } as Variant
    const result = priceOrder(
      { destination: doha, lines: [{ product, quantity: 1, variant: dearer }] },
      context,
    )
    if (!result.ok) throw new Error('expected a priced order')
    expect(result.order.subtotal).toBe(159900)
  })

  it('ignores a quantity the browser made up', () => {
    const result = priceOrder({ destination: doha, lines: [{ product, quantity: -5 }] }, context)
    if (!result.ok) throw new Error('expected a priced order')
    expect(result.order.lines[0].quantity).toBe(1)
  })
})
