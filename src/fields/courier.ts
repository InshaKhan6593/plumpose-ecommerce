import type { Field } from 'payload'

import { neverEditable } from '@/access/isAdminOrStaff'

/**
 * The courier on an order — QBAS for Qatar (@/delivery/qbas).
 *
 * She sees none of these as fields: the "Courier" panel on the order's
 * sidebar shows them and does the booking, the label and the cancelling. The
 * record is written by the server only — the booking, QBAS's webhook, the
 * half-hourly check — so a hand edit cannot make the order and QBAS disagree.
 */
export const courierFields: Field[] = [
  {
    // The zone the customer chose at checkout (a QBAS city id, @/data/qbasZones).
    // She can change it on the panel until the order is booked.
    name: 'deliveryZone',
    type: 'number',
    admin: { hidden: true },
    label: 'Delivery zone',
  },
  {
    name: 'courierPanel',
    type: 'ui',
    admin: {
      components: { Field: '@/components/admin/CourierPanel#CourierPanel' },
      position: 'sidebar',
    },
  },
  {
    name: 'courier',
    type: 'group',
    access: { update: neverEditable },
    admin: { hidden: true },
    fields: [
      { name: 'barcode', type: 'text', index: true },
      { name: 'packageId', type: 'number' },
      /** QBAS's status code, e.g. OUT_FOR_DELIVERY — see @/delivery/qbas/protocol. */
      { name: 'status', type: 'text', index: true },
      { name: 'statusAt', type: 'date' },
      { name: 'bookedAt', type: 'date' },
      /** Last time QBAS was asked (the half-hourly check, or "Check now"). */
      { name: 'checkedAt', type: 'date' },
      /** What QBAS charges her for this parcel (major QAR), if it said. */
      { name: 'cost', type: 'number' },
      /** The last thing that went wrong, in words she can act on. */
      { name: 'error', type: 'text' },
      /** Once she has been emailed about a problem status, it is not sent again. */
      { name: 'alertedStatus', type: 'text' },
      {
        name: 'events',
        type: 'array',
        fields: [
          { name: 'code', type: 'text', required: true },
          { name: 'notes', type: 'text' },
          { name: 'at', type: 'date', required: true },
        ],
      },
    ],
    label: 'Courier',
  },
]
