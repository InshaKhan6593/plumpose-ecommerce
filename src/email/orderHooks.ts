import type { CollectionAfterChangeHook, Endpoint } from 'payload'

import type { Order } from '@/payload-types'

import { checkRole } from '@/access/utilities'

import { isEmailEnabled } from './config'
import { runAfterResponse, sendOrderEmail } from './sendOrderEmail'

/**
 * When an order emails, and to whom.
 *
 * | Trigger | Email |
 * |---|---|
 * | Order created (payment confirmed) | Confirmation to the customer, alert to the shop |
 * | Fulfilment changed to **Shipped** | "On its way", with the tracking number if one is set |
 * | "Resend confirmation" in the admin | Confirmation again, to the customer |
 *
 * Hung on the orders collection rather than on the Stripe adapter, so it
 * fires however the order was created — Stripe today, SkipCash later, or the
 * webhook when the customer closed the tab.
 */
export const sendOrderEmails: CollectionAfterChangeHook<Order> = ({
  context,
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (!isEmailEnabled() || context?.skipOrderEmails) return doc

  const { payload } = req

  if (operation === 'create') {
    runAfterResponse(payload, async () => {
      await sendOrderEmail(payload, doc.id, 'confirmation')
      await sendOrderEmail(payload, doc.id, 'notification')
    })
  }

  if (operation === 'update' && doc.fulfilment === 'shipped' && previousDoc?.fulfilment !== 'shipped') {
    runAfterResponse(payload, () => sendOrderEmail(payload, doc.id, 'shipped'))
  }

  return doc
}

/**
 * `POST /api/orders/:id/resend-confirmation` — the admin's "Resend
 * confirmation" button (A6). Admin and staff only. Sends to the address on
 * the order, now, and reports what happened.
 */
export const resendConfirmationEndpoint: Endpoint = {
  handler: async (req) => {
    if (!checkRole(['admin', 'staff'], req.user)) {
      return Response.json({ message: 'You do not have access to this order.' }, { status: 403 })
    }

    if (!isEmailEnabled()) {
      return Response.json(
        { message: 'Email is switched off — RESEND_API_KEY is not set.' },
        { status: 503 },
      )
    }

    const id = Number(req.routeParams?.id)
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ message: 'Unknown order.' }, { status: 400 })
    }

    const result = await sendOrderEmail(req.payload, id, 'confirmation', { force: true })

    return result.ok
      ? Response.json({ message: `Confirmation sent to ${result.to}.` })
      : Response.json({ message: result.reason }, { status: 422 })
  },
  method: 'post',
  path: '/:id/resend-confirmation',
}
