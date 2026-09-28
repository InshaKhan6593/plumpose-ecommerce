/**
 * Tutorial 07 — Site settings: the one screen that holds the shop's contact
 * details, the switch that pauses orders, the announcement line, delivery, stock emails, currencies, the
 * reward wheel's words and the embroidery rules. Two changes on camera (her
 * WhatsApp number, seen on the Contact page; a new announcement, seen in the
 * website's header); every other setting on every tab is pointed at and
 * explained, including the ones to leave alone.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`); the
 * piece is made off camera so the embroidery fee can be shown on its page.
 * Narrated: `npx tsx scripts/record/narrate.ts 07-site-settings` before the take.
 */
import { addPiece } from '../demo-data'
import { Recording } from '../stage'

const PIECE = '/products/al-shaheen-nights-silk-pyjama-set'

const r = new Recording('07-site-settings')
await r.start({
  adminPath: '/admin',
  setup: async (api) => {
    await addPiece(api)
  },
  sitePath: '/contact',
  warm: ['/admin/globals/siteSettings', '/', PIECE, '/our-story'],
})

/** A labelled field as a whole (label, box and description), for pointing at. */
const field = (label: RegExp) =>
  r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: label }) }).first()

const tab = (name: string) => r.admin.getByRole('button', { name, exact: true })

