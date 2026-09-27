/**
 * Not a tutorial — checks the recorder end to end: a caption, typing in the
 * admin, saving, the change appearing on the website side, and a photo
 * uploaded through the admin's own upload control. Output in
 * ../recordings/00-smoke; reset the demo database afterwards.
 */
import { Recording } from '../stage'

const r = new Recording('00-smoke')
await r.start({ adminPath: '/admin/globals/siteSettings', sitePath: '/', warm: ['/admin/collections/media/create'] })

await r.titleCard('Recorder check', 'Split screen test', ['Admin on the left, your website on the right'])

await r.say('The announcement bar sits in Site settings, under Announcement.')
await r.click(r.admin.getByRole('button', { name: 'Announcement', exact: true }))
await r.type(r.admin.locator('#field-announcementText'), 'Recorder check — free gift wrapping this week')
await r.say('Click Save.')
await r.click(r.admin.getByRole('button', { name: /^save$/i }))
await r.saved()
await r.say('Now it is on your website.')
await r.showOnSite('/', (site) => site.getByText('Recorder check — free gift wrapping this week'))

await r.say('Photos are added through the admin. Choose the photo from your computer.')
await r.goAdmin('/admin/collections/media/create')
await r.upload(r.admin.getByRole('button', { name: /select a file/i }), '04-standing-window-full.jpg')
await r.say('Describe the photo for Google, then click Save.')
await r.type(r.admin.locator('#field-alt'), 'Silk pyjamas by the window')
await r.click(r.admin.getByRole('button', { name: /^save$/i }))
await r.saved()

await r.recapCard('Recorder works', ['Captions', 'Typing and saving', 'Website side updates', 'Photo upload'])
await r.finish()
