/**
 * Tutorial 14 — embroidery options (Shop settings → Personalisation): the four
 * kinds (placements, styles, symbols, thread colours), their order, Active,
 * and what she can and cannot add. On camera: a new thread colour, Champagne,
 * appears in the embroidery drawer on the website side.
 *
 * The rules — fee, letters, placements per piece, lead time, returns — are in
 * Site settings → Personalisation (video 07); pointed at, not repeated.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`),
 * which has her options (§4); the piece is made off camera so the drawer can
 * be opened. Narrated: `npx tsx scripts/record/narrate.ts 14-embroidery-options`.
 */
import { addPiece } from '../demo-data'
import { Recording } from '../stage'

const SLUG = 'al-shaheen-nights-silk-pyjama-set'

const r = new Recording('14-embroidery-options')
await r.start({
  adminPath: '/admin/collections/personalisationOptions?limit=25',
  setup: async (api) => {
    await addPiece(api)
  },
  sitePath: `/products/${SLUG}`,
  warm: ['/admin/collections/personalisationOptions/create'],
})

const row = (name: string) => r.admin.locator('.table tbody tr').filter({ hasText: name }).first()

/** The website's embroidery drawer, opened from the piece's page. */
const openDrawer = async () => {
  await r.goSite(`/products/${SLUG}`)
  const personalise = r.site.getByRole('button', { name: /^personalise$/i }).first()
  await personalise.waitFor({ timeout: 20_000 })
  await r.click(personalise)
  await r.site.getByRole('dialog').first().waitFor()
}

await r.run(async () => {
  await r.titleCard('Shop settings', 'Embroidery options', ['Where it goes, the styles, symbols and thread colours'], {
    speak: 'How to change what customers can choose for hand embroidery.',
  })

  /* ---- the list */
  await r.say('Personalisation is in the side menu, under Shop settings. It lists everything customers choose from.')
  await r.point(r.admin.locator('.table').first(), 2, 1.3)
  await r.say('Type shows the four kinds: where it goes, the style, the symbol, and the thread colour.')
  await r.point(r.admin.locator('thead th').filter({ hasText: /^type$/i }), 1.5)
  await r.say('Customers see each kind in this order. Drag a row by the dots at its left to move it.')
  await r.point(row('Pocket').locator('td').first(), 1.5)
  await r.say('Hex is a thread’s colour. A tick under Active means customers can choose it.')
  await r.point(r.admin.locator('thead th').filter({ hasText: /^hex$/i }), 1)
  await r.point(r.admin.locator('thead th').filter({ hasText: /^active$/i }), 1)
  await r.say('The box on each row selects it, to change or delete several at once.')
  await r.point(row('Pocket').locator('td').nth(1), 1.2)
  await r.say('Search finds an option by name. Columns and Filters change only what this list shows you.')
  await r.point(r.admin.locator('#toggle-list-columns'), 1)
  await r.point(r.admin.locator('#toggle-list-filters'), 1)
  await r.say('Per page, at the bottom, sets how many show at once.')
  await r.point(r.admin.getByRole('button', { name: /per page/i }), 1.2)

  /* ---- a thread colour, opened */
  await r.say('Open an option to change it. Here, the thread colour Gold.')
  await r.click(row('Gold').locator('a').first())
  await r.admin.locator('#field-name').waitFor()
  await r.say('Name is what customers see. Change it here, and the website follows.')
  await r.point(r.admin.locator('#field-name'), 1.2)
  await r.say('Hex is the colour of the swatch, as a code like #BD9540.')
  await r.point(r.admin.locator('#field-hex'), 1.5)
  await r.say('Note is a short line under a style’s name. On the other kinds it is not shown.')
  await r.point(r.admin.locator('#field-note'), 1.5)
  await r.say('Untick Active to stop offering it, without deleting it. Orders that already have it keep it.')
  await r.point(r.admin.locator('#field-active'), 1.5)
  await r.say('The three dots hold Create new, Duplicate, and Delete, which removes it for good.')
  await r.point(r.admin.locator('.doc-controls__popup').first(), 1.2)

  /* ---- symbols are drawings */
  await r.say('A symbol is a drawing. You can rename one or switch it off, but a new symbol is drawn by your developer.')
  await r.goAdmin('/admin/collections/personalisationOptions?limit=25')
  await r.click(row('Crescent moon').locator('a').first())
  await r.admin.locator('#field-name').waitFor()
  await r.point(r.admin.locator('#field-svgPath'), 2)

  /* ---- a new thread colour */
  await r.say('Now add a thread colour. Go back to the list and click Create new.')
  await r.goAdmin('/admin/collections/personalisationOptions?limit=25')
  await r.click(r.admin.getByRole('link', { name: /create new/i }).first())
  await r.admin.locator('#field-name').waitFor()
  await r.say('For Type, choose Thread colour.')
  await r.click(r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: /^type/i }) }).locator('.rs__control').first())
  await r.click(r.admin.locator('.rs__option').filter({ hasText: /^Thread colour$/ }).first())
  await r.say('Type its name, and its colour code.')
  await r.type(r.admin.locator('#field-name'), 'Champagne', { delay: 110 })
  await r.type(r.admin.locator('#field-hex'), '#D8C3A5', { delay: 120 })
  await r.say('Click Save. It is offered straight away.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  await r.overview()
  await r.say('On the piece’s page, customers click Personalise.')
  await openDrawer()
  const swatch = r.site.getByRole('button', { name: 'Champagne', exact: true })
  await swatch.waitFor({ timeout: 20_000 })
  await r.say('Champagne is now among the thread colours, at the end. Drag it in the list to move it.')
  // Chosen, so the name beside the swatches reads Champagne, not the default Cream.
  await r.click(swatch)
  await r.point(swatch, 1.5, 1.6)

  await r.say('The price, how many letters, and how long embroidery takes are in Site settings, on the Personalisation tab.')

  await r.recapCard(
    'Embroidery options',
    [
      'Side menu → Shop settings → Personalisation',
      'Drag the dots to change the order',
      'Untick Active to stop offering one',
      'New symbols: ask your developer',
    ],
    {
      speak: 'To recap: add or rename placements, styles and thread colours here, drag to change their order, and untick Active to stop offering one.',
    },
  )
  await r.finish()
})
