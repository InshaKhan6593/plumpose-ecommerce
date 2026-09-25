import type { Order, Subscriber } from '@/payload-types'

import type { Footer } from '@/email/layout'
import { toOrderView } from '@/email/orderEmails'

import { type Cell, dohaTime, riyals } from './csv'

/**
 * The columns of each spreadsheet, in her words, one row per record. Orders
 * reuse the confirmation email's reading of an order (toOrderView), so the
 * items, sizes and embroidery read exactly as the customer was told.
 */

const ORDER_STATUS: Record<string, string> = { cancelled: 'Cancelled', completed: 'Completed', processing: 'Paid', refunded: 'Refunded' }
const FULFILMENT: Record<string, string> = { delivered: 'Delivered', inAtelier: 'In the atelier', shipped: 'Shipped', unfulfilled: 'Awaiting fulfilment' }
const SOURCE: Record<string, string> = { checkout: 'Checkout', footer: 'Footer signup', manual: 'Added by hand', spinWheel: 'Reward wheel' }

export const ORDER_COLUMNS = [
  'Order',
  'Date (Doha)',
  'Payment',
  'Fulfilment',
  'Tracking number',
  'Customer',
  'Email',
  'Phone',
  'Address',
  'City',
  'Country',
  'Pieces',
  'Items',
  'Embroidery',
  'Goods (QAR)',
  'Embroidery (QAR)',
  'Delivery (QAR)',
  'Discount (QAR)',
  'Discount code',
  'Total (QAR)',
  'Gift',
  'Gift note',
  'Internal notes',
]

export function orderRow(order: Order): Cell[] {
  const view = toOrderView(order, { adminUrl: '', footer: {} as Footer, leadTime: '', orderUrl: '' })
  const address = order.shippingAddress ?? {}
  const street = [address.company, address.addressLine1, address.addressLine2, address.postalCode].filter(Boolean).join(', ')
  const items = view.lines.map((l) => `${l.quantity} × ${l.title}${l.size ? ` (${l.size})` : ''}`).join('; ')
  const embroidery = view.lines
    .flatMap((l) =>
      l.embroidery.map((e) =>
        [`${l.title.split(' — ')[0]}: ${e.placement}`, e.lettering ? `"${e.lettering}"` : '', e.symbol ? `${e.symbol} symbol` : '', e.thread ? `${e.thread} thread` : '']
          .filter(Boolean)
          .join(', '),
      ),
    )
    .join('; ')

  return [
    order.id,
    dohaTime(order.createdAt),
    ORDER_STATUS[order.status ?? ''] ?? order.status ?? '',
    FULFILMENT[order.fulfilment ?? ''] ?? '',
    order.trackingNumber ?? '',
    view.customerName,
    view.customerEmail,
    view.phone,
    street,
    [address.city, address.state].filter(Boolean).join(', '),
    // toOrderView ends the address with the country's name when there is one.
    address.country ? view.address[view.address.length - 1] : '',
    view.lines.reduce((n, l) => n + (l.quantity || 0), 0),
    items,
    embroidery,
    riyals(view.totals.pieces),
    riyals(view.totals.embroidery),
    riyals(view.totals.shipping),
    riyals(view.totals.discount),
    view.discountCode,
    riyals(view.totals.total),
    view.gift,
    view.giftNote,
    order.adminNotes ?? '',
  ]
}

export const SUBSCRIBER_COLUMNS = ['Email', 'Joined (Doha)', 'Signed up from', 'Unsubscribed']

export const subscriberRow = (s: Subscriber): Cell[] => [s.email, dohaTime(s.createdAt), SOURCE[s.source ?? ''] ?? '', Boolean(s.unsubscribed)]
