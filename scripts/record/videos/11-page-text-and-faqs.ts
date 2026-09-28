/**
 * Tutorial 11 — the words on the pages: Page text (one tab per page; an
 * emptied box brings back the original words), FAQs (add one, its group,
 * Published, drag to reorder), and where Press and Made for You are kept.
 * On camera: the Contact page's introduction changes, and a new FAQ appears.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`).
 * Narrated: `npx tsx scripts/record/narrate.ts 11-page-text-and-faqs`
 * before the take.
 */
import { Recording } from '../stage'

const INTRO = 'Write to us, or message us on WhatsApp. We usually reply within a day.'
const QUESTION = 'Can I send a piece as a gift?'

const r = new Recording('11-page-text-and-faqs')
await r.start({
  adminPath: '/admin/globals/pageText',
  sitePath: '/contact',
  warm: ['/admin/collections/faqs/create', '/faq', '/admin/collections/press', '/admin/collections/projects'],
})

/** A labelled field as a whole (label, box and description), for pointing at. */
const field = (label: RegExp) =>
  r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: label }) }).first()

/** The box a visible label names, in the open tab (by the label's own `for`). */
const box = (label: RegExp) => r.admin.getByLabel(label).filter({ visible: true }).first()

const tab = (name: string) => r.admin.getByRole('button', { name, exact: true })

const openMenu = async () => {
  // The admin may already have its menu open (a closed menu's links still count as visible).
  if (!(await r.admin.locator('.template-default--nav-open').count())) {
    await r.click(r.admin.getByRole('button', { name: /open menu/i }))
  }
}

await r.run(async () => {
  await r.titleCard('Content', 'Page text and FAQs', ['The words on your pages, and your questions'], {
    speak: 'How to change the words on your pages, and add a question to your FAQ page.',
  })

  /* ---- Page text */
  await r.say('Page text is in the side menu, under Settings. It holds the words on your homepage and your other pages.')
  await r.point(r.admin.locator('h1').first(), 1.5)
  await r.say('Each tab is one page. Prices, fees and delivery times are not here: they come from their own settings.')
  await r.point(r.admin.locator('.tabs-field__tabs').first(), 2.5)

  await r.say('Open the Contact tab, and change the introduction.')
  await r.click(tab('Contact'))
  await r.type(box(/^introduction$/i), INTRO, { delay: 40 })
  await r.say('If you empty a box, the original words come back, so a page is never blank.')
  await r.point(box(/^introduction$/i), 1.5)
  await r.say('Subjects to choose from are the options on your contact form, one per line.')
  await r.point(box(/subjects to choose from/i), 1.5)
  await r.say('Click Save. The page changes straight away.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.showOnSite('/contact', (site) => site.getByText(INTRO))

  /* ---- FAQs */
  await r.say('FAQs is under Content. Drag the rows to change their order on the page.')
  await openMenu()
  await r.click(r.admin.getByRole('link', { name: 'FAQs', exact: true }).first())
  await r.admin.locator('h1').filter({ hasText: 'FAQs' }).first().waitFor()
  await r.point(r.admin.locator('.table').first(), 2)
  await r.say('Click Create new, and type the question.')
  await r.click(r.admin.getByRole('link', { name: /create new/i }).first())
  await r.admin.locator('#field-question').waitFor()
  await r.type(r.admin.locator('#field-question'), QUESTION, { delay: 55 })
  await r.say('Then the answer. You can make words bold, or add a link, as in an email.')
  await r.type(
    r.admin.locator('[contenteditable="true"]').first(),
    'Yes. At checkout, tick This is a gift and write your message. We add a handwritten card and leave the prices out.',
    { delay: 30 },
  )
  await r.say('Category is the group it shows under on the page.')
  await r.point(field(/^category/i), 1.5)
  await r.say('Untick Published to hide a question without deleting it. Click Save.')
  await r.point(r.admin.locator('#field-published'), 1.2)
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.showOnSite('/faq', (site) => site.getByText(QUESTION))

  /* ---- Press and Made for You */
  await r.say('Press is under Content too. Each article has its publication, headline, a few words, the link, date and logo.')
  await openMenu()
  await r.click(r.admin.getByRole('link', { name: 'Press', exact: true }).first())
  await r.admin.locator('h1').filter({ hasText: 'Press' }).first().waitFor()
  await r.say('Until you add one, your Press page shows a short note instead.')
  await r.point(r.admin.getByRole('link', { name: /create new/i }).first(), 1.5)
  await r.say('Made for You holds your commissions: bridal, bespoke, embroidery and collaborations, each with its photos.')
  await openMenu()
  await r.click(r.admin.getByRole('link', { name: 'Made for You', exact: true }).first())
  await r.admin.locator('h1').filter({ hasText: 'Made for You' }).first().waitFor()
  await r.point(r.admin.getByRole('link', { name: /create new/i }).first(), 1.5)

  await r.recapCard(
    'Page text and FAQs',
    [
      'Settings → Page text: one tab per page',
      'An emptied box brings back the original words',
      'Content → FAQs: Create new, drag to reorder',
      'Press and Made for You are under Content',
    ],
    {
      speak: 'To recap: Page text holds the words on your pages, one tab each. FAQs, Press and Made for You are under Content.',
    },
  )
  await r.finish()
})
