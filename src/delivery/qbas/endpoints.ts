import type { Endpoint, PayloadRequest } from 'payload'

import { timingSafeEqual } from 'node:crypto'

import type { Order } from '@/payload-types'

import { checkRole } from '@/access/utilities'
import { qbasZone, zoneLabel } from '@/data/qbasZones'

import { cancelShipment, createShipment, labelUrl, packageStatus, QbasError } from './api'
import { applyCourierStatus, orderByBarcode } from './apply'
import { qbasConfig, qbasMissing } from './config'
import {
  bookingProblems,
  courierStatus,
  isFinal,
  isRebookable,
  shipmentRequest,
} from './protocol'

/**
 * The courier, from the order screen and from QBAS.
 *
 * On an order (admin and staff), under `/api/orders/:id/courier`:
 *
 * | | |
 * |---|---|
 * | `GET` | What the Courier panel shows |
 * | `POST …/zone` | Change the delivery zone (before booking) |
 * | `POST …/book` | "Send to QBAS" — books the pickup; the tracking number fills in |
 * | `POST …/label` | The shipping label PDF |
 * | `POST …/check` | Ask QBAS where the parcel is, now |
 * | `POST …/cancel` | Cancel the booking; the order can be sent again |
 *
 * From QBAS: `POST /api/delivery/qbas/webhook?key=…` — its status updates,
 * authenticated by the secret in the address (QBAS signs nothing). And
 * `GET /api/delivery/qbas/check`, Vercel Cron with `CRON_SECRET`: asks QBAS
 * about every parcel still on its way, so the order moves even if a webhook
 * never comes. Daily while the project is on Vercel Hobby (which refuses
 * anything more often); every 30 minutes once it is on Pro (change the
 * schedule in vercel.json). The customer's order page also asks, when it is opened.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    status,
  })

const staffOnly = (req: PayloadRequest) => checkRole(['admin', 'staff'], req.user)

const loadOrder = async (req: PayloadRequest): Promise<null | Order> => {
  const id = Number(req.routeParams?.id)
  if (!Number.isInteger(id) || id <= 0) return null
  return (await req.payload
    .findByID({ collection: 'orders', depth: 0, id, overrideAccess: true, req })
    .catch(() => null)) as null | Order
}

const readBody = async (req: PayloadRequest): Promise<Record<string, unknown>> => {
  try {
    const body = req.json ? await req.json() : {}
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const failure = (error: unknown) =>
  error instanceof QbasError
    ? error.message
    : 'Something went wrong talking to QBAS. Try again in a minute.'

/** What the Courier panel needs, in one read. */
export const courierView = (order: Order) => {
  const courier = order.courier ?? {}
  const zone = qbasZone(order.deliveryZone)
  const status = courier.status ? courierStatus(courier.status) : null
  const booked = Boolean(courier.barcode) && !isRebookable(courier.status)
  return {
    barcode: courier.barcode ?? null,
    booked,
    bookedAt: courier.bookedAt ?? null,
    checkedAt: courier.checkedAt ?? null,
    error: courier.error ?? null,
    events: (courier.events ?? [])
      .map((e) => ({
        at: e.at,
        attachmentUrls: (e.attachmentUrls ?? '').split('\n').filter(Boolean),
        driverName: e.driverName ?? '',
        driverPhone: e.driverPhone ?? '',
        label: courierStatus(e.code).admin,
        notes: e.notes ?? '',
      }))
      .reverse(),
    missing: qbasMissing(),
    problems: bookingProblems(order),
    status: status ? { code: status.code, label: status.admin, stage: status.stage } : null,
    zone: zone ? { id: zone.id, label: zoneLabel(zone) } : null,
  }
}

const saveError = async (req: PayloadRequest, order: Order, message: string) => {
  await req.payload
    .update({
      collection: 'orders',
      data: { courier: { ...(order.courier ?? {}), error: message } },
      depth: 0,
      id: order.id,
      overrideAccess: true,
      req,
    })
    .catch(() => undefined)
}

