import type { APIRequestContext, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { BASE } from '../helpers/base'

/**
 * The storefront as a customer uses it: finding the piece, choosing a size,
 * the bag, reaching checkout, an account, Track order, and every page the
 * header and footer link to.
 *
 * Replaces the upstream template's storefront suite, which asserted a page
 * titled "Payload Ecommerce Template" and a "Hoodie". Paying is covered by
 * checkout.e2e and webhook.e2e; the admin-driven features by
 * storefront-extras.e2e.
 *
 * Works against dev or a production build. Everything made here is removed.
 */

const DEV_USER = { email: 'dev@plumpose.local', password: 'devpassword' }
const PIECE = '/products/al-shaheen-nights'

let token = ''
const admin = () => ({ Authorization: `JWT ${token}` })

test.describe.configure({ mode: 'serial', timeout: 90_000 })

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${BASE}/api/users/login`, { data: DEV_USER })
  expect(login.ok(), `login failed: ${login.status()}`).toBe(true)
  token = (await login.json()).token
})

test.beforeEach(async ({ context }) => {
  // The reward wheel opens a few seconds into a first visit; these tests are not about it.
  await context.addInitScript(() => localStorage.setItem('plumpose:wheel', 'done'))
})

/** Collects uncaught errors in the page, so a page that renders but throws still fails. */
const watchErrors = (page: Page) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

/** Under a loading.tsx, Next keeps a hidden copy of the page outside <main> while it streams in. */
const main = (page: Page) => page.locator('main')

const deleteUser = async (request: APIRequestContext, email: string) => {
  const found = await (
    await request.get(`${BASE}/api/users?where[email][equals]=${encodeURIComponent(email)}`, {
      headers: admin(),
    })
  ).json()
  for (const user of found.docs ?? []) {
    await request.delete(`${BASE}/api/users/${user.id}`, { headers: admin() })
  }
}

/* ------------------------------------------------------------------ pages */

test('every page the header and footer link to opens, with a heading and no errors', async ({
  page,
}) => {
  const errors = watchErrors(page)
  for (const path of [
    '/',
    '/shop',
    PIECE,
    '/our-story',
    '/faq',
    '/shipping-returns',
    '/made-for-you',
    '/press',
    '/spotted',
    '/contact',
    '/find-order',
    '/login',
    '/create-account',
  ]) {
    const response = await page.goto(`${BASE}${path}`)
    expect(response?.status(), path).toBe(200)
    await expect(main(page).locator('h1').first(), `${path} has a heading`).toBeAttached()
  }
  expect(errors, 'uncaught errors in the page').toEqual([])
})

test('an unknown address is a 404 in the house style', async ({ page }) => {
  const response = await page.goto(`${BASE}/no-such-page-${Date.now()}`)
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Nothing here, yet.' })).toBeVisible()
})

/* --------------------------------------------------------- shop and piece */

test('the shop lists her piece and opens it', async ({ page }) => {
  await page.goto(`${BASE}/shop`)
  const card = main(page).locator(`a[href="${PIECE}"]`).first()
  await card.scrollIntoViewIfNeeded()
  await card.click()
  await page.waitForURL(`**${PIECE}`)
  await expect(main(page).getByRole('heading', { level: 1 })).toContainText('Al Shaheen Nights')
})

test('a size must be chosen; the bag opens with it, priced by the store, and can be changed', async ({
  page,
}) => {
  await page.goto(`${BASE}${PIECE}`)

  const add = main(page).getByRole('button', { name: /^(Select a size|Add to bag)$/ })
  await expect(add).toHaveText('Select a size')
  await expect(add).toBeDisabled()

  await main(page).getByRole('button', { exact: true, name: 'M' }).click()
  await page.waitForURL(/[?&]variant=/)
  await expect(add).toHaveText('Add to bag')
  await add.click()

  const bag = page.getByRole('dialog', { name: /Your bag/ })
  await expect(bag).toBeVisible()
  await expect(bag.getByText('Size M')).toBeVisible()
  // The total comes from /api/quote, never from the plugin's cart.subtotal.
  await expect(bag.locator('dt', { hasText: 'Total' }).locator('xpath=..')).toContainText('1,399')

  await bag.getByRole('button', { name: 'One more' }).click()
  await expect(bag.locator('dt', { hasText: 'Total' }).locator('xpath=..')).toContainText('2,798')

  await bag.getByRole('button', { name: 'One fewer' }).click()
  await expect(bag.locator('dt', { hasText: 'Total' }).locator('xpath=..')).toContainText('1,399')

  // Still there after a hard reload.
  await page.reload()
  await page.getByRole('button', { name: /^Bag, 1 item$/ }).click()
  await expect(page.getByRole('dialog', { name: /Your bag/ }).getByText('Size M')).toBeVisible()

  // The bag leads to checkout, which shows the same piece.
  await page.getByRole('dialog', { name: /Your bag/ }).getByRole('link', { name: 'Checkout' }).click()
  await page.waitForURL('**/checkout')
  await expect(main(page)).toContainText('Al Shaheen Nights')
  await expect(main(page).getByLabel('Email')).toBeVisible()

  // And empties.
  await page.goto(`${BASE}${PIECE}`)
  await page.getByRole('button', { name: /^Bag, 1 item$/ }).click()
  await page.getByRole('dialog', { name: /Your bag/ }).getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Your bag is empty.')).toBeVisible()
})

/* --------------------------------------------------------------- accounts */

test('a customer creates an account, signs out and back in, and cannot open the admin', async ({
  page,
  request,
}) => {
  const email = `e2eonly-account-${Date.now()}@plumpose.local`
  const password = 'e2e-password-123'

  try {
    // Signed out, the account sends you to sign in and back.
    await page.goto(`${BASE}/account`)
    await page.waitForURL(/\/login\?.*redirect=%2Faccount/)

    await page.goto(`${BASE}/create-account`)
    await main(page).getByLabel('Name').fill('E2E Shopper')
    await main(page).getByLabel('Email').fill(email)
    await main(page).getByLabel('Password', { exact: true }).fill(password)
    await main(page).getByLabel('Password, again').fill(password)
    await main(page).getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL(/\/account/)
    await expect(page.getByText('Your account is ready. Welcome to plumpose.')).toBeVisible()
    await expect(page.getByText('E2E Shopper').first()).toBeVisible()

    // Orders lives inside the account.
    await page.goto(`${BASE}/orders`)
    await page.waitForURL(/\/account/)

    // A customer is not the shop.
    await page.goto(`${BASE}/admin`)
    await expect(page.getByText(/not allowed|Unauthorized|does not have access/i).first()).toBeVisible()

    await page.goto(`${BASE}/logout`)
    await page.goto(`${BASE}/account`)
    await page.waitForURL(/\/login/)

    await main(page).getByLabel('Email').fill(email)
    await main(page).getByLabel('Password').fill(password)
    await main(page).getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/\/account/)
    await expect(page.getByText('E2E Shopper').first()).toBeVisible()
  } finally {
    await deleteUser(request, email)
  }
})

test('a wrong password says so, without saying whether the account exists', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await main(page).getByLabel('Email').fill(`nobody-${Date.now()}@plumpose.local`)
  await main(page).getByLabel('Password').fill('not-the-password')
  await main(page).getByRole('button', { name: 'Sign in' }).click()
  await expect(main(page).getByRole('alert').first()).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

/* ------------------------------------------------------------ track order */

test('Track order gives the same reply whether or not an order matches', async ({ page }) => {
  await page.goto(`${BASE}/find-order`)
  await main(page).getByLabel('Email').fill(`nobody-${Date.now()}@plumpose.local`)
  await main(page).getByLabel('Order number').fill('#999999')
  await main(page).getByRole('button', { name: 'Find my order' }).click()
  await expect(main(page).getByText('Check your email')).toBeVisible()
})

test('Track order asks for what is missing before sending anything', async ({ page }) => {
  await page.goto(`${BASE}/find-order`)
  await main(page).getByRole('button', { name: 'Find my order' }).click()
  await expect(main(page).getByText('Please enter the email you ordered with.')).toBeVisible()
  await expect(main(page).getByText('Please enter your order number.')).toBeVisible()
})
