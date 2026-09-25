import { describe, expect, it } from 'vitest'

import { GIFT_NOTE_MAX, itemsForGateway, readCheckoutDetails } from '@/payments/checkout'
import { customerEmailOf } from '@/email/orderEmails'
import { orderTotalsFromSnapshot, type PricingSnapshot } from '@/payments/finaliseOrder'

/**
 * The pieces of the checkout flow that run without the gateway: reading what
 * the checkout form sends, flattening the bag the way the transaction records
 * it, and carrying the delivery details onto the order.
 */

describe('readCheckoutDetails', () => {
  const form = {
    discountCode: ' welcome10 ',
    gift: true,
    giftNote: 'Happy birthday',
    shippingAddress: {
      addressLine1: 'Building 12',
      addressLine2: 'Zone 66',
      city: 'Doha',
      country: 'qa',
      firstName: 'Mariam',
      lastName: 'Al-Thani',
      phone: '+974 5555 1234',
      postalCode: '',
    },
    shippingCityKey: 'doha',
  }

  it('reads the address, city key, code and gift note', () => {
    const details = readCheckoutDetails(form)
    expect(details.address).toMatchObject({ city: 'Doha', country: 'QA', firstName: 'Mariam' })
    expect(details.cityKey).toBe('doha')
    expect(details.discountCode).toBe('WELCOME10')
    expect(details).toMatchObject({ gift: true, giftNote: 'Happy birthday' })
  })

  it('drops the gift note when it is not a gift', () => {
    expect(readCheckoutDetails({ ...form, gift: false }).giftNote).toBe('')
  })

  it('treats only a real `true` as a gift', () => {
    expect(readCheckoutDetails({ ...form, gift: 'yes' }).gift).toBe(false)
  })

  it('bounds what is stored', () => {
    const long = readCheckoutDetails({
      ...form,
      giftNote: 'x'.repeat(5000),
      shippingAddress: {
        ...form.shippingAddress,
        addressLine1: 'y'.repeat(5000),
        country: 'QATAR',
      },
    })
    expect(long.giftNote).toHaveLength(GIFT_NOTE_MAX)
    expect(long.address.addressLine1).toHaveLength(120)
    expect(long.address.country).toBe('QA')
  })

  it('replaces control characters instead of storing them', () => {
    const details = readCheckoutDetails({ ...form, giftNote: 'line one\nline two\u0000' })
    expect(details.giftNote).toBe('line one line two')
  })

  it('survives a missing or malformed body', () => {
    for (const body of [undefined, null, 'nonsense', { shippingAddress: 'x' }]) {
      const details = readCheckoutDetails(body)
      expect(details.cityKey).toBeNull()
      expect(details.discountCode).toBeNull()
      expect(details.address.country).toBe('')
    }
  })
})

describe('itemsForGateway', () => {
  it('flattens relationships to ids and leaves personalisation and row ids out', () => {
    const items = itemsForGateway([
      {
        id: 'row-1',
        personalisation: [{ lettering: 'AK' }],
        product: { id: 1, title: 'Al Shaheen Nights' },
        quantity: 2,
        variant: { id: 2 },
      },
    ])
    // The transaction has no personalisation field (it is read back from the
    // cart's pricing snapshot), and a row id copied from the bag would collide
    // when the same bag is paid for a second time.
    expect(items).toEqual([{ product: 1, quantity: 2, variant: 2 }])
  })

  it('omits the variant key entirely when there is none', () => {
    expect(itemsForGateway([{ product: 1, quantity: 1 }])).toEqual([{ product: 1, quantity: 1 }])
  })
})

describe('orderTotalsFromSnapshot with delivery details', () => {
  const snapshot: PricingSnapshot = {
    delivery: {
      address: {
        addressLine1: 'Building 12',
        addressLine2: '',
        city: 'Doha',
        country: 'QA',
        firstName: 'Mariam',
        lastName: 'Al-Thani',
        phone: '+974 5555 1234',
        postalCode: '',
      },
      gift: true,
      giftNote: 'With love',
    },
    discountCode: '',
    discountTotal: 0,
    freeShippingApplied: false,
    lines: [],
    personalisationTotal: 0,
    shipping: 2000,
    shippingLabel: 'Delivery to Doha',
    shippingZone: 'qatar',
    subtotal: 139900,
    total: 141900,
  }

  it('puts the address and gift note on the order', () => {
    const totals = orderTotalsFromSnapshot(snapshot)
    expect(totals.shippingAddress).toMatchObject({ city: 'Doha', phone: '+974 5555 1234' })
    expect(totals).toMatchObject({ gift: true, giftNote: 'With love', shippingQar: 2000 })
  })

  it('never keeps a gift note on an order that is not a gift', () => {
    const totals = orderTotalsFromSnapshot({
      ...snapshot,
      delivery: { ...snapshot.delivery!, gift: false },
    })
    expect(totals.gift).toBe(false)
    expect(totals.giftNote).toBeUndefined()
  })

  it('leaves delivery fields alone for a snapshot written before they existed', () => {
    const { delivery: _gone, ...older } = snapshot
    const totals = orderTotalsFromSnapshot(older)
    expect(totals).not.toHaveProperty('shippingAddress')
    expect(totals).not.toHaveProperty('gift')
  })
})

describe('customerEmailOf', () => {
  it('uses the address a guest typed', () => {
    expect(customerEmailOf({ customer: null, customerEmail: 'guest@example.com' })).toBe(
      'guest@example.com',
    )
  })

  it("falls back to a signed-in customer's account, whose orders carry no customerEmail", () => {
    const customer = { email: 'member@example.com', id: 7 } as never
    expect(customerEmailOf({ customer, customerEmail: null })).toBe('member@example.com')
  })

  it('returns nothing rather than guessing when the account is not loaded', () => {
    expect(customerEmailOf({ customer: 7, customerEmail: null })).toBe('')
  })
})
