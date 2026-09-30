import type { Order } from '@/payload-types'

import type { QbasZone } from '@/data/qbasZones'

import { orderCode } from '@/hooks/orderReference'
import { toMajor } from '@/lib/pricing/money'

import type { QbasConfig } from './config'

/**
 * The QBAS (LogesTechs) protocol, as pure functions: what a booking sends,
 * and what each package status means for the order and its customer.
 *
 * From the two documents QBAS sent (LogesTechs API Documentation, 9 Jun 2026;
 * Webhook Status Updates v3). Where the documentation disagrees with its own
 * example — the table names `receiverName`, the example sends first and last
 * names — both are sent.
 */

/* -------------------------------------------------------------- statuses -- */

/**
 * Where a parcel is, in the order's terms.
 *
 * - `booked`, `awaitingPickup` — still with her; the order does not move.
 * - `withCourier`, `outForDelivery` — on its way: Fulfilment becomes Shipped
 *   (which emails the customer, as it always has).
 * - `delivered` — Fulfilment becomes Delivered.
 * - `attention`, `returned` — a person must look: she is emailed.
 * - `cancelled` — the booking is off; the order can be sent again.
 */
export type CourierStage =
  | 'attention'
  | 'awaitingPickup'
  | 'booked'
  | 'cancelled'
  | 'delivered'
  | 'outForDelivery'
  | 'returned'
  | 'withCourier'

type StatusInfo = {
  /** QBAS's own English name, for her. */
  admin: string
  /** What the customer reads on their order page. */
  customer: string
  stage: CourierStage
}

const HUB = 'At the courier’s hub'
const DELAYED = 'Delayed — we are looking into it'

const STATUSES: Record<string, StatusInfo> = {
  DRAFT: { admin: 'Draft', customer: 'Booked with the courier', stage: 'booked' },
  PENDING_CUSTOMER_CARE_APPROVAL: { admin: 'Submitted', customer: 'Booked with the courier', stage: 'booked' },
  APPROVED_BY_CUSTOMER_CARE_AND_WAITING_FOR_DISPATCHER: {
    admin: 'Ready for dispatching',
    customer: 'Waiting for the courier to collect',
    stage: 'awaitingPickup',
  },
  ASSIGNED_TO_DRIVER_AND_PENDING_APPROVAL: {
    admin: 'Assigned to a driver',
    customer: 'Waiting for the courier to collect',
    stage: 'awaitingPickup',
  },
  ACCEPTED_BY_DRIVER_AND_PENDING_PICKUP: {
    admin: 'Pickup pending',
    customer: 'The courier is on the way to collect it',
    stage: 'awaitingPickup',
  },
  REJECTED_BY_DRIVER_AND_PENDING_MANGEMENT: {
    admin: 'Rejected by the driver — QBAS is reassigning',
    customer: 'Waiting for the courier to collect',
    stage: 'awaitingPickup',
  },
  REJECTED_BY_DRIVER: {
    admin: 'Rejected by the driver — QBAS is reassigning',
    customer: 'Waiting for the courier to collect',
    stage: 'awaitingPickup',
  },
  SCANNED_BY_DRIVER_AND_IN_CAR: { admin: 'Picked up', customer: 'Collected by the courier', stage: 'withCourier' },
  SCANNED_BY_HANDLER_AND_UNLOADED: { admin: 'Received at the sorting centre', customer: HUB, stage: 'withCourier' },
  MOVED_TO_SHELF_AND_OUT_OF_HANDLER_CUSTODY: { admin: 'Sorted on shelves', customer: HUB, stage: 'withCourier' },
  IN_HUB: { admin: 'In hub', customer: HUB, stage: 'withCourier' },
  IN_TRANSIT: { admin: 'In transit between hubs', customer: 'On its way to your area', stage: 'withCourier' },
  TRANSFERRED_OUT: { admin: 'Transferred to a partner', customer: 'On its way', stage: 'withCourier' },
  EXPORTED_TO_THIRD_PARTY: { admin: 'Exported to a third party', customer: 'On its way', stage: 'withCourier' },
  RESOLVED_FAILURE: { admin: 'Failure resolved', customer: 'Delivery rearranged', stage: 'withCourier' },
  FAILURE_RESOLVED: { admin: 'Failure resolved', customer: 'Delivery rearranged', stage: 'withCourier' },
  OUT_FOR_DELIVERY: { admin: 'Out for delivery', customer: 'Out for delivery', stage: 'outForDelivery' },
  DELIVERED_TO_RECIPIENT: { admin: 'Delivered', customer: 'Delivered', stage: 'delivered' },
  COMPLETED: { admin: 'Completed', customer: 'Delivered', stage: 'delivered' },
  PARTIALLY_DELIVERED: { admin: 'Partially delivered', customer: 'Partly delivered', stage: 'attention' },
  POSTPONED_DELIVERY: { admin: 'Delivery postponed', customer: 'Delivery rescheduled', stage: 'attention' },
  FAILED: {
    admin: 'Delivery failed',
    customer: 'Delivery attempt unsuccessful — the courier will be in touch',
    stage: 'attention',
  },
  OPENED_ISSUE_AND_WAITING_FOR_MANAGEMENT: { admin: 'Reported to QBAS management', customer: DELAYED, stage: 'attention' },
  DAMAGED: { admin: 'Damaged', customer: DELAYED, stage: 'attention' },
  LOST: { admin: 'Lost', customer: DELAYED, stage: 'attention' },
  RETURNED_BY_RECIPIENT: { admin: 'Returned by the recipient', customer: 'Returned', stage: 'returned' },
  DELIVERED_TO_SENDER: { admin: 'Returned to plumpose', customer: 'Returned', stage: 'returned' },
  CANCELLED: { admin: 'Cancelled', customer: 'Courier booking cancelled', stage: 'cancelled' },
  DELETED: { admin: 'Deleted', customer: 'Courier booking cancelled', stage: 'cancelled' },
}

