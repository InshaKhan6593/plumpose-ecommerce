/**
 * Tutorial 09 — Enquiries and subscribers: reading the Contact page's
 * messages (opening one marks it read; Replied and Archived by hand), and the
 * mailing list with its spreadsheet download and the Unsubscribed box.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`); two
 * enquiries and three subscribers are made off camera, as the site's forms
 * leave them. Narrated: `npx tsx scripts/record/narrate.ts
 * 09-enquiries-and-subscribers` before the take.
 */
import type { APIRequestContext } from '@playwright/test'

import { BASE, Recording } from '../stage'

const customersWrite = async (api: APIRequestContext) => {
  const forms = await (await api.get(`${BASE}/api/forms?where[title][equals]=Contact&limit=1`)).json()
  const form = forms.docs[0].id
  for (const [name, email, subject, message] of [
    ['Layla', 'layla@example.com', 'Press', 'I write for a Doha lifestyle magazine and would love to feature the Resort collection.'],
    [
      'Aisha K.',
      'aisha@example.com',
      'Sizing & fit',
      'I am usually a UK 10 and between S and M. Which would you suggest for the pyjama set? I like it a little loose.',
    ],
  ]) {
    const res = await api.post(`${BASE}/api/form-submissions`, {
      data: {
        form,
        submissionData: [
          { field: 'name', value: name },
          { field: 'email', value: email },
          { field: 'subject', value: subject },
          { field: 'orderNumber', value: '' },
          { field: 'message', value: message },
        ],
      },
    })
    if (!res.ok()) throw new Error(`enquiry: ${res.status()} ${await res.text()}`)
  }
  for (const [email, source] of [
    ['hessa@example.com', 'checkout'],
    ['maryam@example.com', 'spinWheel'],
    ['sara@example.com', 'footer'],
  ]) {
    const res = await api.post(`${BASE}/api/subscribers`, { data: { email, source } })
    if (!res.ok()) throw new Error(`subscriber: ${res.status()} ${await res.text()}`)
  }
}

const r = new Recording('09-enquiries-and-subscribers')
await r.start({
  adminPath: '/admin/collections/form-submissions',
  setup: customersWrite,
  sitePath: '/contact',
  warm: ['/admin/collections/subscribers'],
})

/** A labelled field as a whole (label, box and description), for pointing at. */
const field = (label: RegExp) =>
  r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: label }) }).first()

const openMenu = async () => {
  // The admin may already have its menu open (a closed menu's links still count as visible).
  if (!(await r.admin.locator('.template-default--nav-open').count())) {
    await r.click(r.admin.getByRole('button', { name: /open menu/i }))
  }
}

await r.run(async () => {
  await r.titleCard('Content', 'Enquiries and subscribers', ['Your Contact page messages, and your mailing list'], {
    speak: 'How to read the messages from your Contact page, and find everyone on your mailing list.',
  })

  /* ---- Enquiries */
  await r.say('This is your Contact page. Every message sent from it arrives in Enquiries, and by email to you.')
  await r.point(r.site.locator('form').first(), 2, 1.3)
  await r.say('Enquiries is in the side menu, under Content. The list shows who wrote, what about, and the start of the message.')
  await r.point(r.admin.locator('.table').first(), 2.5)
  await r.say('Status says New until you open it.')
  await r.point(r.admin.locator('.table').first().getByText('New').first(), 1.2)

  await r.say('Open a message to read all of it.')
  await r.click(r.admin.locator('.table tbody tr').filter({ hasText: 'Aisha' }).locator('a').first())
  await r.admin.locator('#field-from').waitFor()
  await r.say('Opening it marks it Read, on the right.')
  await r.point(field(/^status/i), 1.5)
  await r.say('From, About and Message are what they wrote. The full form is below.')
  await r.point(r.admin.locator('#field-from'), 1)
  await r.point(r.admin.locator('#field-preview'), 1.5)
  await r.say('To answer, write to them from your own email, at the address shown. There is no reply button here.')
  await r.point(r.admin.locator('#field-from'), 1.5)
  await r.say('Then set Status to Replied, and Save. Archived puts it away without deleting it.')
  await r.click(field(/^status/i).locator('.rs__control'))
  await r.point(r.admin.locator('.rs__menu'), 1.5)
  await r.click(r.admin.locator('.rs__option').filter({ hasText: /^Replied$/ }))
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  /* ---- Subscribers */
  await r.say('Subscribers is everyone who joined your list: from the footer, the reward wheel, or checkout.')
  await openMenu()
  await r.click(r.admin.getByRole('link', { name: 'Subscribers', exact: true }).first())
  await r.admin.locator('h1').filter({ hasText: 'Subscribers' }).first().waitFor()
  await r.say('Source says where each person joined.')
  await r.point(r.admin.locator('.table').first(), 2)
  await r.say('Download as a spreadsheet gives you every address, for your email service.')
  await r.point(r.admin.getByRole('link', { name: /download as a spreadsheet/i }).first(), 1.5)
  await r.say('If someone asks to leave, open them and tick Unsubscribed, then Save. Create new adds someone by hand.')
  await r.click(r.admin.getByRole('link', { name: 'sara@example.com' }).first())
  await r.admin.locator('#field-unsubscribed').waitFor()
  await r.point(r.admin.locator('#field-unsubscribed'), 1.5)

  await r.recapCard(
    'Enquiries and subscribers',
    [
      'Side menu → Content → Enquiries',
      'Opening a message marks it Read',
      'Reply from your own email, then set Replied',
      'Subscribers: download as a spreadsheet',
    ],
    {
      speak: 'To recap: read your messages in Enquiries, reply from your own email, and download your mailing list from Subscribers.',
    },
  )
  await r.finish()
})
