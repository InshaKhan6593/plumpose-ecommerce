'use server'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { isUndeliverable } from '@/email/config'
import { button, heading, label, layout, muted, paragraph } from '@/email/layout'
import { orderLink } from '@/email/sendOrderEmail'
import { orderCode, readOrderCode } from '@/hooks/orderReference'
import { getCachedGlobal } from '@/utilities/getGlobals'

type Args = { email: string; orderID: string }
type Result = { error?: string; success: boolean }

/**
 * Track order: emails the private link to an order, to the address it was
 * placed with.
 *
 * The reply is the same whether or not an order matched — "if an order
 * matches, a link is on its way" — so the form cannot be used to learn who has
 * ordered. The link carries the order's own access token, never the email.
 *
 * An order placed while signed in has no `customerEmail` (the plugin links the
 * account instead), so the address is matched on either. The template matched
 * `customerEmail` only, and a signed-in customer's order could never be found.
 */
export async function sendOrderAccessEmail({ email, orderID }: Args): Promise<Result> {
  const payload = await getPayload({ config: configPromise })
  const typed = email.trim()
  // Account emails are stored lower-case; a guest's as typed at checkout.
  const address = typed.toLowerCase()
  // The order code ("PLM-250928-7K4QX2", however it is typed), or for an order
  // from before codes, its number ("#105" or "105").
  const code = readOrderCode(orderID)
  const id = code ? 0 : Number(orderID.replace(/[^\d]/g, ''))
  if (!address || (!code && (!Number.isInteger(id) || id <= 0))) return { success: true }

  try {
    const { docs } = await payload.find({
      collection: 'orders',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          code ? { reference: { equals: code } } : { id: { equals: id } },
          {
            or: [
              { customerEmail: { in: [...new Set([typed, address])] } },
              { 'customer.email': { equals: address } },
            ],
          },
        ],
      },
    })

    const order = docs[0]
    if (!order?.accessToken || isUndeliverable(typed)) return { success: true }

    const settings = await getCachedGlobal('siteSettings', 0)()
    const href = orderLink(order)

    await payload.sendEmail({
      html: layout({
        body: [
          label(`Order ${orderCode(order)}`),
          heading('Your order'),
          paragraph(
            'Here is the private link to your order, where you can see each step from our atelier to your door.',
          ),
          button(href, 'View your order'),
          muted(
            'Keep this email to yourself — anyone with the link can see the order. If you did not ask for it, you can ignore it.',
          ),
        ].join('\n'),
        footer: {
          contactEmail: settings.contactEmail,
          instagramHandle: settings.instagramHandle,
          instagramUrl: settings.instagramUrl,
          whatsappNumber: settings.whatsappNumber,
        },
        preheader: `The link to order ${orderCode(order)}.`,
      }),
      replyTo: settings.contactEmail || undefined,
      subject: `Your plumpose order ${orderCode(order)}`,
      text: `The private link to your order ${orderCode(order)}:\n${href}\n\nIf you did not ask for this, you can ignore it.`,
      to: typed,
    })
  } catch (err) {
    payload.logger.error({ err, msg: 'Failed to send order access email' })
  }

  return { success: true }
}
