/**
 * Tutorial 13 — Payments: checking whether a customer actually paid. The list
 * says what happened in words (paid, left the payment page, card refused);
 * a paid one's Reference is the Transaction ID in the SkipCash portal and the
 * customer's order code. Everything is read-only; refunds are made in the
 * portal, then marked on the order.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`);
 * the paid order and three checkouts are made off camera. Narrated: `npx tsx
 * scripts/record/narrate.ts 13-payments` before the take.
 */
import { addPaidOrder } from '../demo-data'
import { Recording } from '../stage'

let order = { id: 0, token: '' }
const r = new Recording('13-payments')
await r.start({
  adminPath: '/admin/collections/transactions',
  setup: async (api) => {
    order = await addPaidOrder(api, { payments: true })
  },
  sitePath: '/shop',
})

const row = (text: RegExp | string) => r.admin.locator('.table tbody tr').filter({ hasText: text }).first()

await r.run(async () => {
  await r.titleCard('Shop', 'Payments', ['Check whether a customer really paid'], {
    speak: 'How to check whether a customer really paid, and what to do when they did not.',
  })

  await r.say('Payments is in the side menu, under Shop. Every checkout is here, paid or not.')
  await r.point(r.admin.locator('h1').first(), 1.5)
  await r.say('What happened says it in words.')
  await r.point(r.admin.locator('.table').first(), 2)

  await r.say('Paid, with its order code: the money has reached SkipCash, and the order is in Orders.')
  await r.point(row(/^.*Paid —/), 2)
  await r.say('Not paid: they reached the payment page and left. Their email and bag are here, if you would like to follow up.')
  await r.point(row('hessa.m@example.com'), 2.5)
  await r.say('Payment failed: the card was refused. Nothing was charged, and no order was made.')
  await r.point(row('latifa@example.com'), 2)

  /* ---- a paid one */
  await r.say('Open a paid one.')
  await r.click(row(/^.*Paid —/).locator('a').first())
  await r.admin.locator('#field-skipcash__reference').waitFor()
  await r.say('Reference is the Transaction ID in your SkipCash portal. Search for it there to see the same payment.')
  await r.point(r.admin.locator('#field-skipcash__reference'), 2)
  await r.say('It is also the order code your customer sees on their order.')
  await r.goSite(`/order/${order.id}?token=${order.token}`)
  await r.point(r.site.getByText(/PLM-\d{6}-[A-Z0-9]{6}/).first(), 2, 1.5)
  await r.say('Paid with and Card show the card and its last digits. Order opens the order this payment made.')
  await r.point(r.admin.locator('#field-skipcash__cardNumber'), 1.2)
  await r.point(r.admin.locator('#field-order'), 1.2)
  await r.say('Nothing here can be changed. Only SkipCash can change a payment.')

  /* ---- refunds */
  await r.say('To refund, refund it in the SkipCash portal. Then set the order to Refunded, and the customer is emailed.')

  await r.recapCard(
    'Payments',
    [
      'Side menu → Shop → Payments',
      'What happened: paid, not paid, or card refused',
      'Reference = SkipCash Transaction ID = order code',
      'Refund in SkipCash, then mark the order Refunded',
    ],
    {
      speak: 'To recap: Payments shows every checkout. Paid ones have an order, and their reference matches your SkipCash portal.',
    },
  )
  await r.finish()
})
