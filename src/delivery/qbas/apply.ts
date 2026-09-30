import type { Payload, PayloadRequest } from 'payload'

import type { Order } from '@/payload-types'

import { sendCourierAlert } from '@/email/courierAlert'
import { runAfterResponse } from '@/email/sendOrderEmail'

import { courierStatus, needsAttention } from './protocol'

/**
 * Recording a parcel's status on its order — from the booking, QBAS's
 * webhook, the half-hourly check, or "Check now". All four come through here,
 * so they cannot disagree.
 *
 * - **The timeline gains an entry only when something changed** (a new code,
 *   or new notes such as a postponed date). QBAS repeats itself; the customer
 *   should not read "Out for delivery" three times.
 * - **Fulfilment follows the parcel forward, never back.** Collected or out for
 *   delivery → Shipped (which emails the customer, as marking it by hand
 *   always has); delivered → Delivered. A closed order (Cancelled, Refunded)
 *   is never reopened by a courier update.
 * - **A problem is emailed to her once** per status (failed, postponed,
 *   returned, lost…), after the write has committed.
 */

export type StatusUpdate = {
  at?: Date | string
  code: string
  notes?: string
}

const RANK: Record<string, number> = { delivered: 3, inAtelier: 1, shipped: 2, unfulfilled: 0 }

export const applyCourierStatus = async (
  payload: Payload,
  order: Order,
  update: StatusUpdate,
  req?: PayloadRequest,
): Promise<{ changed: boolean; order: Order }> => {
  const info = courierStatus(update.code)
  if (!info.code) return { changed: false, order }

  const courier = order.courier ?? {}
  const events = (courier.events ?? []).map(({ at, code, id, notes }) => ({ at, code, id, notes }))
  const last = events[events.length - 1]
  const notes = (update.notes ?? '').trim().slice(0, 300)
  const now = new Date().toISOString()
  const at = update.at ? new Date(update.at).toISOString() : now

  const changed = !last || last.code !== info.code || Boolean(notes && notes !== (last.notes ?? ''))
  const nextEvents = changed ? [...events, { at, code: info.code, notes: notes || undefined }] : events

  const current = order.fulfilment ?? 'unfulfilled'
  const closed = current === 'cancelled' || current === 'refunded'
  const target =
    info.stage === 'delivered'
      ? 'delivered'
      : info.stage === 'withCourier' || info.stage === 'outForDelivery'
        ? 'shipped'
        : null
  const fulfilment =
    !closed && target && (RANK[current] ?? 0) < RANK[target] ? (target as Order['fulfilment']) : null

  const alert = changed && needsAttention(info.stage) && courier.alertedStatus !== info.code

  const updated = (await payload.update({
    collection: 'orders',
    data: {
      courier: {
        ...courier,
        alertedStatus: alert ? info.code : courier.alertedStatus,
        checkedAt: now,
        error: null,
        events: nextEvents,
        status: info.code,
        statusAt: changed ? at : (courier.statusAt ?? at),
      },
      ...(fulfilment
        ? {
            fulfilment,
            // Shipped needs a tracking number (the field's own rule): the parcel's is the one.
            trackingNumber: order.trackingNumber || courier.barcode || undefined,
          }
        : {}),
    },
    depth: 0,
    id: order.id,
    overrideAccess: true,
    req,
  })) as Order

  if (alert) {
    runAfterResponse(payload, () =>
      sendCourierAlert(payload, order.id, { code: info.code, notes }),
    )
  }

  return { changed, order: updated }
}

/** An order by its QBAS tracking number — how a webhook finds its order. */
export const orderByBarcode = async (
  payload: Payload,
  barcode: string,
  req?: PayloadRequest,
): Promise<null | Order> => {
  if (!barcode) return null
  const found = await payload.find({
    collection: 'orders',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { 'courier.barcode': { equals: barcode } },
  })
  return (found.docs[0] as Order | undefined) ?? null
}