/* ------------------------------------------------------ on the order ---- */

const getCourier: Endpoint = {
  handler: async (req) => {
    if (!staffOnly(req)) return json({ message: 'You do not have access to this order.' }, 403)
    const order = await loadOrder(req)
    if (!order) return json({ message: 'Unknown order.' }, 404)
    return json(courierView(order))
  },
  method: 'get',
  path: '/:id/courier',
}

const setZone: Endpoint = {
  handler: async (req) => {
    if (!staffOnly(req)) return json({ message: 'You do not have access to this order.' }, 403)
    const order = await loadOrder(req)
    if (!order) return json({ message: 'Unknown order.' }, 404)
    if (order.courier?.barcode && !isRebookable(order.courier.status))
      return json({ message: 'Already sent to QBAS — cancel the booking to change the zone.' }, 409)
    const zone = qbasZone((await readBody(req)).zoneId)
    if (!zone) return json({ message: 'Choose a zone from the list.' }, 400)
    const updated = (await req.payload.update({
      collection: 'orders',
      data: { deliveryZone: zone.id },
      depth: 0,
      id: order.id,
      overrideAccess: true,
      req,
    })) as Order
    return json({ ...courierView(updated), message: `Zone set to ${zoneLabel(zone)}.` })
  },
  method: 'post',
  path: '/:id/courier/zone',
}

const book: Endpoint = {
  handler: async (req) => {
    if (!staffOnly(req)) return json({ message: 'You do not have access to this order.' }, 403)
    const order = await loadOrder(req)
    if (!order) return json({ message: 'Unknown order.' }, 404)

    const config = qbasConfig()
    const missing = qbasMissing(config)
    if (missing.length)
      return json({ message: `QBAS is not connected yet — missing ${missing.join(', ')}.` }, 503)

    if (order.courier?.barcode && !isRebookable(order.courier.status))
      return json({ message: `Already sent to QBAS — tracking number ${order.courier.barcode}.` }, 409)

    const problems = bookingProblems(order)
    if (problems.length) return json({ message: problems.join(' ') }, 422)

    const body = await readBody(req)
    const zone = qbasZone(body.zoneId ?? order.deliveryZone)
    if (!zone) return json({ message: 'Choose the delivery zone first.' }, 422)

    let booking: Awaited<ReturnType<typeof createShipment>>
    try {
      booking = await createShipment(config, shipmentRequest(order, zone, config))
    } catch (error) {
      const message = failure(error)
      req.payload.logger.error({ err: error, order: order.id }, 'QBAS booking failed.')
      await saveError(req, order, message)
      return json({ message }, 502)
    }

    const now = new Date().toISOString()
    const saved = (await req.payload.update({
      collection: 'orders',
      data: {
        courier: {
          alertedStatus: null,
          barcode: booking.barcode,
          bookedAt: now,
          cost: booking.cost,
          error: null,
          // A re-booking after a cancellation keeps the old trail: it is what happened.
          events: (order.courier?.events ?? []).map(({ at, attachmentUrls, code, driverName, driverPhone, id, notes }) => ({
            at,
            attachmentUrls,
            code,
            driverName,
            driverPhone,
            id,
            notes,
          })),
          packageId: booking.packageId,
        },
        deliveryZone: zone.id,
        trackingNumber: booking.barcode,
      },
      depth: 0,
      id: order.id,
      overrideAccess: true,
      req,
    })) as Order
    const { order: updated } = await applyCourierStatus(
      req.payload,
      saved,
      { at: now, code: 'PENDING_CUSTOMER_CARE_APPROVAL' },
      req,
    )
    req.payload.logger.info({ barcode: booking.barcode, order: order.id }, 'Booked with QBAS.')
    return json({
      ...courierView(updated),
      message: `Sent to QBAS — tracking number ${booking.barcode}. Print the label and a driver will collect.`,
    })
  },
  method: 'post',
  path: '/:id/courier/book',
}

