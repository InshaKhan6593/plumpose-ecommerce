/**
 * Tutorial 03 — a sale: put a piece on sale with a was-price, see it crossed
 * out on the website, and end the sale.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`);
 * the piece from video 01 is made off camera first. Output in
 * ../recordings/03-sale-price.
 */
import { addPiece } from '../demo-data'
import { Recording } from '../stage'

const SLUG = 'al-shaheen-nights-silk-pyjama-set'

const r = new Recording('03-sale-price')
await r.start({
  adminPath: '/admin/collections/products',
  setup: async (api) => {
    await addPiece(api)
  },
  sitePath: '/shop',
})

await r.run(async () => {
  await r.titleCard('Products', 'Put a piece on sale', ['Show the old price crossed out, then end the sale'])

  /* ---- open the piece */
  await r.say('Open Products, and click the piece.')
  await r.click(r.admin.getByRole('link', { name: /Al Shaheen Nights/ }).first())
  await r.admin.locator('#field-title').waitFor()

  await r.say('Open the Price & sizes tab.')
  await r.click(r.admin.getByRole('button', { name: 'Price & sizes', exact: true }))

  /* ---- the sale */
  await r.say('The price is what customers pay. It stays as it is.')
  await r.point(r.admin.locator('#priceInQAR, #field-priceInQAR').first(), 1.5)

  await r.say('In Was price, type the price it used to be. It must be higher than the price.')
  await r.type(r.admin.locator('#compareAtPriceInQAR').first(), '1600', { delay: 120 })

  await r.say('Stock and the sizes tick on this tab are in videos 1 and 2. A sale changes neither.')
  await r.point(r.admin.locator('#field-inventory'), 2)
  await r.say('Save draft would keep the sale hidden until you publish. To start it now, click Publish changes.')
  await r.point(r.admin.locator('#action-save-draft'), 2)
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  await r.say('In your shop, the old price is crossed out beside the new one.')
  await r.showOnSite('/shop', (site) => site.locator('main').locator('s, del, .line-through').first())

  await r.say('The same on the piece’s own page.')
  await r.showOnSite(`/products/${SLUG}`, (site) => site.locator('main').locator('s, del, .line-through').first())

  /* ---- end the sale */
  await r.say('To end the sale, clear the Was price box.')
  await r.type(r.admin.locator('#compareAtPriceInQAR').first(), '', { delay: 0 })

  await r.say('Then click Publish changes again.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  await r.say('The piece is back at its normal price.')
  await r.showOnSite(`/products/${SLUG}`, (site) => site.locator('main').getByText(/QAR\s*1,399/).first())

  await r.recapCard('A sale', [
    'Price & sizes → Was price: the old, higher price',
    'Publish changes — it shows crossed out',
    'Clear Was price and publish to end the sale',
  ])
  await r.finish()
})
