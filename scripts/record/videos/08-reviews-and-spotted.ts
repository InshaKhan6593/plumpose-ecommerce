/**
 * Tutorial 08 — Reviews and Spotted: nothing a customer sends shows until she
 * approves it. On camera: approve a review with a reply and feature it (seen
 * on the piece's page and the homepage), reject a spam review, and approve a
 * customer's photograph (seen on the Spotted page). Every field and sidebar
 * box is explained, including the ones she cannot change.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`); the
 * piece, two pending reviews and one pending photograph are made off camera, as
 * customers would send them. Narrated: `npx tsx scripts/record/narrate.ts
 * 08-reviews-and-spotted` before the take.
 */
import type { APIRequestContext } from '@playwright/test'

import { addPiece, uploadPhoto } from '../demo-data'
import { BASE, Recording } from '../stage'

const PIECE = '/products/al-shaheen-nights-silk-pyjama-set'
const GOOD = 'The silk is heavier than I expected, and the whale shark print is even lovelier in person.'
const REPLY = 'Thank you, Noora. We are so happy it has found a home with you.'

/** What customers send, made the way the site's forms leave it: pending, with their email. */
const customersSend = async (api: APIRequestContext) => {
  const product = await addPiece(api)
  for (const data of [
    { body: 'Cheap watches and bags at my website, click now for 90% off.', email: 'deals@example.com', name: 'Best Deals 4U', rating: 5 },
    { body: GOOD, email: 'noora@example.com', name: 'Noora A.', rating: 5, title: 'Worth every riyal' },
  ]) {
    const res = await api.post(`${BASE}/api/reviews`, { data: { ...data, product } })
    if (!res.ok()) throw new Error(`review: ${res.status()} ${await res.text()}`)
  }
  const image = await uploadPhoto(api, '02-seated-armchair.jpg', 'A customer in the Al Shaheen Nights set')
  const res = await api.post(`${BASE}/api/spotted`, {
    data: {
      caption: 'Slow Sunday mornings',
      consent: true,
      email: 'mariam@example.com',
      image,
      instagramHandle: '@mariam.doha',
      submitted: true,
    },
  })
  if (!res.ok()) throw new Error(`spotted: ${res.status()} ${await res.text()}`)
}

const r = new Recording('08-reviews-and-spotted')
await r.start({
  adminPath: '/admin/collections/reviews',
  setup: customersSend,
  sitePath: PIECE,
  warm: ['/admin/collections/spotted', '/spotted', '/'],
})

/** A labelled field as a whole (label, box and description), for pointing at. */
const field = (label: RegExp) =>
  r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: label }) }).first()

const setStatus = async (label: 'Approved' | 'Rejected') => {
  await r.click(field(/^status/i).locator('.rs__control'))
  await r.point(r.admin.locator('.rs__menu'), 1.5)
  await r.click(r.admin.locator('.rs__option').filter({ hasText: new RegExp(`^${label}$`) }))
}

const openMenu = async () => {
  // The admin may already have its menu open (a closed menu's links still count as visible).
  if (!(await r.admin.locator('.template-default--nav-open').count())) {
    await r.click(r.admin.getByRole('button', { name: /open menu/i }))
  }
}

await r.run(async () => {
  await r.titleCard('Content', 'Reviews and Spotted', ['Approve what your customers send'], {
    speak: 'How to approve, answer and hide the reviews and photos your customers send.',
  })

  /* ---- Reviews list */
  await r.say('Reviews is in the side menu, under Content. Every review a customer sends waits here.')
  await r.point(r.admin.locator('h1').first(), 1.5)
  await r.say('Nothing shows on your website until you approve it. Status says where each one is.')
  await r.point(r.admin.locator('.table').first(), 2)

  /* ---- Approve, reply, feature */
  await r.say('Open a review to read it.')
  await r.click(r.admin.getByRole('link', { name: 'Noora A.' }).first())
  await r.admin.locator('#field-reply').waitFor()
  await r.say('The piece, name, stars, title and words are the customer’s. Their email is never shown on the site.')
  await r.point(field(/^product/i), 1)
  await r.point(r.admin.locator('#field-body'), 1.5)
  await r.say('Your reply is optional. It shows under the review, as a reply from plumpose.')
  await r.type(r.admin.locator('#field-reply'), REPLY, { delay: 45 })
  await r.say('On the right, change Status to Approved.')
  await setStatus('Approved')
  await r.say('Tick Feature on the homepage to show it there too.')
  await r.click(r.admin.locator('#field-featured'))
  await r.say('Verified purchase is ticked by itself when this email has an order for this piece.')
  await r.point(r.admin.locator('#field-verifiedPurchase'), 1.5)
  await r.say('Click Save.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.say('The review is on the piece’s page, with your reply and the average stars.')
  await r.showOnSite(PIECE, (site) => site.getByText(REPLY))
  await r.say('And on your homepage.')
  await r.showOnSite('/', (site) => site.getByText(GOOD))

  /* ---- Reject */
  await r.say('This one is spam. Open it, change Status to Rejected, and Save.')
  await r.goAdmin('/admin/collections/reviews')
  await r.click(r.admin.getByRole('link', { name: 'Best Deals 4U' }).first())
  await r.admin.locator('#field-reply').waitFor()
  await setStatus('Rejected')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.say('A rejected review stays here, hidden from the site. If you delete one, it goes to the trash, where you can restore it.')

  /* ---- Spotted */
  await r.say('Spotted holds the photos customers send from your Spotted page. It is under Content too.')
  await openMenu()
  await r.click(r.admin.getByRole('link', { name: 'Spotted', exact: true }).first())
  await r.admin.locator('h1').filter({ hasText: 'Spotted' }).first().waitFor()
  await r.say('Drag the rows to change the order they show in. Create new adds a photo of your own.')
  await r.point(r.admin.locator('.table').first(), 1.5)
  await r.point(r.admin.getByRole('link', { name: /create new/i }).first(), 1)
  await r.click(r.admin.getByRole('link', { name: '@mariam.doha' }).first())
  await r.admin.locator('#field-instagramHandle').waitFor()
  await r.say('Their photo, Instagram name, caption, and a link to their post.')
  await r.point(r.admin.locator('#field-instagramHandle'), 1)
  await r.point(r.admin.locator('#field-caption'), 1)
  await r.say('On the right: sent in from your site, and they gave permission to share it. Their email is never shown.')
  await r.point(r.admin.locator('#field-consent'), 1.5)
  await r.say('Approve it and Save. Rejecting a photo a customer sent deletes the photo.')
  await setStatus('Approved')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.showOnSite('/spotted', (site) => site.getByText('@mariam.doha'))

  await r.recapCard(
    'Reviews and Spotted',
    [
      'Side menu → Content → Reviews or Spotted',
      'Nothing shows until you approve it',
      'Reply and feature on the homepage',
      'Rejected reviews stay hidden; rejected photos are deleted',
    ],
    {
      speak: 'To recap: approve what you want to show, reply if you like, and reject the rest. Nothing a customer sends shows until you approve it.',
    },
  )
  await r.finish()
})
