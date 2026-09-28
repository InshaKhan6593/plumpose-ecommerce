/**
 * Tutorial 12 — collections and photos: make a collection (its web address
 * made from the title), put a piece in it from the piece's sidebar, and see
 * it as a filter on the shop page; then the photo library, with the photo's
 * description and what replacing or deleting one does.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`);
 * the piece is made off camera, in Resort 2026. Narrated: `npx tsx
 * scripts/record/narrate.ts 12-collections-and-photos` before the take.
 */
import { addPiece } from '../demo-data'
import { Recording } from '../stage'

const COLLECTION = 'The Eid Edit'

let piece = 0
const r = new Recording('12-collections-and-photos')
await r.start({
  adminPath: '/admin/collections/categories',
  setup: async (api) => {
    piece = await addPiece(api)
  },
  sitePath: '/shop',
  warm: ['/admin/collections/categories/create', '/admin/collections/media'],
})

const openMenu = async () => {
  // The admin may already have its menu open (a closed menu's links still count as visible).
  if (!(await r.admin.locator('.template-default--nav-open').count())) {
    await r.click(r.admin.getByRole('button', { name: /open menu/i }))
  }
}

await r.run(async () => {
  await r.titleCard('Content', 'Collections and photos', ['Group your pieces, and look after your photos'], {
    speak: 'How to make a new collection, put pieces in it, and look after your photos.',
  })

  /* ---- Collections */
  await r.say('Collections is in the side menu, under Content. Each one is a group on your shop page, like Resort 2026.')
  await r.point(r.admin.locator('.table').first(), 1.5)
  await r.point(r.site.getByRole('link', { name: /resort 2026/i }).filter({ visible: true }).first(), 1.5, 1.3)
  await r.say('Click Create new, and type its name.')
  await r.click(r.admin.getByRole('link', { name: /create new/i }).first())
  await r.admin.locator('#field-title').waitFor()
  await r.type(r.admin.locator('#field-title'), COLLECTION, { delay: 90 })
  await r.say('The web address is made from the name. You rarely need to change it.')
  await r.point(r.admin.locator('#field-slug'), 2)
  await r.say('Click Save.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  /* ---- a piece in it */
  await r.say('Now open a piece. On the right, Collection says which groups it is in. A piece can be in more than one.')
  await r.goAdmin(`/admin/collections/products/${piece}`)
  const collection = r.admin.locator('#field-categories')
  await collection.waitFor()
  await r.click(collection.locator('.rs__control'))
  await r.click(r.admin.locator('.rs__option').filter({ hasText: COLLECTION }))
  await r.say('Click Publish changes.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.say('Your shop page now has the new collection. Click it, and it shows only its pieces.')
  await r.showOnSite('/shop', (site) => site.getByRole('link', { name: new RegExp(COLLECTION, 'i') }).filter({ visible: true }))

  /* ---- Photos */
  await r.say('Photos, under Content, holds every photo you have uploaded, wherever it is used.')
  await openMenu()
  await r.click(r.admin.getByRole('link', { name: 'Photos', exact: true }).first())
  await r.admin.locator('h1').filter({ hasText: 'Photos' }).first().waitFor()
  await r.point(r.admin.locator('.table, .collection-list').first(), 1.5)
  await r.say('Open one. Describe the photo is a few words about what is in it. Google reads them, and so do people who cannot see it.')
  await r.click(r.admin.locator('.table tbody tr a').first())
  await r.admin.locator('#field-alt').waitFor()
  await r.point(r.admin.locator('#field-alt'), 2)
  await r.say('Replacing a photo here changes it everywhere it is used. Delete a photo only when no piece uses it.')
  await r.point(r.admin.locator('.file-details, .upload').first(), 2)

  await r.recapCard(
    'Collections and photos',
    [
      'Content → Collections → Create new',
      'Add a piece from its Collection box, on the right',
      'Content → Photos: every photo you uploaded',
      'Describe each photo in a few words',
    ],
    {
      speak: 'To recap: make a collection, add pieces to it from their Collection box, and describe every photo in a few words.',
    },
  )
  await r.finish()
})
