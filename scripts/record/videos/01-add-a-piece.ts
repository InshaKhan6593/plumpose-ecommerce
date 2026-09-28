/**
 * Tutorial 01 — add a new piece: name, words, photos, fabric, price,
 * collection, publish, and see it in the shop. Sizes are video 02, sales 03.
 *
 * Every other control on these screens is pointed at and explained, even
 * where the video does not use it (the client asked for this).
 *
 * Starts from the demo database with no products
 * (`sh scripts/record/reset-demo.sh reset`); output in ../recordings/01-add-a-piece.
 */
import { Recording } from '../stage'

const TITLE = 'Al Shaheen Nights — Silk Pyjama Set'
const SLUG = 'al-shaheen-nights-silk-pyjama-set'
const PHOTOS: [file: string, alt: string][] = [
  ['04-standing-window-full.jpg', 'Al Shaheen Nights silk pyjama set, full length by a window'],
  ['06-print-macro-whaleshark.jpg', 'The whale shark print, close up'],
  ['02-seated-armchair.jpg', 'Seated in a blue armchair wearing the set'],
]

const r = new Recording('01-add-a-piece')
await r.start({
  adminPath: '/admin/collections/products',
  sitePath: '/shop',
  warm: ['/admin/collections/products/create', '/admin/collections/media/create'],
})

const tab = (name: string) => r.admin.getByRole('button', { name, exact: true })
const field = (id: string) => r.admin.locator(`#field-${id}`)

