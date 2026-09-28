/**
 * Tutorial 04 — handle an order: find it, read what to make, what was paid,
 * the gift note and the address, then move it along — In the atelier,
 * Shipped with a tracking number, Delivered — and see the customer's order
 * page follow; Cancelled and Refunded are pointed at (each emails the customer). Every control on the list and the order screen is pointed at
 * and explained, including the ones the video does not use.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`);
 * the piece, its sizes and a paid order are made off camera first (the
 * customer is made up). Narrated: `npx tsx scripts/record/narrate.ts
 * 04-handle-an-order` before the take. Output in ../recordings/04-handle-an-order.
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

/** A labelled field as a whole (label, box and description), for pointing at. */
const field = (label: RegExp) =>
  r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: label }) }).first()

const onOrderPage = (find: (site: FrameLocator) => ReturnType<FrameLocator['locator']>) =>
  r.showOnSite(orderPage, find)

await r.run(async () => {
  await r.goSite(orderPage)
  await r.titleCard('Orders', 'Handle an order', ['From a new order to delivered'], {
    speak: 'How to handle an order, from the moment it arrives until it is delivered.',
  })

  /* ---- the list */
  await r.say('New orders appear under Orders, and you are emailed each one.')
  await r.point(r.admin.locator('table tbody tr').first(), 2, 1.4)
  await r.say('The order code starts with PLM. The customer sees it in their emails and on their order page.')
  await r.point(r.admin.locator('table tbody tr').first().getByText(/PLM-/), 1.5)

  await r.say('To find an order, type the customer’s email in the search box.')
  await r.point(r.admin.getByPlaceholder(/search/i).first(), 1.5)
  await r.say('Columns chooses what the list shows. It changes only your view.')
  await r.point(r.admin.locator('#toggle-list-columns'), 1.5)
  await r.say('Filters narrows the list — for example, to orders still awaiting fulfilment.')
  await r.point(r.admin.locator('#toggle-list-filters'), 1.5)
  await r.say('Download as a spreadsheet saves the orders in the list, for Excel or Numbers.')
  await r.point(r.admin.getByText(/download as a spreadsheet/i).first(), 1.5)
  await r.say('The small arrows beside each heading sort the list, for example newest first.')
  await r.point(r.admin.getByRole('button', { name: /sort by created at descending/i }), 1.5)
  await r.say('Per page sets how many orders show at once.')
  await r.point(r.admin.getByRole('button', { name: /per page/i }), 1.5)

  await r.say('Click the customer’s email to open the order.')
  await r.click(r.admin.getByRole('link', { name: /mariam/i }).first())
  await r.admin.getByText(/× 1/).first().waitFor()

  /* ---- the top of the order */
  await r.say('At the top: when the order came in, and when it was last changed.')
  await r.point(r.admin.getByText(/last modified/i).first(), 1.5)
  await r.say('Edit, on the right, is simply the page you are on.')
  await r.point(r.admin.locator('.doc-tab__label', { hasText: /^edit$/i }).first(), 1.2)

  /* ---- what to make */
  await r.say('First, what to make: the piece, the size and the embroidery.')
  await r.point(r.admin.getByText(/× 1/).first(), 2)
  await r.say('Show All and Collapse All open and close these panels. They change nothing.')
  await r.point(r.admin.getByRole('button', { name: 'Collapse All' }).first(), 1.2)
  await r.say('The piece, size, quantity and embroidery are what the customer paid for, so they are locked.')
  await r.point(field(/^piece$/i), 1.5)
  await r.say('The small pencil opens the piece itself. A change there changes your shop, not this order.')
  await r.point(r.admin.getByRole('button', { name: /^Edit Al Shaheen Nights — Silk Pyjama Set$/ }), 1.5)
  await r.say('Letters, symbol and thread colour tell you exactly what to embroider.')
  await r.point(r.admin.locator('#field-items__0__personalisation__0__lettering'), 1.5)

  /* ---- what was paid, and the gift */
  await r.say('Below, what the customer paid, line by line: the piece, the embroidery and delivery.')
  await r.point(r.admin.getByText('QAR 1,399.00', { exact: true }).first(), 2)
  await r.say('Delivery description and zone show which delivery rate was charged.')
  await r.point(r.admin.locator('#field-shippingLabel'), 1.5)

  await r.say('Gift is ticked: pack it with a card, and leave the invoice out.')
  await r.point(r.admin.locator('#field-gift'), 1.5)
  await r.say('This is the note to write on the card.')
  await r.point(r.admin.locator('#field-giftNote'), 2)
  await r.say('Admin notes are for you and your team only. The customer never sees them.')
  await r.point(r.admin.locator('#field-adminNotes'), 1.5)

  /* ---- the right-hand side */
  await r.say('On the right, Status, Amount and Currency come from the payment. They cannot be changed.')
  await r.point(r.admin.locator('#field-status').first(), 2, 1.5)
  await r.say('Customer account shows their account, if they were signed in. It is empty for a guest.')
  await r.point(field(/^customer account$/i), 1.5)
  await r.say('Customer email is where every email about this order goes. Correct a typo here, then Save.')
  await r.point(r.admin.locator('#field-customerEmail'), 1.5)
  await r.say('Resend confirmation sends the order email again. It asks you first, and Cancel sends nothing.')
  await r.point(r.admin.getByRole('button', { name: /resend confirmation/i }), 2)
  await r.say('Use it when a customer says the email never arrived. Once an email has gone, its date shows here.')

  /* ---- the address */
  await r.say('The Shipping tab has the address and phone number.')
  await r.click(r.admin.getByRole('button', { name: 'Shipping', exact: true }))
  await r.point(r.admin.locator('#field-shippingAddress__addressLine1'), 1.5)
  await r.say('If the customer asks to change the address, correct it here and click Save. No email is sent.')
  await r.point(r.admin.locator('#field-shippingAddress__phone'), 1.5)

  /* ---- in the atelier */
  await r.say('When you start making it, set Fulfilment to In the atelier, and click Save.')
  await choose('In the atelier')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  await r.say('No email is sent for this step. The customer’s order page shows it is being made.')
  await onOrderPage((site) => site.locator('main').getByText(/^in the atelier \(current\)$/i))

  /* ---- shipped, and the tracking number first */
  await r.say('When it is sent, choose Shipped, and click Save.')
  await choose('Shipped')
  await r.click(r.admin.locator('#action-save'))
  await r.admin.getByText(/add the tracking number first/i).first().waitFor()
  await r.say('Without a tracking number, Save stops and asks for it, because it goes in the customer’s email.')
  await r.point(r.admin.locator('#field-fulfilment'), 2)

  await r.say('Type the tracking number, and click Save again.')
  await r.type(r.admin.locator('#field-trackingNumber'), TRACKING, { delay: 60 })
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

  /* ---- cancelled and refunded: pointed at, not chosen */
  await r.say('Fulfilment has two more choices: Cancelled and Refunded. Each one emails the customer.')
  await r.click(r.admin.locator('#field-fulfilment .rs__control').first())
  await r.point(r.admin.locator('.rs__menu').first(), 2.5)
  await r.say('To refund, return the money in SkipCash first, then choose Refunded and Save.')
  await r.admin.locator('body').press('Escape')

  await r.recapCard(
    'Handle an order',
    [
      'Orders → open the order: what to make, what was paid, the address',
      'In the atelier → Save (no email)',
      'Tracking number, then Shipped → Save (the customer is emailed)',
      'Delivered → Save (no email)',
      'Cancelled or Refunded email the customer: refund in SkipCash first',
      'Resend confirmation: the order email again, if it went missing',
    ],
    {
      speak:
        'To recap: open the order, move Fulfilment along as you go, and always add the tracking number before Shipped.',
    },
  )
  await r.finish()
})