await r.run(async () => {
  await r.titleCard('Everyday', 'Site settings', ['Contact details, the announcement, and the shop’s rules'], {
    speak: 'How to change your contact details, the announcement, and the other settings for the whole site.',
  })

  await r.say('Site settings is in the side menu, under Everyday.')
  // The admin may already have its menu open (a closed menu's links still count as visible).
  if (!(await r.admin.locator('.template-default--nav-open').count())) {
    await r.click(r.admin.getByRole('button', { name: /open menu/i }))
  }
  await r.click(r.admin.getByRole('link', { name: 'Site settings', exact: true }).first())
  await r.admin.locator('h1').filter({ hasText: 'Site settings' }).first().waitFor()
  await r.say('It has nine tabs. One Save button, at the top, saves all of them together.')
  await r.point(r.admin.locator('.tabs-field__tabs').first(), 2)
  await r.point(r.admin.locator('#action-save'), 1)

  /* ---- Orders */
  await r.say('Orders comes first. Take orders is ticked while your shop is open.')
  await r.point(r.admin.locator('#field-ordersOpen'), 1.5)
  await r.say('Untick it to pause orders. Customers can still browse, but checkout says orders open soon and nobody can pay.')
  await r.point(r.admin.locator('#field-ordersOpen'), 1.5)

  /* ---- Contact */
  await r.click(tab('Contact'))
  await r.say('Contact email is shown on your website and in every email. Customers’ replies arrive there.')
  await r.point(field(/^contact email$/i), 1.5)
  await r.say('New orders and Contact page messages are emailed to the next address. Empty means the contact email.')
  await r.point(field(/new-order alerts go to/i), 1.5)
  await r.say('Type your WhatsApp number with the country code. Empty hides the WhatsApp link.')
  await r.type(r.admin.locator('#field-whatsappNumber'), '+974 5144 5633', { delay: 90 })
  await r.say('Instagram name is shown beside the Instagram links. Instagram link is where they go.')
  await r.point(r.admin.locator('#field-instagramHandle'), 1)
  await r.point(r.admin.locator('#field-instagramUrl'), 1)
  await r.say('Click Save. It is on your website straight away.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.say('Your Contact page now offers WhatsApp.')
  await r.showOnSite('/contact', (site) => site.locator('main').getByText('+974 5144 5633'))

  /* ---- Announcement */
  await r.say('The Announcement tab is the dark line at the top of every page.')
  await r.click(tab('Announcement'))
  await r.point(r.site.locator('header').first(), 1.5, 1.3)
  await r.say('Type your words. Separate phrases with a bar. On a phone, they take turns, one at a time.')
  await r.type(r.admin.locator('#field-announcementText'), 'Now shipping worldwide | Hand embroidery on every piece', {
    delay: 60,
  })
  await r.say('Small or capital letters: it always shows in capitals. Untick Show the announcement to hide the line.')
  await r.point(r.admin.locator('#field-announcementEnabled'), 1.5)
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.showOnSite('/', (site) => site.getByText(/hand embroidery on every piece/i).filter({ visible: true }))

  /* ---- Shipping */
  await r.say('Shipping holds free delivery and the international surcharge. The Delivery prices video shows them.')
  await r.click(tab('Shipping'))
  await r.point(r.admin.locator('#field-freeShippingEnabled'), 1.2)

  /* ---- Returns */
  await r.say('Returns: how many days customers have to ask for a return. Your Shipping and returns page uses this number.')
  await r.click(tab('Returns'))
  await r.point(r.admin.locator('#field-returnWindowDays'), 1.5)

  /* ---- Stock alerts */
  await r.say('Stock alerts: the emails you get when a sale changes your stock.')
  await r.click(tab('Stock alerts'))
  await r.say('Untick Email me about stock to stop them all. The dashboard still shows low stock.')
  await r.point(r.admin.locator('#field-stockAlertsEnabled'), 1.2)
  await r.say('Stock emails go to: empty uses the new-order address.')
  await r.point(r.admin.locator('#field-stockAlertEmail'), 1.2)
  await r.say('Running low at: a size with this many left, or fewer, counts as running low.')
  await r.point(r.admin.locator('#field-lowStockThreshold'), 1.2)
  await r.say('Then choose which emails you want: running low, sold out, or an order beyond your stock.')
  await r.point(r.admin.locator('#field-alertLowStock').locator('xpath=ancestor::div[contains(@class,"row")][1]'), 2)

  /* ---- Currencies */
  await r.say('Currencies. Visitors can see prices in their own currency. Every order is still charged in riyals.')
  await r.click(tab('Currencies'))
  await r.point(r.admin.locator('#field-currencyDisplayEnabled'), 1.2)
  await r.say('The second tick starts a new visitor in the currency of where they are. They can always change it.')
  await r.point(r.admin.locator('#field-currencyDetectLocation'), 1.2)
  await r.say('Leave the last box as it is. It links your hand-set prices to the price of your set.')
  await r.point(r.admin.locator('#field-currencyAnchorQar'), 1.8)

  /* ---- Reward wheel */
  await r.say('Reward wheel. Untick the first box to take the wheel off the site. Codes already won keep working.')
  await r.click(tab('Reward wheel'))
  await r.point(r.admin.locator('#field-spinWheelEnabled'), 1.2)
  await r.say('The heading and the words under it are what visitors read above the wheel.')
  await r.point(r.admin.locator('#field-spinWheelHeading'), 1)
  await r.point(r.admin.locator('#field-spinWheelBody'), 1)
  await r.say('Extra spins sets how often Roll again can be won by one person.')
  await r.point(r.admin.locator('#field-spinWheelMaxRerolls'), 1.2)
  await r.say('Tick the next box to keep the wheel for people who have not ordered yet.')
  await r.point(r.admin.locator('#field-spinWheelNewCustomersOnly'), 1.2)
  await r.say('Spins per device per day stops one person collecting codes. The prizes are in Reward wheel, in the menu.')
  await r.point(r.admin.locator('#field-spinWheelDailyLimit'), 1.5)

  /* ---- Personalisation */
  await r.say('Personalisation holds the rules for hand embroidery, on every piece.')
  await r.click(tab('Personalisation'))
  await r.say('The fee, in riyals, for each placement.')
  await r.point(r.admin.locator('#field-personalisationFeeQar'), 1.2)
  await r.say('It is the fee your pieces show.')
  await r.goSite(PIECE)
  await r.point(r.site.getByText(/add initials or a symbol/i).first(), 2, 1.5)
  await r.say('The longest lettering, and the most placements on one piece.')
  await r.point(r.admin.locator('#field-personalisationMaxChars'), 1)
  await r.point(r.admin.locator('#field-personalisationMaxPlacements'), 1)
  await r.say('Lead time is how long embroidery takes. Customers see it when they choose, and in their order.')
  await r.point(r.admin.locator('#field-personalisationLeadTime'), 1.5)
  await r.say('Leave the last box unticked while embroidered pieces cannot be returned. Your pages say so.')
  await r.point(r.admin.locator('#field-personalisationReturnable'), 1.5)
  await r.say('Change any of these, click Save, and the website follows at once.')
  await r.point(r.admin.locator('#action-save'), 1.2)

  await r.recapCard(
    'Site settings',
    [
      'Side menu → Everyday → Site settings',
      'Nine tabs, one Save for all of them',
      'Contact: emails, WhatsApp, Instagram',
      'Announcement: phrases separated by |',
    ],
    {
      speak: 'To recap: Site settings holds your contact details, the announcement and the shop’s rules. One Save, and the website follows.',
    },
  )
  await r.finish()
})
