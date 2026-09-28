/**
 * Tutorial 04 — handle an order: open a paid order, read what to make, what
 * was paid, the gift note and the address, then move it along — In the
 * atelier, Shipped with a tracking number, Delivered — and see the
 * customer's order page follow.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`);
 * the piece, its sizes and a paid order are made off camera first (the
 * customer is made up). Output in ../recordings/04-handle-an-order.
 */
import type { FrameLocator } from '@playwright/test'

import { addPaidOrder } from '../demo-data'
import { Recording } from '../stage'

const TRACKING = 'QP 1234 5678 QA'
let orderPage = '/'

const r = new Recording('04-handle-an-order')
await r.start({
  adminPath: '/admin/collections/orders',
  setup: async (api) => {
    const order = await addPaidOrder(api)
    orderPage = `/order/${order.id}?token=${order.token}`
  },
  sitePath: '/',
})

const choose = async (label: string) => {
  await r.click(r.admin.locator('#field-fulfilment .rs__control').first())
  await r.click(r.admin.locator('.rs__option').filter({ hasText: new RegExp(`^${label}$`) }).first())
}

const onOrderPage = (find: (site: FrameLocator) => ReturnType<FrameLocator['locator']>) =>
  r.showOnSite(orderPage, find)

await r.run(async () => {
  await r.goSite(orderPage)
  await r.titleCard('Orders', 'Handle an order', ['From a new order to delivered'])

  /* ---- the list */
  await r.say('New orders appear under Orders. You are also emailed each one.')
  await r.point(r.admin.locator('table tbody tr').first(), 2, 1.4)

  await r.say('To find an order, type the customer’s email in the search box.')
  await r.point(r.admin.getByPlaceholder(/search/i).first(), 2)
  await r.say('Download as a spreadsheet saves the orders in the list, for Excel or Numbers.')
  await r.point(r.admin.getByText(/download as a spreadsheet/i).first(), 2.5)

  await r.say('Filters narrows the list — for example, to orders still awaiting fulfilment.')
  await r.point(r.admin.getByRole('button', { name: /^filters$/i }).first(), 2)

  await r.say('Click the order to open it.')
  await r.click(r.admin.getByRole('link', { name: /mariam/i }).first())
  await r.admin.getByText(/× 1/).first().waitFor()

  /* ---- reading it */
  await r.say('At the top, what to make: the piece, the size and the embroidery.')
  await r.point(r.admin.getByText(/× 1/).first(), 3)

  await r.say('Below it, what the customer paid, line by line.')
  await r.point(r.admin.getByText('QAR 1,399.00', { exact: true }).first(), 2.5)

  await r.say('Gift is ticked: pack it with a card, and leave the invoice out.')
  await r.point(r.admin.locator('#field-gift'), 2)
  await r.say('This is the note to write on the card.')
  await r.point(r.admin.locator('#field-giftNote'), 2.5)

  await r.say('Admin notes are for you and your team only. The customer never sees them.')
  await r.point(r.admin.locator('#field-adminNotes'), 2.5)

  /* ---- also on this screen: the right-hand side */
  await r.say('On the right: Status and Amount come from the payment. They can’t be changed.')
  await r.point(r.admin.locator('#field-status').first(), 2.5, 1.5)
  await r.say('Customer email is where every email for this order goes. Correct a typo here.')
  await r.point(r.admin.locator('#field-customerEmail'), 2.5)
  await r.say('Resend confirmation sends the order email to the customer again. It asks you first.')
  await r.point(r.admin.getByRole('button', { name: /resend confirmation/i }), 3)
  await r.say('Use it when a customer says the email never arrived.')

  await r.say('The Shipping tab has the address.')
  await r.click(r.admin.getByRole('button', { name: 'Shipping', exact: true }))
  await r.point(r.admin.locator('#field-shippingAddress__addressLine1'), 2.5)

  /* ---- in the atelier */
  await r.say('When you start making it, set Fulfilment to In the atelier, and click Save.')
  await choose('In the atelier')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  await r.say('No email is sent for this step. The customer’s order page shows it is being made.')
  await onOrderPage((site) => site.locator('main').getByText(/^in the atelier \(current\)$/i))

  /* ---- shipped */
  await r.say('When it is sent, type the tracking number first.')
  await r.type(r.admin.locator('#field-trackingNumber'), TRACKING, { delay: 60 })
  await r.say('Then choose Shipped, and click Save.')
  await choose('Shipped')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  await r.say('The customer is emailed that it is on its way, with the tracking number.')
  await onOrderPage((site) => site.locator('main').getByText(TRACKING))

  /* ---- delivered */
  await r.say('When it arrives, choose Delivered, and click Save. No email is sent for this one.')
  await choose('Delivered')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await onOrderPage((site) => site.locator('main').getByText(/^delivered \(current\)$/i))

  await r.recapCard('Handle an order', [
    'Orders → open the order: what to make, what was paid, the address',
    'In the atelier → Save (no email)',
    'Tracking number, then Shipped → Save (the customer is emailed)',
    'Delivered → Save (no email)',
    'Resend confirmation: the order email again, if it went missing',
  ])
  await r.finish()
})
