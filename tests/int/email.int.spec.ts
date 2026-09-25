import type { Order } from '@/payload-types'

import { describe, expect, it } from 'vitest'

import { isEmailEnabled, isUndeliverable, parseFrom } from '@/email/config'
import { esc } from '@/email/layout'
import {
  customerConfirmation,
  ownerNotification,
  shippedNotification,
  toOrderView,
} from '@/email/orderEmails'
import { formatQar } from '@/lib/pricing/money'

/**
 * Order email tests.
 *
 * Pure: the templates are rendered from a fixture order shaped like one read
 * at `depth: 2`, so nothing is sent and no database is needed. The order is
 * the client's own worked example — QAR 1,399 piece, one embroidery placement
 * at QAR 160, delivery to Al Khor at QAR 50, a QAR 100 code — QAR 1,509.
 */

const order = {
  accessToken: 'tok-123',
  amount: 150900,
  createdAt: '',
  customerEmail: 'her@plumpose.com',
  discountCode: 'WELCOME100',
  discountTotalQar: 10000,
  freeShippingApplied: false,
  gift: true,
  giftNote: 'For Mariam <3 — <script>alert(1)</script>',
  id: 1042,
  items: [
    {
      personalisation: [
        {
          feeQar: 16000,
          lettering: 'M.K',
          placement: 'pocket',
          placementName: 'Pocket',
          style: 'both',
          symbol: 'falcon',
          symbolName: 'Falcon',
          thread: 'gold',
          threadName: 'Gold',
        },
      ],
      product: { id: 1, title: 'Al Shaheen Nights — Silk Pyjama Set' },
      quantity: 1,
      variant: { id: 2, options: [{ id: 3, label: 'M' }], title: 'M' },
    },
  ],
  personalisationTotalQar: 16000,
  shippingAddress: {
    addressLine1: 'Villa 12, Street 340',
    city: 'Al Khor',
    country: 'QA',
    firstName: 'Mariam',
    lastName: 'Al-Kuwari',
    phone: '+974 5555 1234',
  },
  shippingLabel: 'Delivery to Al Khor',
  shippingQar: 5000,
  subtotalQar: 139900,
  trackingNumber: 'QP123456789',
  updatedAt: '',
} as unknown as Order

const view = toOrderView(order, {
  adminUrl: 'http://localhost:3000/admin/collections/orders/1042',
  footer: { contactEmail: 'info@plumpose.com', whatsappNumber: '+974 1234 5678' },
  leadTime: '4–10 working days',
  orderUrl: 'http://localhost:3000/orders/1042?accessToken=tok-123',
})

describe('order view', () => {
  it('flattens populated relationships into names', () => {
    expect(view.lines).toEqual([
      {
        embroidery: [
          { fee: 16000, lettering: 'M.K', placement: 'Pocket', symbol: 'Falcon', thread: 'Gold' },
        ],
        quantity: 1,
        size: 'M',
        title: 'Al Shaheen Nights — Silk Pyjama Set',
      },
    ])
  })

  it('writes the country out in full', () => {
    expect(view.address).toContain('Qatar')
  })

  it('degrades rather than throws when relationships are not populated', () => {
    const bare = toOrderView(
      { ...order, items: [{ product: 1, quantity: 2, variant: 2 }] } as unknown as Order,
      { adminUrl: '', footer: {}, leadTime: '', orderUrl: '' },
    )
    expect(bare.lines[0]).toMatchObject({ quantity: 2, size: '', title: 'plumpose piece' })
  })
})

describe('customer confirmation', () => {
  const email = customerConfirmation(view)

  it('shows the breakdown that was charged, adding up to the total', () => {
    for (const figure of [
      'QAR 1,399.00',
      'QAR 160.00',
      'QAR 50.00',
      'QAR 100.00',
      'QAR 1,509.00',
    ]) {
      expect(email.html).toContain(figure)
      expect(email.text).toContain(figure)
    }
    expect(139900 + 16000 + 5000 - 10000).toBe(order.amount)
  })

  it('carries the embroidery the atelier will work', () => {
    expect(email.text).toContain('Embroidery — Pocket: “M.K”, Falcon symbol, in Gold thread')
    expect(email.text).toContain('4–10 working days')
  })

  it('escapes what the customer typed', () => {
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it('links to the order', () => {
    expect(email.html).toContain('href="http://localhost:3000/orders/1042?accessToken=tok-123"')
  })

  it('names the order in the subject', () => {
    expect(email.subject).toBe('Your plumpose order #1042 is confirmed')
  })
})

describe('owner alert', () => {
  const email = ownerNotification(view)

  it('gives the shop what it needs to fulfil', () => {
    for (const detail of ['+974 5555 1234', 'her@plumpose.com', 'Villa 12, Street 340', 'M.K']) {
      expect(email.text).toContain(detail)
    }
    expect(email.html).toContain('/admin/collections/orders/1042')
  })

  it('flags embroidery and gifts up front', () => {
    expect(email.html).toContain('Includes embroidery.')
    expect(email.html).toContain('Gift order.')
  })

  it('puts the total and the customer in the subject', () => {
    expect(email.subject).toBe('New order #1042 — QAR 1,509.00 — Mariam Al-Kuwari')
  })
})

describe('shipped', () => {
  it('includes the tracking number when there is one', () => {
    expect(shippedNotification(view).text).toContain('Tracking number: QP123456789')
  })

  it('still sends without one', () => {
    const email = shippedNotification({ ...view, trackingNumber: '' })
    expect(email.text).not.toContain('Tracking number')
    expect(email.subject).toBe('Your plumpose order #1042 is on its way')
  })
})

describe('email config', () => {
  it('parses a sender with a display name', () => {
    expect(parseFrom('plumpose <orders@plumpose.com>')).toEqual({
      address: 'orders@plumpose.com',
      name: 'plumpose',
    })
    expect(parseFrom('"plumpose <onboarding@resend.dev>"')).toEqual({
      address: 'onboarding@resend.dev',
      name: 'plumpose',
    })
  })

  it('accepts a bare address, and falls back when empty', () => {
    expect(parseFrom('orders@plumpose.com')).toEqual({
      address: 'orders@plumpose.com',
      name: 'plumpose',
    })
    expect(parseFrom('')).toEqual({ address: 'onboarding@resend.dev', name: 'plumpose' })
  })

  it('never sends to reserved test domains', () => {
    for (const address of [
      'shopper@plumpose.local',
      'a@b.test',
      'her@example.com',
      'X@Example.COM',
    ]) {
      expect(isUndeliverable(address)).toBe(true)
    }
    for (const address of ['her@plumpose.com', 'someone@gmail.com', 'a@local.qa']) {
      expect(isUndeliverable(address)).toBe(false)
    }
  })

  it('is off under test, whatever the environment says', () => {
    expect(isEmailEnabled()).toBe(false)
  })
})

describe('helpers', () => {
  it('formats minor units as QAR', () => {
    expect(formatQar(139900)).toBe('QAR 1,399.00')
    expect(formatQar(null)).toBe('QAR 0.00')
  })

  it('escapes every HTML-significant character', () => {
    expect(esc(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })
})
