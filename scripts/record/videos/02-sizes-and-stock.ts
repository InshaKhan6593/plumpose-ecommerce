/**
 * Tutorial 02 — sizes and stock: turn on sizes for a piece, add S, M and L
 * with their stock, see the sizes on the website, and change a size's stock.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`);
 * the piece from video 01 is made off camera first. Output in
 * ../recordings/02-sizes-and-stock.
 */
import { addPiece } from '../demo-data'
import { Recording } from '../stage'

const SLUG = 'al-shaheen-nights-silk-pyjama-set'
const SIZES: [size: string, stock: string][] = [
  ['S', '3'],
  ['M', '5'],
  ['L', '2'],
]

const r = new Recording('02-sizes-and-stock')
await r.start({
  adminPath: '/admin/collections/products',
  setup: async (api) => {
    await addPiece(api)
  },
  sitePath: `/products/${SLUG}`,
})

await r.run(async () => {
  await r.titleCard('Products', 'Sizes & stock', ['Add sizes to a piece, each with its own stock'], {
    speak: 'How to add sizes, each with its own stock.',
  })

  /* ---- open the piece */
  await r.say('Open Products, and click the piece.')
  await r.click(r.admin.getByRole('link', { name: /Al Shaheen Nights/ }).first())
  await r.admin.locator('#field-title').waitFor()

  await r.say('Open the Price & sizes tab.')
  await r.click(r.admin.getByRole('button', { name: 'Price & sizes', exact: true }))

  /* ---- turn sizes on */
  await r.say('Tick "This piece comes in different sizes".')
  await r.click(r.admin.locator('#field-enableVariants'))
  await r.say('The piece’s own Stock box goes away. Each size keeps its own stock instead.')

  await r.say('Under Options offered, choose Size.')
  await r.click(r.admin.locator('#field-variantTypes .rs__control, #field-variantTypes').first())
  await r.click(r.admin.locator('.rs__option').filter({ hasText: /^Size$/ }).first())
  await r.say('A new size, like XL, is added first under Shop settings, in Sizes, colours & patterns.')

  await r.say('Click Publish changes, so the piece knows it comes in sizes.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  /* ---- add each size */
  await r.say('Now add each size. Click Add new, beside Sizes & stock.')
  for (const [i, [size, stock]] of SIZES.entries()) {
    // Add new stays beside the list; the big empty-list button goes once there is a size.
    await r.click(r.admin.getByRole('button', { name: /^add new$/i }).first())
    const drawer = r.admin.locator('.drawer--is-open, dialog[open]').last()
    if (i === 0) await r.say('Choose the size, then type how many you have ready to send.')
    await r.click(drawer.locator('.rs__control').first())
    await r.click(r.admin.locator('.rs__option').filter({ hasText: new RegExp(`^${size}$`) }).first())
    await r.type(drawer.locator('#field-inventory'), stock, { delay: 120 })
    if (i === 0) {
      await r.say('Product shows which piece this size belongs to. It is filled in for you.')
      await r.point(drawer.locator('#field-product'), 2)
      await r.say('Tick “This size has its own price” only if this size costs more or less than the piece.')
      await r.point(drawer.getByText(/this size has its own price/i).first(), 2.5)
      await r.say('Untick Offer this size when you cannot make it. It stays on your website, crossed out.')
      await r.point(drawer.getByText(/^offer this size$/i).first(), 2)
      await r.say('Click Save. The size is live straight away.')
    }
    await r.click(drawer.locator('#action-save'))
    await drawer.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined)
    if (i === 0) await r.say('Add the other sizes the same way.')
  }

  await r.say('Each size is listed here, with its stock.')
  await r.point(r.admin.locator('.relationship-table').first(), 2.5, 1.5)
  await r.say('Columns chooses what this list shows. You can leave it as it is.')
  await r.point(r.admin.getByRole('button', { name: /^columns$/i }).first(), 2)

  /* ---- on the website */
  await r.say('On your website, customers now choose a size.')
  await r.showOnSite(`/products/${SLUG}`, (site) =>
    site.locator('main').getByRole('button', { name: /^L$/ }),
  )

  /* ---- change stock later */
  await r.say('To change the stock later, click the size in the list.')
  const rowL = r.admin
    .locator('.relationship-table tr')
    .filter({ has: r.admin.locator('td', { hasText: /^L$/ }) })
  // The whole row opens the size; the click lands on the size itself.
  await r.click(rowL.locator('td').first(), 350, { force: true })
  const drawer = r.admin.locator('.drawer--is-open, dialog[open]').last()
  await r.say('Type the new number, and click Save. The window closes by itself.')
  await r.type(drawer.locator('#field-inventory'), '6', { delay: 120 })
  await r.click(drawer.locator('#action-save'))
  await drawer.waitFor({ state: 'detached', timeout: 20_000 })
  await r.say('The list shows the new stock straight away.')
  await r.point(rowL.locator('td').last(), 2.5)
  await r.say('To remove a size, open it, and choose Delete from the ⋯ menu at the top of its window.')

  await r.recapCard('Sizes & stock', [
    'Price & sizes → tick different sizes',
    'Options offered: Size → Publish changes',
    'Add new: choose the size, type the stock, Save',
    'Click a size to change its stock',
    'Untick Offer this size to show it crossed out',
  ], { speak: 'To recap: add each size with its stock, and update the stock as it sells.' })
  await r.finish()
})