const label: Endpoint = {
  handler: async (req) => {
    if (!staffOnly(req)) return json({ message: 'You do not have access to this order.' }, 403)
    const order = await loadOrder(req)
    const barcode = order?.courier?.barcode
    if (!order || !barcode) return json({ message: 'This order has not been sent to QBAS.' }, 404)
    try {
      return json({ url: await labelUrl(qbasConfig(), barcode) })
    } catch (error) {
      return json({ message: failure(error) }, 502)
    }
  },
  method: 'post',
  path: '/:id/courier/label',
}

const check: Endpoint = {
  handler: async (req) => {
    if (!staffOnly(req)) return json({ message: 'You do not have access to this order.' }, 403)
    const order = await loadOrder(req)
    const barcode = order?.courier?.barcode
    if (!order || !barcode) return json({ message: 'This order has not been sent to QBAS.' }, 404)
    try {
      const status = await packageStatus(qbasConfig(), barcode)
      const { changed, order: updated } = await applyCourierStatus(req.payload, order, status, req)
      const label = courierStatus(status.code).admin
      return json({
        ...courierView(updated),
        message: changed ? `QBAS now says: ${label}.` : `No change — ${label}.`,
      })
    } catch (error) {
      return json({ message: failure(error) }, 502)
    }
  },
  method: 'post',
  path: '/:id/courier/check',
}

const cancel: Endpoint = {
  handler: async (req) => {
    if (!staffOnly(req)) return json({ message: 'You do not have access to this order.' }, 403)
    const order = await loadOrder(req)
    const barcode = order?.courier?.barcode
    if (!order || !barcode || isRebookable(order.courier?.status))
      return json({ message: 'There is no QBAS booking to cancel.' }, 404)

    const config = qbasConfig()
    if (qbasMissing(config).length)
      return json({ message: 'QBAS is not connected — cancel it in the QBAS app.' }, 503)
    try {
      await cancelShipment(config, barcode)
    } catch (error) {
      const message = failure(error)
      await saveError(req, order, message)
      return json({ message }, 502)
    }
    const { order: updated } = await applyCourierStatus(req.payload, order, { code: 'CANCELLED' }, req)
    /*
     * The tracking number was QBAS's: it no longer tracks anything. And if
     * QBAS had already moved the order to Shipped (the first real test showed
     * "Picked up" two minutes after booking), cancelling is her decision to
     * take it back: the order returns to In the atelier, so the customer's
     * page does not say "On its way" for a parcel that is not.
     */
    const cleared =
      updated.trackingNumber === barcode || updated.fulfilment === 'shipped'
        ? ((await req.payload.update({
            collection: 'orders',
            data: {
              ...(updated.trackingNumber === barcode ? { trackingNumber: null } : {}),
              ...(updated.fulfilment === 'shipped' ? { fulfilment: 'inAtelier' } : {}),
            },
            depth: 0,
            id: order.id,
            overrideAccess: true,
            req,
          })) as Order)
        : updated
    return json({ ...courierView(cleared), message: 'QBAS booking cancelled.' })
  },
  method: 'post',
  path: '/:id/courier/cancel',
}

export const orderCourierEndpoints: Endpoint[] = [getCourier, setZone, book, label, check, cancel]

/* ------------------------------------------------------------ from QBAS -- */

const sameSecret = (given: string, secret: string): boolean =>
  Boolean(secret) &&
  given.length === secret.length &&
  timingSafeEqual(Buffer.from(given), Buffer.from(secret))

const logCallback = async (
  req: PayloadRequest,
  args: { applied: boolean; barcode?: string; body: unknown; code?: string; order?: string; valid: boolean },
) => {
  try {
    await req.payload.create({
      collection: 'webhookLog',
      data: {
        applied: args.applied,
        event: `qbas.${(args.code || 'unknown').toLowerCase()}`,
        eventId: `qbas:${args.barcode ?? ''}:${args.code ?? ''}:${Date.now()}`,
        orderRef: args.order,
        payload: (args.body ?? {}) as Record<string, unknown>,
        paymentId: args.barcode,
        signatureValid: args.valid,
      },
      overrideAccess: true,
      req,
    })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'Could not write to webhookLog.')
  }
}

