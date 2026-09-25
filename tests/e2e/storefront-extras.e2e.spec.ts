import type { APIRequestContext, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import sharp from 'sharp'

import { BASE } from '../helpers/base'

/**
 * The group of features added on 25 Sep 2026 (BUILD-LOG §29), end to end, the
 * way she and her customers use them: payments she can follow up, spreadsheet
 * downloads, reviews, Spotted submissions, the enquiries inbox, Page text,
 * sale prices, size × colour, exchange rates, sitemap and robots.
 *
 * Run against a production build (`pnpm build && pnpm start`,
 * E2E_BASE_URL=http://localhost:3000) — the only place a prerendered page
 * proves an edit reaches it. Needs the demo catalogue (`pnpm demo:seed`).
 * Everything made here is removed, and everything changed is put back.
 */

const DEV_USER = { email: 'dev@plumpose.local', password: 'devpassword' }
const TAG = `e2eonly-${Date.now()}`

let token = ''
const admin = () => ({ Authorization: `JWT ${token}` })

const api = async (
  request: APIRequestContext,
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST',
  path: string,
  data?: unknown,
) => {
  const res = await request.fetch(`${BASE}/api${path}`, { data, headers: admin(), method })
  const body = await res.json().catch(() => ({}))
  expect(
    res.ok(),
    `${method} ${path} → ${res.status()} ${JSON.stringify(body).slice(0, 300)}`,
  ).toBe(true)
  return body
}

const signInToAdmin = async (page: Page) => {
  await page.goto(`${BASE}/admin/login`)
  await page.fill('input[name="email"]', DEV_USER.email)
  await page.fill('input[name="password"]', DEV_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin(?!\/login)/)
}

// Serial, and generous: a freshly started server is slow on its first pages, and a test
// that runs out of time closes its connection before it can clean up after itself.
test.describe.configure({ mode: 'serial', timeout: 120_000 })

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${BASE}/api/users/login`, { data: DEV_USER })
  expect(login.ok(), `login failed: ${login.status()}`).toBe(true)
  token = (await login.json()).token
})

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('plumpose:wheel', 'done'))
})

/* ---------------------------------------------------------------- payments */

test('payments: an unpaid checkout is listed with what happened, and flagged on the dashboard', async ({
  page,
  request,
}) => {
  const cart = await api(request, 'POST', '/carts', {
    currency: 'QAR',
    customerEmail: `${TAG}@plumpose.local`,
    items: [],
  })
  const tx = await api(request, 'POST', '/transactions', {
    amount: 139900,
    cart: cart.doc.id,
    currency: 'QAR',
    customerEmail: `${TAG}@plumpose.local`,
    items: [],
    paymentMethod: 'skipcash',
    status: 'expired',
  })
  try {
    const read = await api(request, 'GET', `/transactions/${tx.doc.id}`)
    expect(read.outcome).toBe('Not paid — left the payment page')

    await signInToAdmin(page)
    await page.goto(`${BASE}/admin/collections/transactions`)
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible()
    await expect(page.locator('table')).toContainText('Not paid — left the payment page')
    await page.goto(`${BASE}/admin`)
    await expect(page.locator('.plumpose-dashboard__alerts')).toContainText(
      /checkouts? in the last week (was|were) not paid/,
    )
  } finally {
    await request.delete(`${BASE}/api/transactions/${tx.doc.id}`, { headers: admin() })
    await request.delete(`${BASE}/api/carts/${cart.doc.id}`, { headers: admin() })
  }
})

/* ----------------------------------------------------------------- exports */

test('exports: orders and subscribers download as a spreadsheet, admin only', async ({
  request,
}) => {
  const guest = await request.get(`${BASE}/api/exports/orders`)
  expect(guest.status()).toBe(403)

  const sub = await request.post(`${BASE}/api/subscribers`, {
    data: { email: `${TAG}@plumpose.local`, source: 'footer' },
  })
  expect(sub.ok()).toBe(true)
  const subId = (await sub.json()).doc.id
  try {
    const res = await request.get(
      `${BASE}/api/exports/subscribers?where[email][equals]=${encodeURIComponent(`${TAG}@plumpose.local`)}`,
      { headers: admin() },
    )
    expect(res.headers()['content-type']).toContain('text/csv')
    expect(res.headers()['content-disposition']).toMatch(
      /attachment; filename="plumpose-subscribers-\d{4}-\d{2}-\d{2}\.csv"/,
    )
    const text = await res.text()
    expect(text.charCodeAt(0)).toBe(0xfeff)
    const [header, row, ...rest] = text.slice(1).trim().split('\r\n')
    expect(header).toBe('Email,Joined (Doha),Signed up from,Unsubscribed')
    expect(row).toMatch(
      new RegExp(`^${TAG}@plumpose.local,\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2},Footer signup,No$`),
    )
    expect(rest).toHaveLength(0) // the filter was honoured

    const orders = await request.get(`${BASE}/api/exports/orders`, { headers: admin() })
    expect((await orders.text()).slice(1).split('\r\n')[0]).toMatch(
      /^Order,Date \(Doha\),Payment,Fulfilment,/,
    )
  } finally {
    await request.delete(`${BASE}/api/subscribers/${subId}`, { headers: admin() })
  }
})

/* ----------------------------------------------------------------- reviews */

test('reviews: a customer writes one, it waits, she approves and replies, it shows with its stars', async ({
  page,
  request,
}) => {
  const product = (
    await api(request, 'GET', '/products?where[slug][equals]=demo-noir-slip&depth=0')
  ).docs[0]
  await page.goto(`${BASE}/products/demo-noir-slip`)
  await page.locator('main').getByRole('button', { name: 'Write a review' }).click()
  await page.getByRole('radio', { name: '4 stars' }).click()
  await page.fill('#review-name', 'Noor')
  await page.fill('#review-email', `${TAG}-review@plumpose.local`)
  await page.fill(
    '#review-body',
    `The slip hangs beautifully and the silk is soft against the skin. (${TAG})`,
  )
  await page.getByRole('button', { name: 'Send review' }).click()
  await expect(page.getByText('your review has reached us')).toBeVisible()

  const mine = (
    await api(request, 'GET', `/reviews?where[email][equals]=${TAG}-review@plumpose.local&depth=0`)
  ).docs[0]
  try {
    expect(mine).toMatchObject({
      featured: false,
      product: product.id,
      rating: 4,
      status: 'pending',
    })
    // Pending: not on the page. Looked for inside <main>: while a page streams in,
    // Next.js keeps a hidden copy outside it (about two seconds on the dev server).
    await page.reload()
    await expect(page.locator('main section#reviews')).toHaveCount(1)
    await expect(page.locator('main section#reviews')).not.toContainText(TAG)

    await api(request, 'PATCH', `/reviews/${mine.id}`, {
      featured: true,
      reply: 'Thank you, Noor.',
      status: 'approved',
    })
    await page.reload()
    await expect(page.locator('main section#reviews')).toHaveCount(1)
    const reviews = page.locator('main section#reviews')
    await expect(reviews).toContainText(TAG)
    await expect(reviews).toContainText('plumpose replied')
    await expect(reviews).toContainText('Thank you, Noor.')
    await expect(
      page.locator('main').getByRole('img', { name: '4 out of 5 stars' }).first(),
    ).toBeVisible()
    await expect(page.locator('main a[href="#reviews"]')).toContainText('4.0 · 1 review')
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(JSON.parse(jsonLd!).aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4,
      reviewCount: 1,
    })

    // Featured: on the (prerendered) homepage too — far down, so scrolled to, as a visitor would.
    // Scrolled by the page itself: Playwright's scrollIntoViewIfNeeded waits for the quote to be
    // visible first, and the quote only becomes visible once it has been scrolled to.
    // The storefront promises her change within about two seconds of saving (see
    // hooks/revalidateStorefront.ts): look again for up to ten.
    await expect
      .poll(async () => (await (await request.get(`${BASE}/`)).text()).includes(TAG), {
        timeout: 10_000,
      })
      .toBe(true)
    await page.goto(`${BASE}/`)
    const quote = page.locator('main').getByText(TAG)
    await expect(quote).toBeAttached()
    await quote.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await expect(quote).toBeVisible()
  } finally {
    await request.delete(`${BASE}/api/reviews/${mine.id}`, { headers: admin() })
    await request.delete(`${BASE}/api/reviews?where[id][equals]=${mine.id}&trash=true`, {
      headers: admin(),
    })
  }
})

/* ----------------------------------------------------------------- spotted */

const photoFile = async (name: string) => ({
  buffer: await sharp({ create: { background: '#1f2b4d', channels: 3, height: 1250, width: 1000 } })
    .jpeg()
    .toBuffer(),
  mimeType: 'image/jpeg',
  name,
})

test('spotted: a customer sends a photograph; approved it shows, rejected it is deleted', async ({
  page,
  request,
}) => {
  const send = async (handle: string) => {
    await page.goto(`${BASE}/spotted`)
    await page.setInputFiles('input[type="file"][name="file"]', await photoFile(`${handle}.jpg`))
    await page.fill('#spotted-handle', handle)
    await page.fill('#spotted-caption', 'Morning in Doha')
    await page.check('input[name="consent"]')
    await page.getByRole('button', { name: 'Send photograph' }).click()
    await expect(page.getByText('your photograph has reached us')).toBeVisible()
    return (
      await api(
        request,
        'GET',
        `/spotted?where[instagramHandle][equals]=${encodeURIComponent(`@${handle}`)}&depth=0`,
      )
    ).docs[0]
  }

  const kept = await send(`${TAG.replace(/-/g, '_')}_a`)
  const dropped = await send(`${TAG.replace(/-/g, '_')}_b`)
  try {
    expect(kept).toMatchObject({ consent: true, status: 'pending', submitted: true })

    await api(request, 'PATCH', `/spotted/${kept.id}`, { status: 'approved' })
    await page.goto(`${BASE}/spotted`)
    await expect(page.getByText(kept.instagramHandle)).toBeAttached()

    await api(request, 'PATCH', `/spotted/${dropped.id}`, { status: 'rejected' })
    const photo = await request.get(`${BASE}/api/media/${dropped.image}`, { headers: admin() })
    expect(photo.status()).toBe(404)
  } finally {
    for (const doc of [kept, dropped]) {
      await request.delete(`${BASE}/api/spotted/${doc.id}`, { headers: admin() })
      await request.delete(`${BASE}/api/media/${doc.image}`, { headers: admin() })
    }
  }
})

/* --------------------------------------------------------------- enquiries */

test('enquiries: a new message is New in the inbox, shows who and what, and opening it marks it read', async ({
  page,
  request,
}) => {
  const form = (await api(request, 'GET', '/forms?where[title][equals]=Contact&depth=0')).docs[0]
  const sent = await request.post(`${BASE}/api/form-submissions`, {
    data: {
      form: form.id,
      status: 'archived', // a stranger cannot file it away
      submissionData: [
        { field: 'name', value: 'Mariam' },
        { field: 'email', value: `${TAG}@plumpose.local` },
        { field: 'subject', value: 'Sizing & fit' },
        { field: 'orderNumber', value: '42' },
        {
          field: 'message',
          value: 'Which size would suit someone 165 cm tall who likes a relaxed fit?',
        },
      ],
    },
  })
  expect(sent.ok()).toBe(true)
  const id = (await sent.json()).doc.id
  try {
    const doc = await api(request, 'GET', `/form-submissions/${id}`)
    expect(doc).toMatchObject({
      about: 'Sizing & fit · order #42',
      from: `Mariam <${TAG}@plumpose.local>`,
      status: 'new',
    })
    expect(doc.preview).toMatch(/^Which size would suit/)

    await signInToAdmin(page)
    await page.goto(`${BASE}/admin/collections/form-submissions`)
    await expect(page.locator('table')).toContainText(`Mariam <${TAG}@plumpose.local>`)
    await page.goto(`${BASE}/admin/collections/form-submissions/${id}`)
    await expect
      .poll(async () => (await api(request, 'GET', `/form-submissions/${id}`)).status, {
        timeout: 15_000,
      })
      .toBe('read')
  } finally {
    await request.delete(`${BASE}/api/form-submissions/${id}`, { headers: admin() })
  }
})

/* --------------------------------------------------------------- page text */

test('page text: her words reach the prerendered homepage, and an emptied field falls back', async ({
  page,
  request,
}) => {
  const before = await api(request, 'GET', '/globals/pageText?depth=0')
  // A save reaches the prerendered homepage within about two seconds (hooks/revalidateStorefront.ts).
  const homepageShows = (text: string) =>
    expect
      .poll(async () => (await (await request.get(`${BASE}/`)).text()).includes(text), {
        timeout: 10_000,
      })
      .toBe(true)
  try {
    await api(request, 'POST', '/globals/pageText', {
      home: {
        hero: { cta: 'See the whole collection' },
        philosophy: { headline: 'Made for the *quiet hours* of Doha.' },
      },
    })
    await homepageShows('See the whole collection')
    await page.goto(`${BASE}/`)
    await expect(page.getByRole('link', { name: 'See the whole collection' })).toBeVisible()
    await expect(
      page.locator('em, i, .serif-italic').filter({ hasText: 'quiet hours' }).first(),
    ).toBeAttached()

    await api(request, 'POST', '/globals/pageText', { home: { hero: { cta: '   ' } } })
    await homepageShows(before.home.hero.cta)
    await page.goto(`${BASE}/`)
    await expect(page.getByRole('link', { name: before.home.hero.cta })).toBeVisible()
  } finally {
    const { createdAt: _c, globalType: _g, id: _i, updatedAt: _u, ...data } = before
    await api(request, 'POST', '/globals/pageText', data)
  }
})

/* -------------------------------------------------------------- sale price */

test('sale price: the was-price shows crossed out in the shop and on the piece', async ({
  page,
  request,
}) => {
  const product = (
    await api(request, 'GET', '/products?where[slug][equals]=demo-noir-slip&depth=0')
  ).docs[0]
  try {
    await api(request, 'PATCH', `/products/${product.id}`, { compareAtPriceInQAR: 95000 })
    await page.goto(`${BASE}/products/demo-noir-slip`)
    await expect(page.locator('main s').filter({ hasText: 'QAR 950.00' }).first()).toBeVisible()
    await page.goto(`${BASE}/shop?collection=demo-slips`)
    const was = page.locator('main a[href="/products/demo-noir-slip"] s') // inside <main>, not the streamed hidden copy
    await expect(was).toHaveCount(1)
    await expect(was).toContainText('QAR 950.00')
  } finally {
    await api(request, 'PATCH', `/products/${product.id}`, { compareAtPriceInQAR: null })
  }
})

/* ----------------------------------------------------------- size × colour */

test('size × colour: combinations not made, or sold out, cannot be chosen; the gallery follows the colour', async ({
  page,
}) => {
  await page.goto(`${BASE}/products/demo-two-colour-set`)
  // Inside <main>: the streamed page's hidden copy is outside it.
  const main = page.locator('main')
  const option = (name: string) => main.getByRole('button', { exact: true, name })

  await expect(main.getByRole('button', { name: 'Select a size and colour' })).toBeDisabled()

  await option('L').click()
  await expect(option('Blush')).toBeDisabled() // not made in L
  await expect(option('Blush')).toHaveAttribute('title', /not made in this combination/)

  await option('M').click()
  await expect(option('Blush')).toBeDisabled() // M in Blush is sold out
  await expect(option('Blush')).toHaveAttribute('title', /sold out/)

  await option('S').click()
  await option('Blush').click()
  await expect(main.getByRole('button', { name: 'Add to bag' })).toBeEnabled()
  const gallery = main.getByRole('region', { name: 'Photographs' }).locator('img')
  await expect(gallery).toHaveCount(2)
  await expect(gallery.first()).toHaveAttribute('src', /demo-pexels-(7162014|7162023)/)
})

/* --------------------------------------------------------- exchange rates */

test('exchange rates: an admin refreshes them; hand-set prices stay, and the check columns fill', async ({
  request,
}) => {
  const aed = (await api(request, 'GET', '/currencies?where[code][equals]=AED&depth=0')).docs[0]
  expect((await request.get(`${BASE}/api/currencies/refresh-rates`)).status()).toBe(403) // a GET needs the scheduler's secret
  expect((await request.post(`${BASE}/api/currencies/refresh-rates`)).status()).toBe(403) // and a POST an admin

  const result = await api(request, 'POST', '/currencies/refresh-rates')
  expect(result.updated).toBeGreaterThan(100)
  const after = (await api(request, 'GET', '/currencies?where[code][equals]=AED&depth=0')).docs[0]
  expect(after.priceOverride).toBe(aed.priceOverride)
  expect(after.rate).toBeGreaterThan(0.9)
  expect(after.atTodaysRate).toMatch(/^1,4\d\d$/)
  expect(after.difference).toMatch(/^[+−]?\d+\.\d%$/)
})

/* -------------------------------------------------------- sitemap, robots */

test('sitemap and robots: the pages to find, and the ones to keep out', async ({ request }) => {
  const sitemap = await (await request.get(`${BASE}/sitemap.xml`)).text()
  expect(sitemap).toContain('/products/al-shaheen-nights</loc>')
  expect(sitemap).toContain('/our-story</loc>')
  expect(sitemap).not.toContain('/checkout')
  const robots = await (await request.get(`${BASE}/robots.txt`)).text()
  expect(robots).toMatch(/Disallow: \/admin/)
  expect(robots).toMatch(/Disallow: \/checkout/)
  expect(robots).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/)
})
