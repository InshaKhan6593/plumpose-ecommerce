/**
 * Tutorial 15 — currencies (Shop settings → Currencies): prices shown in a
 * visitor's currency, always charged in riyals; a price set by hand for the
 * markets that matter, today's rate for the rest, and the check between them.
 * On camera: the pound price set by hand becomes 295, seen on the website
 * side after choosing pounds in the country and currency picker.
 *
 * The switches — show currencies at all, start from where they are — are in
 * Site settings → Currencies (video 07); pointed at, not repeated.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`).
 * Off camera: the piece, and today's rates fetched (as the morning job does),
 * so the rate columns are filled. Narrated: `npx tsx scripts/record/narrate.ts 15-currencies`.
 */
import { addPiece } from '../demo-data'
import { BASE, Recording } from '../stage'

const SLUG = 'al-shaheen-nights-silk-pyjama-set'

const r = new Recording('15-currencies')
await r.start({
  adminPath: '/admin/collections/currencies',
  setup: async (api) => {
    await addPiece(api)
    const res = await api.post(`${BASE}/api/currencies/refresh-rates`)
    if (!res.ok()) throw new Error(`refresh the rates: ${res.status()} ${await res.text()}`)
  },
  sitePath: `/products/${SLUG}`,
})

const row = (code: string) => r.admin.locator('.table tbody tr').filter({ hasText: code }).first()
const heading = (text: RegExp) => r.admin.locator('thead th').filter({ hasText: text })

await r.run(async () => {
  await r.titleCard('Shop settings', 'Currencies', ['Prices in your visitors’ own currency'], {
    speak: 'How to set what your pieces cost in other currencies.',
  })

  /* ---- the list */
  await r.say('Currencies is in the side menu, under Shop settings. Every card is still charged in riyals.')
  await r.point(r.admin.locator('.table').first(), 2, 1.3)
  await r.say('Price set by hand is what Al Shaheen Nights costs in that currency, exactly as you want it shown.')
  await r.point(heading(/price set by hand/i), 1.8)
  await r.say('At today’s rate is the same piece at the exchange rate. Difference is how far your price is from it.')
  await r.point(heading(/today/i), 1.2)
  await r.point(heading(/^difference$/i), 1.2)
  await r.say('The rates update by themselves every morning. Rate updated shows when.')
  await r.point(heading(/rate updated/i), 1.5)
  await r.say('Refresh exchange rates fetches them now. It never changes a price you set by hand.')
  await r.point(r.admin.getByRole('button', { name: /refresh exchange rates/i }), 2)
  await r.say('Search finds a currency by its code or name. Columns and Filters change only what this list shows you.')
  await r.point(r.admin.locator('#toggle-list-columns'), 1)
  await r.point(r.admin.locator('#toggle-list-filters'), 1)

  /* ---- pounds, opened */
  await r.say('Type GBP to find British pounds, and open it.')
  const search = r.admin.getByPlaceholder(/search/i).first()
  await r.type(search, 'GBP', { delay: 140 })
  await row('GBP').waitFor()
  await r.click(row('GBP').locator('a').first())
  await r.admin.locator('#field-priceOverride').waitFor()
  await r.say('Code, Name and Symbol are how the currency is written. Decimals is how many places are shown.')
  await r.point(r.admin.locator('#field-symbol'), 1)
  await r.point(r.admin.locator('#field-decimals'), 1)
  await r.say('Step rounds delivery prices, to the nearest five pounds here, so they read as round numbers.')
  await r.point(r.admin.locator('#field-step'), 1.5)
  await r.say('Rate, At today’s rate and Difference are filled in for you, as a check.')
  await r.point(r.admin.locator('#field-rate'), 1)
  await r.point(r.admin.locator('#field-difference'), 1.2)
  await r.say('Empty the price set by hand, and the piece is shown at today’s rate instead.')
  await r.point(r.admin.locator('#field-priceOverride'), 1.5)
  await r.say('The three dots hold Create new, Duplicate, and Delete, which removes the currency from the website.')
  await r.point(r.admin.locator('.doc-controls__popup').first(), 1.2)

  /* ---- 285 becomes 295 */
  await r.say('Now set Al Shaheen Nights at 295 pounds.')
  await r.type(r.admin.locator('#field-priceOverride'), '295', { delay: 140 })
  await r.say('Click Save. Visitors see the new price within five minutes.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  /* ---- the website, in pounds */
  // Off camera: the website keeps its currency list up to five minutes
  // (/api/locale/options, max-age=300); clearing the browser's copy stands in
  // for the wait.
  const cdp = await r.page.context().newCDPSession(r.page)
  await cdp.send('Network.clearBrowserCache')
  await r.goSite(`/products/${SLUG}`)
  await r.overview()
  await r.say('On the website, visitors choose their country and currency at the top of the page.')
  const picker = r.site.getByRole('button', { name: /country and currency/i }).first()
  await r.click(picker)
  const currency = r.site.locator('#locale-currency')
  await currency.waitFor()
  await r.point(currency, 1.2, 1.5)
  await currency.selectOption('GBP')
  await r.click(r.site.getByRole('button', { name: /^continue$/i }))
  const price = r.site.getByText(/£\s?295/).first()
  await price.waitFor({ timeout: 20_000 })
  await r.say('The piece now shows £295. Checkout still charges riyals, and says so.')
  await r.point(price, 2, 1.6)

  await r.say('Showing currencies at all, and starting from where visitors are, are in Site settings, on the Currencies tab.')

  await r.recapCard(
    'Currencies',
    [
      'Side menu → Shop settings → Currencies',
      'Price set by hand: shown exactly',
      'Empty it to use today’s rate',
      'Cards are always charged in riyals',
    ],
    {
      speak: 'To recap: set a price by hand for the currencies that matter, leave the rest to today’s rate, and remember every card is charged in riyals.',
    },
  )
  await r.finish()
})
