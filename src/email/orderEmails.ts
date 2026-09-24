import type { Order, Product, Variant, VariantOption } from '@/payload-types'

import { formatQar, type Minor } from '@/lib/pricing/money'

import {
  button,
  esc,
  type Footer,
  heading,
  label,
  layout,
  muted,
  palette,
  paragraph,
  row,
  rule,
  table,
} from './layout'

/**
 * The three order emails, as pure functions of an order.
 *
 * They take a flattened `OrderView` rather than the raw `Order` so they can be
 * rendered and tested without a database, and so the one awkward step —
 * turning populated relationships into names — happens once, in `toOrderView`.
 *
 * **No per-line prices.** An order line records product, size and quantity,
 * not the unit price paid; today's product price may have changed since. The
 * money shown is the breakdown stored on the order at payment, which is
 * exactly what was charged.
 */

export type EmailContent = { html: string; subject: string; text: string }

type EmbroideryView = {
  fee: Minor
  lettering: string
  placement: string
  symbol: string
  thread: string
}

export type OrderLineView = {
  embroidery: EmbroideryView[]
  quantity: number
  size: string
  title: string
}

export type OrderView = {
  address: string[]
  adminUrl: string
  customerEmail: string
  customerName: string
  discountCode: string
  firstName: string
  footer: Footer
  freeShippingApplied: boolean
  gift: boolean
  giftNote: string
  id: number
  leadTime: string
  lines: OrderLineView[]
  orderUrl: string
  phone: string
  shippingLabel: string
  totals: {
    discount: Minor
    embroidery: Minor
    pieces: Minor
    shipping: Minor
    total: Minor
  }
  trackingNumber: string
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

const countryName = (code: null | string | undefined): string => {
  if (!code) return ''
  try {
    return regionNames?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

type OrderItem = NonNullable<Order['items']>[number]

const sizeOf = (variant: OrderItem['variant']): string => {
  if (!variant || typeof variant !== 'object') return ''
  const v = variant as Variant
  const options = (v.options ?? [])
    .map((option) => (typeof option === 'object' ? (option as VariantOption).label : ''))
    .filter(Boolean)
  return options.length ? options.join(' / ') : (v.title ?? '')
}

/**
 * Who placed the order. A guest's order carries the address they typed; a
 * signed-in customer's carries their account instead (the plugin links the
 * customer and leaves `customerEmail` empty), so the email comes from there.
 */
export const customerEmailOf = (order: Pick<Order, 'customer' | 'customerEmail'>): string =>
  order.customerEmail || (typeof order.customer === 'object' ? (order.customer?.email ?? '') : '')

/**
 * Flattens an order read at `depth: 2` (items → product/variant → options).
 * Anything unpopulated degrades to an empty string rather than throwing: an
 * email with a missing size is better than no email.
 */
export const toOrderView = (
  order: Order,
  ctx: { adminUrl: string; footer: Footer; leadTime: string; orderUrl: string },
): OrderView => {
  const address = order.shippingAddress ?? {}
  const firstName = (address.firstName ?? '').trim()
  const customerName = [address.firstName, address.lastName].filter(Boolean).join(' ').trim()

  const lines: OrderLineView[] = (order.items ?? []).map((item) => {
    const product = item.product && typeof item.product === 'object' ? (item.product as Product) : null

    return {
      embroidery: (item.personalisation ?? []).map((p) => ({
        fee: p.feeQar ?? 0,
        lettering: p.lettering ?? '',
        placement: p.placementName || p.placement,
        symbol: p.symbolName || p.symbol || '',
        thread: p.threadName || p.thread || '',
      })),
      quantity: item.quantity,
      size: sizeOf(item.variant),
      title: product?.title ?? 'plumpose piece',
    }
  })

  return {
    address: [
      customerName,
      address.company,
      address.addressLine1,
      address.addressLine2,
      [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
      countryName(address.country),
    ].filter((part): part is string => Boolean(part && String(part).trim())),
    adminUrl: ctx.adminUrl,
    customerEmail: customerEmailOf(order),
    customerName,
    discountCode: order.discountCode ?? '',
    firstName,
    footer: ctx.footer,
    freeShippingApplied: Boolean(order.freeShippingApplied),
    gift: Boolean(order.gift),
    giftNote: order.giftNote ?? '',
    id: order.id,
    leadTime: ctx.leadTime,
    lines,
    orderUrl: ctx.orderUrl,
    phone: address.phone ?? '',
    shippingLabel: order.shippingLabel ?? '',
    totals: {
      discount: order.discountTotalQar ?? 0,
      embroidery: order.personalisationTotalQar ?? 0,
      pieces: order.subtotalQar ?? 0,
      shipping: order.shippingQar ?? 0,
      total: order.amount ?? 0,
    },
    trackingNumber: order.trackingNumber ?? '',
  }
}

/* ------------------------------------------------------------ fragments -- */

const embroideryText = (e: EmbroideryView): string =>
  [
    e.lettering ? `“${e.lettering}”` : '',
    e.symbol ? `${e.symbol} symbol` : '',
    e.thread ? `in ${e.thread} thread` : '',
  ]
    .filter(Boolean)
    .join(', ')

const linesHtml = (lines: OrderLineView[]): string =>
  lines
    .map((line) => {
      const meta = [line.size ? `Size ${esc(line.size)}` : '', `Qty ${line.quantity}`]
        .filter(Boolean)
        .join(' &nbsp;·&nbsp; ')

      const embroidery = line.embroidery
        .map(
          (e) =>
            `<div style="font-size:13px;color:${palette.inkSoft};margin-top:4px;">Embroidery — ${esc(e.placement)}: ${esc(embroideryText(e))}</div>`,
        )
        .join('')

      return (
        `<tr><td style="padding:14px 0;border-bottom:1px solid ${palette.line};font-family:'Jost',Helvetica,Arial,sans-serif;">` +
        `<div style="font-size:15px;color:${palette.ink};">${esc(line.title)}</div>` +
        `<div style="font-size:13px;color:${palette.inkSoft};margin-top:4px;">${meta}</div>` +
        embroidery +
        `</td></tr>`
      )
    })
    .join('')

const totalsHtml = (view: OrderView): string => {
  const t = view.totals
  const rows = [row('Pieces', formatQar(t.pieces))]

  if (t.embroidery > 0) rows.push(row('Embroidery', formatQar(t.embroidery)))

  rows.push(
    row(
      esc(view.shippingLabel || 'Delivery'),
      t.shipping > 0 ? formatQar(t.shipping) : 'Complimentary',
    ),
  )

  if (t.discount > 0) {
    rows.push(
      row(`Discount${view.discountCode ? ` (${esc(view.discountCode)})` : ''}`, `− ${formatQar(t.discount)}`),
    )
  }

  rows.push(
    `<tr><td colspan="2" style="border-top:1px solid ${palette.line};padding-top:6px;"></td></tr>`,
    row('Total paid', formatQar(t.total), { strong: true }),
  )

  return table(rows.join(''))
}

const addressHtml = (view: OrderView): string =>
  view.address.map((line) => esc(line)).join('<br>')

const linesText = (lines: OrderLineView[]): string =>
  lines
    .map((line) => {
      const head = `- ${line.title}${line.size ? `, size ${line.size}` : ''} × ${line.quantity}`
      const emb = line.embroidery.map((e) => `    Embroidery — ${e.placement}: ${embroideryText(e)}`)
      return [head, ...emb].join('\n')
    })
    .join('\n')

const totalsText = (view: OrderView): string => {
  const t = view.totals
  return [
    `Pieces: ${formatQar(t.pieces)}`,
    t.embroidery > 0 ? `Embroidery: ${formatQar(t.embroidery)}` : '',
    `${view.shippingLabel || 'Delivery'}: ${t.shipping > 0 ? formatQar(t.shipping) : 'Complimentary'}`,
    t.discount > 0 ? `Discount${view.discountCode ? ` (${view.discountCode})` : ''}: −${formatQar(t.discount)}` : '',
    `Total paid: ${formatQar(t.total)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

const hasEmbroidery = (view: OrderView): boolean => view.lines.some((l) => l.embroidery.length > 0)

/* --------------------------------------------------------------- emails -- */

/** To the customer, once payment is confirmed. */
export const customerConfirmation = (view: OrderView): EmailContent => {
  const greeting = view.firstName ? `Thank you, ${view.firstName}.` : 'Thank you.'
  const embroideryNote = hasEmbroidery(view)
    ? ` Your embroidery is worked by hand, so please allow ${esc(view.leadTime || 'a few extra days')} before it leaves the atelier.`
    : ''

  const body = [
    label(`Order #${view.id}`),
    heading(greeting),
    paragraph(
      `Your order is confirmed and we have started preparing it.${embroideryNote} We will write again as soon as it is on its way.`,
    ),
    rule(),
    label('Your order'),
    table(linesHtml(view.lines)),
    `<div style="height:16px;"></div>`,
    totalsHtml(view),
    rule(),
    label('Delivering to'),
    paragraph(addressHtml(view)),
    view.gift
      ? label('Gift') +
        paragraph(
          `Wrapped as a gift, without a price on the invoice.${view.giftNote ? `<br><em>“${esc(view.giftNote)}”</em>` : ''}`,
        )
      : '',
    view.orderUrl ? `<div style="height:8px;"></div>${button(view.orderUrl, 'View your order')}` : '',
    rule(),
    muted('Questions about your order? Simply reply to this email.'),
  ].join('\n')

  const text = [
    `plumpose — Order #${view.id}`,
    '',
    greeting,
    `Your order is confirmed and we have started preparing it.${hasEmbroidery(view) ? ` Your embroidery is worked by hand, so please allow ${view.leadTime || 'a few extra days'} before it leaves the atelier.` : ''} We will write again as soon as it is on its way.`,
    '',
    linesText(view.lines),
    '',
    totalsText(view),
    '',
    'Delivering to:',
    ...view.address,
    view.gift ? `\nGift${view.giftNote ? `: “${view.giftNote}”` : ''}` : '',
    view.orderUrl ? `\nView your order: ${view.orderUrl}` : '',
    '',
    'Questions about your order? Simply reply to this email.',
  ].join('\n')

  return {
    html: layout({ body, footer: view.footer, preheader: `Order #${view.id} is confirmed — ${formatQar(view.totals.total)}` }),
    subject: `Your plumpose order #${view.id} is confirmed`,
    text,
  }
}

/**
 * To the owner. Carries what the atelier and the courier need — phone,
 * address, embroidery instructions — and a link straight to the order.
 */
export const ownerNotification = (view: OrderView): EmailContent => {
  const who = view.customerName || view.customerEmail

  const contact = [
    esc(view.customerName),
    `<a href="mailto:${esc(view.customerEmail)}" style="color:${palette.ink};">${esc(view.customerEmail)}</a>`,
    view.phone ? esc(view.phone) : '',
  ]
    .filter(Boolean)
    .join('<br>')

  const body = [
    label(`New order #${view.id}`),
    heading(formatQar(view.totals.total)),
    paragraph(`From ${esc(who)}.${hasEmbroidery(view) ? ' <strong>Includes embroidery.</strong>' : ''}${view.gift ? ' <strong>Gift order.</strong>' : ''}`),
    button(view.adminUrl, 'Open the order'),
    rule(),
    label('Pieces'),
    table(linesHtml(view.lines)),
    `<div style="height:16px;"></div>`,
    totalsHtml(view),
    rule(),
    label('Customer'),
    paragraph(contact),
    label('Delivering to'),
    paragraph(addressHtml(view)),
    view.gift
      ? label('Gift') + paragraph(view.giftNote ? `“${esc(view.giftNote)}”` : 'No card message.')
      : '',
  ].join('\n')

  const text = [
    `New order #${view.id} — ${formatQar(view.totals.total)}`,
    `From ${who}`,
    '',
    linesText(view.lines),
    '',
    totalsText(view),
    '',
    'Customer:',
    view.customerName,
    view.customerEmail,
    view.phone,
    '',
    'Delivering to:',
    ...view.address,
    view.gift ? `\nGift${view.giftNote ? `: “${view.giftNote}”` : ''}` : '',
    '',
    `Open the order: ${view.adminUrl}`,
  ].join('\n')

  return {
    html: layout({ body, footer: {}, preheader: `${who} — ${formatQar(view.totals.total)}` }),
    subject: `New order #${view.id} — ${formatQar(view.totals.total)} — ${who}`,
    text,
  }
}

/** To the customer, when the order is marked Shipped. */
export const shippedNotification = (view: OrderView): EmailContent => {
  const greeting = view.firstName ? `It’s on its way, ${view.firstName}.` : 'It’s on its way.'

  const body = [
    label(`Order #${view.id}`),
    heading(greeting),
    paragraph('Your order has left the atelier.'),
    view.trackingNumber
      ? label('Tracking number') +
        `<div style="font-family:'Jost',Helvetica,Arial,sans-serif;font-size:18px;letter-spacing:0.06em;color:${palette.ink};margin:0 0 16px;">${esc(view.trackingNumber)}</div>`
      : '',
    rule(),
    label('In this parcel'),
    table(linesHtml(view.lines)),
    rule(),
    label('Delivering to'),
    paragraph(addressHtml(view)),
    view.orderUrl ? button(view.orderUrl, 'View your order') : '',
    rule(),
    muted('Questions about your delivery? Simply reply to this email.'),
  ].join('\n')

  const text = [
    `plumpose — Order #${view.id}`,
    '',
    greeting,
    'Your order has left the atelier.',
    view.trackingNumber ? `Tracking number: ${view.trackingNumber}` : '',
    '',
    linesText(view.lines),
    '',
    'Delivering to:',
    ...view.address,
    view.orderUrl ? `\nView your order: ${view.orderUrl}` : '',
    '',
    'Questions about your delivery? Simply reply to this email.',
  ].join('\n')

  return {
    html: layout({ body, footer: view.footer, preheader: view.trackingNumber ? `Tracking number ${view.trackingNumber}` : `Order #${view.id} has shipped` }),
    subject: `Your plumpose order #${view.id} is on its way`,
    text,
  }
}