/**
 * QBAS's status webhook. Every call is logged. The status it names is
 * re-read from QBAS where it can be (QBAS signs nothing, so the address's
 * secret is the only proof it came from them); QBAS's note and postponed
 * date come from the call itself. Always 200 once authenticated — an unknown
 * barcode is logged, not retried.
 */
export const qbasWebhookEndpoint: Endpoint = {
  handler: async (req) => {
    const secret = qbasConfig().webhookSecret
    const given = req.searchParams?.get('key') ?? req.headers.get('x-webhook-key') ?? ''
    const body = await readBody(req)
    const barcode = String(body.barcode ?? '').trim()
    const claimed = String(body.newStatus ?? body.status ?? '').trim()

    if (!sameSecret(given, secret)) {
      await logCallback(req, { applied: false, barcode, body, code: claimed, valid: false })
      return json({ error: 'Not authorised.' }, 401)
    }

    const order = await orderByBarcode(req.payload, barcode, req)
    if (!order || !claimed) {
      await logCallback(req, { applied: false, barcode, body, code: claimed, valid: true })
      return json({ received: true, reason: order ? 'no status' : 'unknown parcel' })
    }

    let code = claimed
    try {
      code = (await packageStatus(qbasConfig(), barcode)).code
    } catch (error) {
      req.payload.logger.warn({ barcode, err: error }, 'QBAS status re-read failed; using the webhook’s.')
    }

    const notes = [
      String(body.notes ?? '').trim(),
      body.postponedDeliveryDate ? `New date ${String(body.postponedDeliveryDate).slice(0, 10)}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    const time = Number(body.time)
    // Proof-of-delivery photos: https addresses only, whatever else is sent is dropped.
    const attachmentUrls = (Array.isArray(body.attachmentUrls) ? body.attachmentUrls : [])
      .map((u) => String(u).trim())
      .filter((u) => /^https:\/\/\S+$/.test(u))
      .slice(0, 5)
      .join('\n')
    const { changed } = await applyCourierStatus(
      req.payload,
      order,
      {
        at: Number.isFinite(time) && time > 0 ? new Date(time) : undefined,
        attachmentUrls,
        code,
        driverName: String(body.driverName ?? ''),
        driverPhone: String(body.driverPhone ?? ''),
        notes: code === claimed ? notes : '',
      },
      req,
    )
    await logCallback(req, {
      applied: changed,
      barcode,
      body,
      code,
      order: order.reference ?? String(order.id),
      valid: true,
    })
    return json({ received: true })
  },
  method: 'post',
  path: '/delivery/qbas/webhook',
}

const fromCron = (req: PayloadRequest): boolean =>
  sameSecret(req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '', process.env.CRON_SECRET ?? '')

/** Every parcel still on its way, asked about — Vercel Cron (see above). */
export const qbasCheckEndpoint: Endpoint = {
  handler: async (req) => {
    if (!fromCron(req)) return json({ error: 'Only the scheduled job can run this.' }, 403)
    const config = qbasConfig()
    const { docs } = await req.payload.find({
      collection: 'orders',
      depth: 0,
      limit: 100,
      overrideAccess: true,
      pagination: false,
      req,
      sort: 'courier.checkedAt',
      where: { 'courier.barcode': { exists: true } },
    })
    const open = (docs as Order[]).filter(
      (o) => o.courier?.barcode && !isFinal(courierStatus(o.courier.status).stage),
    )
    let changed = 0
    const failed: string[] = []
    for (const order of open) {
      try {
        const status = await packageStatus(config, order.courier!.barcode!)
        if ((await applyCourierStatus(req.payload, order, status, req)).changed) changed++
      } catch {
        failed.push(order.courier!.barcode!)
      }
    }
    req.payload.logger.info({ changed, checked: open.length, failed }, 'QBAS parcels checked.')
    return json({ changed, checked: open.length, failed })
  },
  method: 'get',
  path: '/delivery/qbas/check',
}