/** An unknown code is shown as QBAS wrote it, and changes nothing. */
export const courierStatus = (code: null | string | undefined): StatusInfo & { code: string } => {
  const key = String(code ?? '').trim().toUpperCase()
  const known = STATUSES[key]
  if (known) return { ...known, code: key }
  const words = key.replace(/_/g, ' ').toLowerCase()
  const text = words ? words[0].toUpperCase() + words.slice(1) : 'Unknown'
  return { admin: text, code: key, customer: 'Update from the courier', stage: 'booked' }
}

/** No more updates are coming: the cron stops asking. */
export const isFinal = (stage: CourierStage): boolean =>
  stage === 'delivered' || stage === 'returned' || stage === 'cancelled'

/** Someone has to look — she is emailed. */
export const needsAttention = (stage: CourierStage): boolean =>
  stage === 'attention' || stage === 'returned'

/** A booking that no longer holds: the order may be sent to QBAS again. */
export const isRebookable = (code: null | string | undefined): boolean =>
  !code || courierStatus(code).stage === 'cancelled'

/* ------------------------------------------------------------------ phone -- */

/**
 * A phone as QBAS's drivers dial it. A Qatari number goes as its 8 digits
 * (their own example numbers carry no country code); one typed with another
 * country's code keeps it, with "+".
 */
export const qbasPhone = (raw: null | string | undefined): string => {
  const typed = (raw ?? '').trim()
  const digits = typed.replace(/\D/g, '')
  if (!digits) return ''
  const international = typed.startsWith('+') ? digits : digits.startsWith('00') ? digits.slice(2) : ''
  if (international) {
    return international.startsWith('974') && international.length === 11
      ? international.slice(3)
      : `+${international}`
  }
  if (digits.length === 11 && digits.startsWith('974')) return digits.slice(3)
  return digits
}

/* ---------------------------------------------------------------- booking -- */

export type ShipmentRequest = Record<string, unknown>

/**
 * `POST /ship/request/by-email` — one parcel for one order.
 *
 * Paid already (SkipCash), so nothing is collected at the door: `REGULAR`,
 * `cod: 0`, and the amount paid as the declared value. The order code is the
 * invoice number, which QBAS echoes in every webhook and shows her in its app.
 */
export const shipmentRequest = (
  order: Pick<Order, 'amount' | 'id' | 'reference' | 'shippingAddress'>,
  zone: Pick<QbasZone, 'id'>,
  config: QbasConfig,
): ShipmentRequest => {
  const address = order.shippingAddress ?? {}
  const firstName = (address.firstName ?? '').trim()
  const lastName = (address.lastName ?? '').trim()
  const code = orderCode(order)
  const street = (address.addressLine1 ?? '').trim()
  const apartment = (address.addressLine2 ?? '').trim()

  return {
    destinationAddress: {
      // QBAS's label prints addressLine1 only — the first real booking dropped
      // "Flat 4" — so the apartment rides on the first line too.
      addressLine1: [street, apartment].filter(Boolean).join(', '),
      ...(apartment ? { addressLine2: apartment } : {}),
      cityId: zone.id,
    },
    email: config.email,
    originAddress: { addressLine1: config.sender.address, cityId: config.sender.zoneId },
    password: config.password,
    pkg: {
      businessSenderName: config.sender.name,
      cod: 0,
      declaredValue: toMajor(order.amount ?? 0),
      description: 'Clothing',
      invoiceNumber: code,
      notes: `plumpose order ${code}`,
      quantity: 1,
      receiverFirstName: firstName,
      receiverLastName: lastName,
      receiverName: [firstName, lastName].filter(Boolean).join(' '),
      receiverPhone: qbasPhone(address.phone),
      senderName: config.sender.name,
      senderPhone: qbasPhone(config.sender.phone),
      serviceTypeId: config.serviceTypeId,
      shipmentType: 'REGULAR',
      ...(config.vehicleTypeId ? { vehicleTypeId: config.vehicleTypeId } : {}),
      weight: 1,
    },
    pkgUnitType: 'METRIC',
  }
}

/** What a booking must have before it is sent — each in her words. */
export const bookingProblems = (
  order: Pick<Order, 'fulfilment' | 'shippingAddress'>,
): string[] => {
  const address = order.shippingAddress ?? {}
  return [
    (address.country ?? '').toUpperCase() !== 'QA' ? 'QBAS delivers within Qatar only.' : '',
    order.fulfilment === 'cancelled' || order.fulfilment === 'refunded'
      ? 'This order is closed.'
      : '',
    !(address.addressLine1 ?? '').trim() ? 'The order has no street and building.' : '',
    !qbasPhone(address.phone) ? 'The order has no phone number for the driver.' : '',
    !(address.firstName ?? '').trim() && !(address.lastName ?? '').trim()
      ? 'The order has no name to deliver to.'
      : '',
  ].filter(Boolean)
}
