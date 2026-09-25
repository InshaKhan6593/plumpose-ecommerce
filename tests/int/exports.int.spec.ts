import { describe, expect, it } from 'vitest'

import type { Order, Subscriber } from '@/payload-types'

import { csvCell, dohaTime, exportFilename, riyals, toCsv } from '@/lib/exports/csv'
import { ORDER_COLUMNS, orderRow, SUBSCRIBER_COLUMNS, subscriberRow } from '@/lib/exports/rows'

/** Spreadsheet downloads (REQUIREMENTS A6, S19, A17). The endpoint itself is exercised over HTTP in the admin check. */

describe('exports — cells a spreadsheet reads safely', () => {
  it('quotes a cell with a comma, a quote or a line break', () => {
    expect(csvCell('Doha, Qatar')).toBe('"Doha, Qatar"')
    expect(csvCell('the "silk" one')).toBe('"the ""silk"" one"')
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
    expect(csvCell('plain')).toBe('plain')
  })

  it('never lets a customer’s text run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil","click")')).toBe(
      `"'=HYPERLINK(""http://evil"",""click"")"`,
    )
    expect(csvCell('+97455551234')).toBe("'+97455551234")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('-cmd')).toBe("'-cmd")
  })

  it('leaves real numbers as numbers, and writes yes / no', () => {
    expect(csvCell(-20)).toBe('-20')
    expect(csvCell('-20')).toBe('-20')
    expect(csvCell(1399)).toBe('1399')
    expect(csvCell(true)).toBe('Yes')
    expect(csvCell(null)).toBe('')
  })

  it('starts with a byte-order mark so Excel reads Arabic names, and ends lines as Excel expects', () => {
    const csv = toCsv(['Name'], [['مريم']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toBe('\uFEFFName\r\nمريم\r\n')
  })

  it('writes riyals, Doha time and a dated file name', () => {
    expect(riyals(139900)).toBe(1399)
    expect(riyals(null)).toBe(0)
    expect(dohaTime('2026-09-25T21:30:00Z')).toBe('2026-09-26 00:30')
    expect(exportFilename('orders', new Date('2026-09-25T21:30:00Z'))).toBe(
      'plumpose-orders-2026-09-26.csv',
    )
  })
})

describe('exports — an order, one row, in her words', () => {
  const order = {
    adminNotes: 'Call before delivery',
    amount: 157900,
    createdAt: '2026-09-25T09:00:00Z',
    customerEmail: 'mariam@example.com',
    discountCode: '',
    discountTotalQar: 0,
    fulfilment: 'inAtelier',
    gift: true,
    giftNote: 'Happy birthday, sister',
    id: 17,
    items: [
      {
        personalisation: [
          {
            feeQar: 16000,
            lettering: 'M.K',
            placement: 'pocket',
            placementName: 'Pocket',
            style: 'initials',
            thread: 'gold',
            threadName: 'Gold',
          },
        ],
        product: { id: 1, title: 'Al Shaheen Nights — Silk Pyjama Set' },
        quantity: 1,
        variant: {
          id: 2,
          options: [{ label: 'M' }],
          title: 'Al Shaheen Nights — Silk Pyjama Set — M',
        },
      },
    ],
    personalisationTotalQar: 16000,
    shippingAddress: {
      addressLine1: 'Building 12, Street 870',
      city: 'Doha',
      country: 'QA',
      firstName: 'Mariam',
      lastName: 'Al-Thani',
      phone: '+974 5555 1234',
    },
    shippingQar: 2000,
    status: 'processing',
    subtotalQar: 139900,
    trackingNumber: '',
  } as unknown as Order

  const row = Object.fromEntries(ORDER_COLUMNS.map((c, i) => [c, orderRow(order)[i]]))

  it('has one value per column', () => {
    expect(orderRow(order)).toHaveLength(ORDER_COLUMNS.length)
  })

  it('reads as the customer was told', () => {
    expect(row).toMatchObject({
      Customer: 'Mariam Al-Thani',
      'Date (Doha)': '2026-09-25 12:00',
      'Delivery (QAR)': 20,
      Email: 'mariam@example.com',
      'Embroidery (QAR)': 160,
      Fulfilment: 'In the atelier',
      Gift: true,
      'Gift note': 'Happy birthday, sister',
      'Goods (QAR)': 1399,
      'Internal notes': 'Call before delivery',
      Order: 17,
      Payment: 'Paid',
      Pieces: 1,
      'Total (QAR)': 1579,
    })
    expect(row['Items']).toBe('1 × Al Shaheen Nights — Silk Pyjama Set (M)')
    expect(row['Embroidery']).toBe('Al Shaheen Nights: Pocket, "M.K", Gold thread')
    expect(row['Country']).toBe('Qatar')
  })

  it('a subscriber row names where they signed up', () => {
    const s = {
      createdAt: '2026-09-25T09:00:00Z',
      email: 'a@b.qa',
      source: 'spinWheel',
      unsubscribed: false,
    } as Subscriber
    expect(subscriberRow(s)).toEqual(['a@b.qa', '2026-09-25 12:00', 'Reward wheel', false])
    expect(subscriberRow(s)).toHaveLength(SUBSCRIBER_COLUMNS.length)
  })
})
