/**
 * Tutorial 06 — discount codes: make a code (EID15, 15% off above QAR 1,000,
 * ending on a chosen day), then use it at checkout on the website side. Every
 * field on the code is explained, including limits, dates, pieces, the email
 * lock, Times used, Source, Active and why a used code cannot be deleted.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`);
 * the piece and its sizes are made off camera, and size M is put in the bag
 * as a customer would. Narrated: `npx tsx scripts/record/narrate.ts
 * 06-discount-codes` before the take.
 */
import { addPiece, addSizes } from '../demo-data'
import { BASE, Recording } from '../stage'

const r = new Recording('06-discount-codes')
await r.start({
  adminPath: '/admin/collections/discountCodes',
  prepare: async (page) => {
    await page.goto(`${BASE}/products/al-shaheen-nights-silk-pyjama-set`, { waitUntil: 'networkidle' })
    await page.locator('main button', { hasText: /^M$/ }).first().click()
    await page.locator('main button', { hasText: /add to bag/i }).first().click()
    await page.waitForTimeout(2500)
  },
  setup: async (api) => {
    await addSizes(api, await addPiece(api))
  },
  sitePath: '/checkout',
  warm: ['/admin/collections/discountCodes/create'],
})

/** A labelled field as a whole (label, box and description), for pointing at. */
const field = (label: RegExp) =>
  r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: label }) }).first()

await r.run(async () => {
  await r.titleCard('Shop', 'Discount codes', ['Make a code, and see it at checkout'], {
    speak: 'How to make a discount code, and what your customers see when they use it.',
  })

  await r.say('Discount codes lists every code: yours, and the ones the reward wheel gives out.')
  await r.point(r.admin.locator('h1').first(), 1.5)
  await r.say('Click Create new.')
  await r.click(r.admin.getByRole('link', { name: /create new/i }).first())
  await r.admin.locator('#field-code').waitFor()

  /* ---- the code */
  await r.say('Type the code customers will enter. Small or capital letters both work.')
  await r.type(r.admin.locator('#field-code'), 'EID15', { delay: 110 })
  await r.say('Type chooses the kind of discount: a percentage, an amount off, free delivery, or free embroidery.')
  await r.click(field(/^type/i).locator('.rs__control'))
  await r.point(r.admin.locator('.rs__menu'), 2.5)
  await r.click(r.admin.locator('.rs__option').filter({ hasText: /^Percentage off$/ }))
  await r.say('Amount is the number: 15 means 15% off.')
  await r.type(r.admin.locator('#field-value'), '15', { delay: 120 })

  /* ---- limits */
  await r.say('Minimum spend, in riyals, counts the pieces and embroidery in the bag. Empty means no minimum.')
  await r.type(r.admin.locator('#field-minSpendQar'), '1000', { delay: 120 })
  await r.say('Total uses allowed caps how often the code works, for everyone together. Empty means no limit.')
  await r.point(r.admin.locator('#field-usageLimit'), 1.2)
  await r.say('Uses per customer is how often one email may use it. One is usual.')
  await r.point(r.admin.locator('#field-perCustomerLimit'), 1.2)

  /* ---- dates */
  await r.say('Starts and Ends are days, in Qatar time. Empty Starts means it works straight away.')
  await r.point(field(/^starts$/i), 1.2)
  await r.say('Choose the last day it works. It stops at the end of that day.')
  await r.click(field(/^ends$/i).locator('input'))
  await r.click(r.admin.locator('.react-datepicker__day--030:not(.react-datepicker__day--outside-month)').first())

  await r.say('Only for these pieces limits the code to the pieces you choose. Empty means every piece.')
  await r.point(field(/only for these pieces/i), 1.5)

  /* ---- the right-hand side */
  await r.say('On the right, Times used counts the paid orders that used this code.')
  await r.point(field(/times used/i), 1.5)
  await r.say('Source shows whether you made the code, or the reward wheel did.')
  await r.point(field(/^source$/i), 1.2)
  await r.say('Only for this email lets just one customer use it. The wheel fills it in for its winners.')
  await r.point(r.admin.locator('#field-issuedToEmail'), 1.2)
  await r.say('Untick Active at any time to stop the code working.')
  await r.point(r.admin.locator('#field-active'), 1.2)

  await r.say('Click Save. The code works straight away.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.say('The three dots hold Delete. A code that has been used stays with its orders, so untick Active instead.')
  await r.point(r.admin.locator('.doc-controls__popup').first(), 1.5)

  /* ---- at checkout */
  await r.say('On your website, a customer has a piece in the bag and is at checkout.')
  await r.point(r.site.getByText('Al Shaheen Nights').first(), 1.5, 1.5)
  await r.say('Once they choose where it is going, they type the code and click Apply.')
  await r.point(r.site.locator('#cityKey'), 0.8, 1.5)
  await r.site.locator('#cityKey').selectOption({ label: 'Doha' })
  await r.type(r.site.locator('#discountCode'), 'eid15', { delay: 120 })
  await r.click(r.site.getByRole('button', { name: /^apply$/i }))
  await r.site.getByText(/EID15 applied/i).waitFor()
  await r.say('The discount shows in their order, before they pay.')
  await r.point(r.site.getByText('Discount', { exact: true }).first(), 2.5, 1.5)

  await r.recapCard(
    'Discount codes',
    [
      'Discount codes → Create new → code, type, amount',
      'Minimum spend, uses and dates are optional',
      'Save: it works at once',
      'Untick Active to stop a code',
    ],
    { speak: 'To recap: make the code, set any limits you want, and untick Active to stop it.' },
  )
  await r.finish()
})
