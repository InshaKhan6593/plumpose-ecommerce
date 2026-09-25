import type { Payload } from 'payload'

import type { SiteSetting } from '@/payload-types'

import { isEmailEnabled, isUndeliverable, siteUrl } from './config'
import { button, esc, heading, label, layout, muted, paragraph, row, rule, table } from './layout'
import { runAfterResponse } from './sendOrderEmail'

/**
 * Stock alerts — an email to the shop when a sale changes stock in a way she
 * asked to hear about (Site settings → Stock alerts):
 *
 *   - **low**      a size falls to the "running low" figure or below
 *   - **soldOut**  a size's last ready piece is sold
 *   - **beyond**   an order takes a size past its stock — made to order, or
 *                  oversold when the product is not made to order
 *
 * Each is a *crossing* worked out from the stock before and after the sale,
 * so a size that is already low does not email again on every later sale.
 * Only sales send alerts — changing a figure in the admin never does.
 */

export type StockEvent = {
  /** Pieces beyond ready stock, for `beyond`. */
  beyond?: number
  kind: 'beyond' | 'low' | 'soldOut'
  label: string
  madeToOrder: boolean
  /** Ready stock after the sale, never below zero. */
  stock: number
}

export type StockAlertSettings = {
  enabled: boolean
  kinds: Set<StockEvent['kind']>
  recipient: null | string
  threshold: number
}

/**
 * Her settings, with the defaults applied. A field she has never saved reads
 * as empty, and empty means "the default", never "off" — only the switches
 * she unticks turn anything off.
 */
export const stockAlertSettings = (settings: Partial<SiteSetting>): StockAlertSettings => {
  const kinds = new Set<StockEvent['kind']>()
  if (settings.alertLowStock !== false) kinds.add('low')
  if (settings.alertSoldOut !== false) kinds.add('soldOut')
  if (settings.alertBeyondStock !== false) kinds.add('beyond')

  return {
    enabled: settings.stockAlertsEnabled !== false,
    kinds,
    recipient:
      settings.stockAlertEmail || settings.orderAlertEmail || settings.contactEmail || null,
    threshold: Math.max(0, settings.lowStockThreshold ?? 2),
  }
}

/**
 * What one sold line did to one size. `before` and `after` are the raw
 * figures around the plugin's decrement — `after` may be negative, which is
 * exactly the "beyond" case. At most one event: the most serious wins.
 */
export const stockEventFor = (args: {
  after: number
  before: number
  label: string
  madeToOrder: boolean
  threshold: number
}): null | StockEvent => {
  const before = Math.max(0, args.before)
  const stock = Math.max(0, args.after)
  const base = { label: args.label, madeToOrder: args.madeToOrder, stock }

  if (args.after < 0) return { ...base, beyond: -args.after, kind: 'beyond' }
  if (before > 0 && stock === 0) return { ...base, kind: 'soldOut' }
  if (before > args.threshold && stock <= args.threshold) return { ...base, kind: 'low' }
  return null
}

const TITLES: Record<StockEvent['kind'], string> = {
  beyond: 'Beyond stock',
  low: 'Running low',
  soldOut: 'Sold out',
}

const describe = (event: StockEvent): string => {
  if (event.kind === 'beyond') {
    return event.madeToOrder
      ? `${event.beyond} to make — the order went beyond ready stock.`
      : `OVERSOLD by ${event.beyond}. Contact the customer.`
  }
  if (event.kind === 'soldOut') {
    return event.madeToOrder
      ? 'None ready. New orders will be made to order.'
      : 'None left. It shows as sold out.'
  }
  return `${event.stock} left.`
}

/** The alert itself — pure, so it can be tested. */
export const buildStockAlert = (args: {
  adminUrl: string
  events: StockEvent[]
  orderId: number
}): { html: string; subject: string; text: string } => {
  const worst = args.events.find((e) => e.kind === 'beyond' && !e.madeToOrder)
    ? 'Oversold'
    : args.events.some((e) => e.kind === 'soldOut')
      ? 'Sold out'
      : args.events.some((e) => e.kind === 'beyond')
        ? 'Made to order'
        : 'Running low'
  const names = [...new Set(args.events.map((e) => e.label))].join(' · ')

  const html = layout({
    body: [
      label(`Stock · order no. ${args.orderId}`),
      heading(worst === 'Oversold' ? 'An order went beyond stock' : 'Stock has changed'),
      table(
        args.events
          .map((e) => row(`${esc(e.label)} — ${esc(TITLES[e.kind])}`, esc(describe(e))))
          .join(''),
      ),
      rule(),
      paragraph('Update the figures under Shop → Sizes &amp; stock when new pieces are ready.'),
      button(args.adminUrl, 'Open sizes & stock'),
      muted(
        'You get this because stock alerts are on in Site settings → Stock alerts, where you can change them or turn them off.',
      ),
    ].join('\n'),
    footer: {},
    preheader: `${worst}: ${names}`,
  })

  const text = [
    `${worst} — order no. ${args.orderId}`,
    ...args.events.map((e) => `${e.label} — ${TITLES[e.kind]}: ${describe(e)}`),
    '',
    `Sizes & stock: ${args.adminUrl}`,
    'Change or turn off these emails in Site settings → Stock alerts.',
  ].join('\n')

  return { html, subject: `${worst}: ${names}`.slice(0, 150), text }
}

/**
 * Sends the alert for one sale, once the response has gone and the order has
 * committed — the rule every shop email follows (./sendOrderEmail.ts). The
 * order is re-read on a fresh connection; if it rolled back, nothing is sent.
 */
export const scheduleStockAlert = (
  payload: Payload,
  args: { events: StockEvent[]; orderId: number; settings: StockAlertSettings },
) => {
  const events = args.events.filter((e) => args.settings.kinds.has(e.kind))
  const to = args.settings.recipient
  if (!args.settings.enabled || !events.length || !to || isUndeliverable(to) || !isEmailEnabled())
    return

  runAfterResponse(payload, async () => {
    const committed = await payload
      .findByID({ collection: 'orders', depth: 0, id: args.orderId, overrideAccess: true })
      .catch(() => null)
    if (!committed) return

    const email = buildStockAlert({
      adminUrl: `${siteUrl()}/admin/collections/variants`,
      events,
      orderId: args.orderId,
    })
    try {
      await payload.sendEmail({ ...email, to })
      payload.logger.info(
        { events: events.map((e) => `${e.kind}:${e.label}`), order: args.orderId },
        'Stock alert sent.',
      )
    } catch (error) {
      payload.logger.error({ err: error, order: args.orderId }, 'Stock alert failed.')
    }
  })
}