await r.run(async () => {
  await r.titleCard('Products', 'Add a new piece', ['Name, words, photos, fabric and price — then publish'])

  /* ---- open a new piece */
  await r.say('Your pieces live under Products. The shop is empty for now.')
  await r.point(r.admin.getByRole('heading', { name: 'Products' }).first())
  await r.say('Trash, at the top, holds pieces you delete, so you can bring them back.')
  await r.point(r.admin.getByText(/^trash$/i).first(), 2)
  await r.say('Click Create new.')
  await r.click(r.admin.locator('a[href$="/admin/collections/products/create"]').first())
  await field('title').waitFor()

  /* ---- name and words */
  await r.say('Type the name of the piece, as customers will see it.')
  await r.type(field('title'), TITLE)
  await r.say('On the right you can see the web address it will get. It is made for you when you save.')
  await r.point(r.admin.getByText(/made from the title when you save/i), 2)
  await r.say('Unlock lets you change the address. Only do it before publishing — later, old links stop working.')
  await r.point(r.admin.locator('#field-slug-lock'), 2)

  await r.say('Write two or three sentences about the piece.')
  await r.type(
    r.admin.locator('.rich-text-lexical [contenteditable=true]').first(),
    'Inspired by the tranquil waters of Qatar and the seasonal gathering of whale sharks, rendered on lustrous silk with an exclusive hand-illustrated print.',
    { clear: false, delay: 22 },
  )
  await r.say('The bar above the text makes words bold, italic, underlined, or a link.')
  await r.point(r.admin.locator('[class*="fixed-toolbar"]').first(), 2)

  /* ---- photos */
  await r.say('Now the photos. Click Add photo, then Create new, and choose a photo from your computer.')
  for (const [i, [file, alt]] of PHOTOS.entries()) {
    await r.click(r.admin.getByRole('button', { name: /add photo/i }))
    // Only the new, empty row still offers Create new.
    await r.click(r.admin.getByRole('button', { name: /^create new$/i }).last())
    const drawer = r.admin.locator('dialog[open], .drawer--is-open, [class*="drawer__content"]').last()
    await r.upload(drawer.getByRole('button', { name: /select a file/i }), file)
    if (i === 0) await r.say('Describe the photo in a few words, then click Save.')
    await r.type(drawer.locator('#field-alt'), alt, { delay: i === 0 ? 45 : 25 })
    await r.click(drawer.getByRole('button', { name: /^save$/i }))
    await drawer.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined)
    if (i === 0) await r.say('The first photo is the main one in the shop. Add the others the same way.')
    if (i === 1) await r.say('Add as many photos as you like. Drag them to change the order.')
  }
  await r.say('Choose from existing picks a photo you uploaded before, instead of a new one.')
  await r.say('Each photo’s ⋯ menu moves it up or down, or removes it from this piece.')
  await r.point(r.admin.locator('#field-gallery .array-actions').first(), 2)

  /* ---- fabric & care */
  await r.say('Under Fabric & Care, fill in what the piece is made of.')
  await r.click(tab('Fabric & Care'))
  await r.type(field('fabric'), 'in 22-momme silk', { delay: 40 })
  await r.type(field('colour'), 'Midnight Navy', { delay: 40 })
  await r.type(field('composition'), '97% silk, 3% spandex', { delay: 40 })
  await r.say('Fabric weight, Trims and Fit note are optional. Filled in, they appear under Material & care on the piece’s page.')
  await r.point(field('fitNote'), 3)
  await r.say('The three text boxes below add your own words to Material & care, Delivery & returns, and Gift wrapping.')
  await r.point(r.admin.getByText(/^delivery & returns$/i).first(), 3)
  await r.say('Made to order ticked: a size with no stock can still be bought, and the customer is told it takes a little longer.')
  await r.point(field('madeToOrder'), 3.5)
  await r.say('Unticked: a size with no stock shows as sold out.')
  await r.say('Offer hand embroidery: untick it if this piece should not have embroidery.')
  await r.point(field('personalisationEnabled'), 3)

  /* ---- price */
  await r.say('Under Price & sizes, type the price in riyals.')
  await r.click(tab('Price & sizes'))
  await r.type(r.admin.locator('#priceInQAR, #field-priceInQAR').first(), '1399')
  await r.say('Stock is how many you have ready to send. Sizes, with their own stock, have their own video.')
  await r.point(field('inventory'), 2.5)
  await r.say('Was price is for a sale — that is video 3. Leave it empty.')
  await r.point(r.admin.locator('#compareAtPriceInQAR').first(), 2)

  /* ---- google */
  await r.say('Google & sharing is optional. Left empty, Google uses the name, the description and the first photo.')
  await r.click(tab('Google & sharing'))
  await r.point(r.admin.getByText(/the red “missing” marks can be ignored/i).first(), 3.5)

  /* ---- collection */
  await r.say('On the right, choose the collection it belongs to.')
  await r.click(r.admin.locator('#field-categories .rs__control, #field-categories').first())
  await r.click(r.admin.getByText('Resort 2026', { exact: true }).last())
  await r.say('The + beside it makes a new collection, for example for next season.')
  await r.point(r.admin.locator('#field-categories').getByRole('button', { name: /add new/i }).first(), 2)

  /* ---- publish */
  await r.say('Save draft keeps your work without showing it in the shop. Publish changes puts it live.')
  await r.point(r.admin.locator('#action-save-draft'), 2)
  await r.say('Click Publish changes.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  await r.say('It is in your shop straight away.')
  await r.showOnSite('/shop', (site) => site.getByText('Al Shaheen Nights', { exact: false }))
  await r.say('And it has its own page, with your photos and words.')
  await r.showOnSite(`/products/${SLUG}`, (site) => site.getByRole('heading', { name: /Al Shaheen Nights/ }))

  /* ---- also on a saved piece */
  await r.say('Once saved, a few more buttons appear at the top.')
  await r.say('The eye shows the page beside the form as you edit. The arrow opens it in a new tab, even a draft.')
  await r.point(r.admin.getByRole('button', { name: /live preview/i }).first(), 3)
  await r.say('Versions keeps every save. You can look back, and restore an older one.')
  await r.point(r.admin.getByRole('link', { name: /versions/i }).first(), 2.5)
  await r.say('The ⋯ menu: Duplicate copies the piece to start a similar one. Unpublish hides it from the shop.')
  await r.point(r.admin.locator('.doc-controls__popup, .doc-controls__dots').first(), 3)
  await r.say('Delete moves it to Trash, where you can restore it.')

  await r.recapCard('Add a new piece', [
    'Products → Create new',
    'Name, a few sentences, photos',
    'Fabric & Care, then the price',
    'Save draft to keep it hidden, Publish changes to put it live',
  ])
  await r.finish()
})
