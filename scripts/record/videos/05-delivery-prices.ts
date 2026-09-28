/**
 * Tutorial 05 — delivery prices: change what delivery costs to a place in
 * Qatar and to a zone abroad, see the Shipping page follow, then turn on free
 * delivery above a spend. Every control on those screens is explained,
 * including Active, the order handles, Countries and the surcharge.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`),
 * which carries the seeded delivery tables. Narrated: `npx tsx
 * scripts/record/narrate.ts 05-delivery-prices` before the take.
 */
import { Recording } from '../stage'

const r = new Recording('05-delivery-prices')
await r.start({
  adminPath: '/admin/collections/shippingCities',
  sitePath: '/shipping-returns',
  warm: ['/admin/collections/shippingZones', '/admin/collections/countries', '/admin/globals/siteSettings'],
})

/** Opens a screen from the admin's side menu, as she would. */
const openFromMenu = async (name: string) => {
  // The admin keeps the menu open once it has been opened, so only the first visit opens it.
  // (A closed menu's links sit just off screen and still count as visible — ask the layout.)
  if (!(await r.admin.locator('.template-default--nav-open').count())) {
    await r.click(r.admin.getByRole('button', { name: /open menu/i }))
  }
  await r.click(r.admin.getByRole('link', { name, exact: true }).first())
  await r.admin.locator('h1').filter({ hasText: name }).first().waitFor()
}

await r.run(async () => {
  await r.titleCard('Shop settings', 'Delivery prices', ['Qatar, the rest of the world, and free delivery'], {
    speak: 'How to change what delivery costs, and how to offer free delivery.',
  })

  /* ---- Qatar */
  await r.say('Qatar delivery lists what delivery costs to each place in Qatar.')
  await r.point(r.admin.locator('table tbody'), 2, 1.3)
  await r.say('Customers choose their place at checkout, in this order. Drag a row by its handle to move it.')
  await r.point(r.admin.locator('tbody tr').first().locator('td').first(), 1.5)
  await r.say('The arrows above the handles put the list back in your order after sorting by a column.')
  await r.point(r.admin.locator('thead th').first(), 1.2)
  await r.say('A tick under Active means you deliver there.')
  await r.point(r.admin.locator('thead th').filter({ hasText: /active/i }), 1.2)
  await r.say('Create new adds a place: its name, and its fee.')
  await r.point(r.admin.getByRole('link', { name: /create new/i }).first(), 1.2)

  await r.say('To change a fee, click the place.')
  await r.click(r.admin.getByRole('link', { name: 'Doha', exact: true }))
  await r.admin.locator('#field-feeQar').waitFor()

  await r.say('Type the fee in riyals: twenty-five means QAR 25.')
  await r.type(r.admin.locator('#field-feeQar'), '25', { delay: 120 })
  await r.say('Untick Active to stop delivering there. It leaves checkout and the Shipping page.')
  await r.point(r.admin.locator('#field-active'), 1.5)
  await r.say('The three dots hold Create new, and Delete, which removes this place for good.')
  await r.point(r.admin.locator('.doc-controls__popup').first(), 1.2)

  await r.say('Click Save. The new fee is used at checkout straight away.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.say('Your Shipping page shows the new price for Doha.')
  await r.showOnSite('/shipping-returns', (site) => site.locator('main').getByText('QAR 25.00'))

  /* ---- the rest of the world */
  await r.say('Outside Qatar, open International delivery from the menu.')
  await openFromMenu('International delivery')
  await r.say('Each zone has one fee for all its countries. The Gulf countries each have their own.')
  await r.point(r.admin.locator('table tbody'), 2, 1.3)
  await r.say('Zones cannot be added or deleted here, because every country is linked to one. Ask your developer for a new zone.')

  await r.say('Change a zone’s fee the same way. Open it, type the fee in riyals, and Save.')
  await r.click(r.admin.getByRole('link', { name: 'United Kingdom', exact: true }))
  await r.type(r.admin.locator('#field-feeQar'), '220', { delay: 120 })
  await r.say('Untick Active only to stop delivering to every country in the zone. Customers there are asked to email you.')
  await r.point(r.admin.locator('#field-active'), 1.5)
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.showOnSite('/shipping-returns', (site) => site.locator('main').getByText('QAR 220.00'))

  /* ---- countries, for reference */
  await r.say('Countries shows which zone each country is priced from. It is there to look things up.')
  await openFromMenu('Countries')
  await r.point(r.admin.locator('thead th').filter({ hasText: /delivery zone/i }), 1.5)
  await r.say('The few countries with a blocked reason cannot be ordered to. Your developer changes these.')
  await r.point(r.admin.locator('tbody tr').first().locator('td').last(), 1.5)

  /* ---- free delivery and the surcharge */
  await r.say('Free delivery is in Site settings, on the Shipping tab.')
  await openFromMenu('Site settings')
  await r.click(r.admin.getByRole('button', { name: 'Shipping', exact: true }))
  await r.say('Tick Offer free delivery, then type the amount, in riyals.')
  await r.click(r.admin.locator('#field-freeShippingEnabled'))
  await r.type(r.admin.locator('#field-freeShippingThresholdQar'), '2000', { delay: 120 })
  await r.say('It counts the pieces and embroidery in the bag, and it applies to every country.')
  await r.point(r.admin.locator('#field-freeShippingThresholdQar'), 1.5)
  await r.say('International surcharge adds a percentage to every fee outside Qatar, when carriers raise their prices. Otherwise leave it at 0.')
  await r.point(r.admin.locator('#field-intlSurchargePct'), 1.5)

  await r.say('Click Save.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()
  await r.say('The Shipping page, and every piece’s page, now tell customers about free delivery.')
  await r.showOnSite('/shipping-returns', (site) => site.locator('main').getByText(/free delivery on orders over/i))

  await r.recapCard(
    'Delivery prices',
    [
      'Qatar delivery → a place → fee in riyals → Save',
      'International delivery → a zone → fee in riyals → Save',
      'Active: untick to stop delivering there',
      'Site settings → Shipping → free delivery above a spend',
    ],
    { speak: 'To recap: fees are in riyals, they are live once you save, and free delivery is in Site settings.' },
  )
  await r.finish()
})
