/**
 * Tutorial 16 — Users: customers' accounts and the people who can open the
 * admin. What each role means (Staff is defined for a future assistant but
 * cannot open the admin yet — said plainly, never suggested), finding a
 * customer, Change password and Force unlock, and giving someone access. On
 * camera: an account for a helper, as Admin, and how to take it away again.
 *
 * Starts from the demo database (`sh scripts/record/reset-demo.sh reset`).
 * Off camera: a made-up customer, as if she had made an account on the
 * website. Narrated: `npx tsx scripts/record/narrate.ts 16-customers-and-staff`.
 */
import { BASE, Recording } from '../stage'

const CUSTOMER = { email: 'layla.hassan@example.com', name: 'Layla Hassan' }
const HELPER = { email: 'sara@plumpose.demo', name: 'Sara' }

const r = new Recording('16-customers-and-staff')
await r.start({
  adminPath: '/admin/collections/users',
  setup: async (api) => {
    const res = await api.post(`${BASE}/api/users`, {
      data: { ...CUSTOMER, password: `demo-${Date.now()}-customer`, roles: ['customer'] },
    })
    if (!res.ok()) throw new Error(`make the customer: ${res.status()} ${await res.text()}`)
  },
  // The homepage: the sign-up page would send the signed-in recorder to its own account.
  sitePath: '/',
  warm: ['/admin/collections/users/create'],
})

const row = (text: string) => r.admin.locator('.table tbody tr').filter({ hasText: text }).first()

await r.run(async () => {
  await r.titleCard('Users', 'Customers & staff', ['Customers’ accounts, and who can open your admin'], {
    speak: 'How to find a customer’s account, and how to let someone help you in your admin.',
  })

  /* ---- the list */
  await r.say('Users is in the side menu. It lists every account: your customers’, and yours.')
  await r.point(r.admin.locator('.table').first(), 2, 1.3)
  await r.say('Customers make their own account on your website, when they sign up. Checking out needs no account.')
  await r.point(r.site.getByRole('link', { name: 'Account', exact: true }).first(), 1.8, 1.5)
  await r.say('Roles shows what each account can do. Admin can open this admin and change everything. Customer is a website account only.')
  await r.point(r.admin.locator('thead th').filter({ hasText: /^roles$/i }), 2)
  await r.say('Search finds someone by name or email. Columns and Filters change only what this list shows you.')
  await r.point(r.admin.getByPlaceholder(/search/i).first(), 1)
  await r.point(r.admin.locator('#toggle-list-filters'), 1)

  /* ---- a customer, opened */
  await r.say('Open a customer to see their account.')
  await r.click(row(CUSTOMER.name).locator('a').first())
  await r.admin.locator('#field-email').waitFor()
  await r.say('Orders lists what they bought while signed in. Orders placed as a guest are only in Orders.')
  await r.point(r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: /^orders$/i }) }).first(), 2)
  await r.say('Force unlock: after five wrong passwords an account waits fifteen minutes. This opens it now.')
  await r.point(r.admin.locator('#force-unlock'), 1.8)
  await r.say('Change password sets a new one. Customers can reset their own from the sign-in page, so you rarely need it.')
  await r.point(r.admin.locator('#change-password'), 1.8)
  await r.say('The three dots hold Create new, and Delete, which removes the account for good.')
  await r.point(r.admin.locator('.doc-controls__popup').first(), 1.2)

  /* ---- someone to help */
  await r.say('To let someone help you, go back to Users and click Create new.')
  await r.goAdmin('/admin/collections/users')
  await r.click(r.admin.getByRole('link', { name: /create new/i }).first())
  await r.admin.locator('#field-email').waitFor()
  await r.say('Type their email, their name, and a password you will give them privately.')
  await r.type(r.admin.locator('#field-email'), HELPER.email, { delay: 70 })
  await r.type(r.admin.locator('#field-name'), HELPER.name, { delay: 110 })
  const password = `Plum-${Date.now()}`
  await r.type(r.admin.locator('#field-password'), password, { delay: 45 })
  await r.type(r.admin.locator('#field-confirm-password'), password, { delay: 45 })
  await r.say('Under Roles, remove Customer and choose Admin.')
  const roles = r.admin.locator('.field-type').filter({ has: r.admin.locator('label', { hasText: /^roles$/i }) }).first()
  // The × on the Customer tag (the tag itself is a button too, and opens the list).
  await r.click(roles.locator('.multi-value-label', { hasText: 'Customer' }).locator('xpath=..').locator('button.multi-value-remove'))
  await r.click(roles.locator('.rs__control').first())
  await r.click(r.admin.locator('.rs__option').filter({ hasText: /^Admin$/ }).first())
  await r.say('Admin can do everything you can, prices and orders included, so only give it to someone you trust.')
  await r.point(roles, 2)
  await r.say('Staff is kept for a future assistant with fewer rights. It cannot open the admin yet, so do not use it for now.')
  await r.say('Click Save. They sign in at your website’s address, slash admin, and can change their password there.')
  await r.click(r.admin.locator('#action-save'))
  await r.saved()

  /* ---- taking it away */
  await r.say('When they no longer need it, remove Admin from their roles and save, or delete the account.')
  await r.point(roles, 2)

  await r.recapCard(
    'Customers & staff',
    [
      'Side menu → Users',
      'Customers make their own accounts',
      'Admin can change everything',
      'Remove Admin to take access away',
    ],
    {
      speak: 'To recap: customers make their own accounts. To let someone help, give them Admin, and remove it when they no longer need it.',
    },
  )
  await r.finish()
})
