import type { Endpoint, PayloadRequest, Where } from 'payload'

import type { Order, Subscriber } from '@/payload-types'

import { checkRole } from '@/access/utilities'
import { exportFilename, toCsv } from '@/lib/exports/csv'
import { ORDER_COLUMNS, orderRow, SUBSCRIBER_COLUMNS, subscriberRow } from '@/lib/exports/rows'

/**
 * Spreadsheet downloads for the admin (REQUIREMENTS A6 orders, S19 / A17
 * newsletter subscribers).
 *
 *   GET /api/exports/orders       every order, or those the list is filtered to
 *   GET /api/exports/subscribers  the newsletter list
 *
 * Admin only: an order export is every customer's name, email, phone and
 * address. The button above each list passes on that list's filter, so
 * "Shipped this week" downloads just those.
 */

const csvResponse = (body: string, what: string): Response =>
  new Response(body, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${exportFilename(what)}"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  })

const refuse = (): Response =>
  new Response(JSON.stringify({ error: 'Only an admin can download this.' }), { headers: { 'Content-Type': 'application/json' }, status: 403 })

const isAdmin = (req: PayloadRequest) => Boolean(req.user && checkRole(['admin'], req.user as never))

/** The list's own filter, as the admin passes it in the URL (?where[...]). */
const whereOf = (req: PayloadRequest): undefined | Where => {
  const where = (req.query as { where?: unknown } | undefined)?.where
  return where && typeof where === 'object' ? (where as Where) : undefined
}

export const ordersExportEndpoint: Endpoint = {
  handler: async (req) => {
    if (!isAdmin(req)) return refuse()
    const { docs } = await req.payload.find({
      collection: 'orders',
      depth: 2,
      overrideAccess: false,
      pagination: false,
      req,
      sort: '-createdAt',
      where: whereOf(req),
    })
    return csvResponse(toCsv(ORDER_COLUMNS, (docs as Order[]).map(orderRow)), 'orders')
  },
  method: 'get',
  path: '/exports/orders',
}

export const subscribersExportEndpoint: Endpoint = {
  handler: async (req) => {
    if (!isAdmin(req)) return refuse()
    const { docs } = await req.payload.find({
      collection: 'subscribers',
      depth: 0,
      overrideAccess: false,
      pagination: false,
      req,
      sort: '-createdAt',
      where: whereOf(req),
    })
    return csvResponse(toCsv(SUBSCRIBER_COLUMNS, (docs as Subscriber[]).map(subscriberRow)), 'subscribers')
  },
  method: 'get',
  path: '/exports/subscribers',
}
