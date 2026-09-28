/**
 * Tutorial 10 — the reward wheel: its prizes, how weight sets how often each
 * is won, the free-embroidery prize, the code's days and Active. On camera:
 * 5% off becomes 10% off, seen on the wheel on the website side.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`),
 * which has the four prizes she chose (§45). Narrated: `npx tsx
 * scripts/record/narrate.ts 10-reward-wheel` before the take.
 */
import { Recording } from '../stage'

const r = new Recording('10-reward-wheel')
await r.start({
  adminPath: '/admin/collections/spinSegments',
  sitePath: '/our-story',
  warm: ['/'],
})

/** A labelled field as a whole (label, box and description), for pointing at. */
const field = (label: RegExp) =>
  r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: label }) }).first()

const row = (label: string) => r.admin.locator('.table tbody tr').filter({ hasText: label }).first()

await r.run(async () => {
  await r.titleCard('Shop', 'Reward wheel', ['The prizes, and how often each is won'], {
    speak: 'How to change the prizes on your reward wheel, and how often each one is won.',
  })

  /* ---- the list */
  await r.say('Reward wheel is in the side menu, under Shop. Each row is one prize on the wheel.')
  await r.point(r.admin.locator('.table').first(), 2)
  await r.say('Weight is how often a prize is won, compared with the others. 5% off, at 40, is won twice as often as Roll again, at 20.')
  await r.point(row('5% off'), 1.5)
  await r.point(row('Roll again'), 1.5)

  /* ---- the free embroidery prize */
  await r.say('Open a prize to change it.')
  await r.click(row('Free embroidery').locator('a').first())
  await r.admin.locator('#field-label').waitFor()
  await r.say('Label is the words on the wheel.')
  await r.point(r.admin.locator('#field-label'), 1.2)
  await r.say('Type is the kind of prize: a percentage, an amount off, free delivery, free hand embroidery, or roll again.')
  await r.point(field(/^reward type|^type/i), 2)
  await r.say('For free embroidery, the number is how many placements are free. Empty makes every placement free.')
  await r.point(r.admin.locator('#field-rewardValue'), 1.8)
  await r.say('Colour is the segment’s background. The days are how long the code they win keeps working.')
  await r.point(r.admin.locator('#field-colour'), 1)
  await r.point(r.admin.locator('#field-expiryDays'), 1.2)
  await r.say('Untick Active to take a prize off the wheel without deleting it.')
  await r.point(r.admin.locator('#field-active'), 1.5)

  /* ---- 5% becomes 10% */
  await r.say('Now make 5% off into 10% off. Open it, and change the label and the number.')
  await r.goAdmin('/admin/collections/spinSegments')
  await r.click(row('5% off').locator('a').first())
  await r.admin.locator('#field-label').waitFor()
  await r.type(r.admin.locator('#field-label'), '10% off', { delay: 110 })
  await r.type(r.admin.locator('#field-rewardValue'), '10', { delay: 140 })
  await r.say('Click Save. New visitors see it straight away.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  // A first visit: the wheel has not been seen, so it opens a few seconds in.
  await r.overview()
  await r.page.frame({ name: 'site' })!.evaluate(() => window.localStorage.removeItem('plumpose:wheel'))
  await r.goSite('/')
  await r.say('The wheel opens by itself on a visitor’s first visit, a few seconds in.')
  const prize = r.site.getByText('10% off').first()
  await prize.waitFor({ timeout: 20_000 })
  await r.point(prize, 2, 1.5)
  await r.say('Codes won here appear in Discount codes. Each spin is listed in Wheel spins.')
  await r.point(r.site.getByRole('dialog').first(), 1.5, 1.2)
  await r.say('The wheel’s heading, and who sees it, are in Site settings, on the Reward wheel tab.')

  await r.recapCard(
    'Reward wheel',
    [
      'Side menu → Shop → Reward wheel',
      'Weight: how often a prize is won',
      'Label and number: what they win',
      'Untick Active to take a prize off',
    ],
    {
      speak: 'To recap: each row is a prize. Weight sets how often it is won, and Active puts it on the wheel or takes it off.',
    },
  )
  await r.finish()
})
