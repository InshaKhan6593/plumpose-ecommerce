import type { Payload } from 'payload'

import type { Order } from '@/payload-types'

import { qbasZone, zoneLabel } from '@/data/qbasZones'
import { courierStatus } from '@/delivery/qbas/protocol'
import { orderCode } from '@/hooks/orderReference'

import { isEmailEnabled, isUndeliverable, siteUrl } from './config'
import { button, esc, heading, label, layout, paragraph, rule } from './layout'
import { displayPhone, type EmailContent } from './orderEmails'

/**
 * To her, when QBAS reports a delivery that needs a person: failed,
 * postponed, returned, damaged or lost. Once per status per order (see
 * @/delivery/qbas/apply). Goes where new-order alerts go.
 */

export type CourierAlertView = {
  adminUrl: string
  code: string
  customerName: string
  notes: string
  orderCode: string
  phone: string
  status: string
  zone: string
}

export const courierAlert = (view: CourierAlertView): EmailContent => {
  const body = [
    label(`Delivery ${view.orderCode}`),
    heading(esc(view.status)),
    paragraph(
      `QBAS reports <strong>${esc(view.status)}</strong> for order ${esc(view.orderCode)}.${
        view.notes ? ` Their note: “${esc(view.notes)}”.` : ''
      }`,
    ),
    paragraph('Call the customer, or QBAS on +974 3033 8055, to arrange what happens next.'),
    button(view.adminUrl, 'Open the order'),
    rule(),
    label('Customer'),
    paragraph([esc(view.customerName), esc(view.phone), esc(view.zone)].filter(Boolean).join('<br>')),
  ].join('\n')

  const text = [
    `Delivery ${view.orderCode}: ${view.status}`,
    view.notes ? `QBAS note: ${view.notes}` : '',
    '',
    'Call the customer, or QBAS on +974 3033 8055, to arrange what happens next.',
    '',
    view.customerName,
    view.phone,
    view.zone,
    '',
    `Open the order: ${view.adminUrl}`,
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n')

  return {
    html: layout({ body, footer: {}, preheader: `${view.orderCode} — ${view.status}` }),
    subject: `Delivery ${view.status.toLowerCase()} — ${view.orderCode}`,
    text,
  }
}

export const sendCourierAlert = async (
  payload: Payload,
  orderId: number,
  event: { code: string; notes: string },
): Promise<void> => {
  if (!isEmailEnabled()) return
  const order = (await payload
    .findByID({ collection: 'orders', depth: 0, id: orderId, overrideAccess: true })
    .catch(() => null)) as null | Order
  if (!order) return

  const settings = await payload.findGlobal({ depth: 0, overrideAccess: true, slug: 'siteSettings' })
  const to = settings.orderAlertEmail || settings.contactEmail || ''
  if (!to || isUndeliverable(to)) return

  const address = order.shippingAddress ?? {}
  const zone = qbasZone(order.deliveryZone)
  const content = courierAlert({
    adminUrl: `${siteUrl()}/admin/collections/orders/${order.id}`,
    code: event.code,
    customerName: [address.firstName, address.lastName].filter(Boolean).join(' '),
    notes: event.notes,
    orderCode: orderCode(order),
    phone: displayPhone(address.phone, address.country),
    status: courierStatus(event.code).admin,
    zone: zone ? zoneLabel(zone) : '',
  })

  try {
    await payload.sendEmail({ html: content.html, subject: content.subject, text: content.text, to })
    payload.logger.info({ code: event.code, order: orderId }, 'Courier alert sent.')
  } catch (error) {
    payload.logger.error({ err: error, order: orderId }, 'Courier alert failed.')
  }
}
