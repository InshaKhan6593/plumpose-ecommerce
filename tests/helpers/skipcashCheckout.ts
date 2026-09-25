import type { APIRequestContext, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import crypto from 'node:crypto'

import { BASE } from './base'

/**
 * Driving a purchase through SkipCash's payment page in its sandbox, the way
 * a customer does. The page cannot be paid through the API, so the payment
 * step runs in a real browser against skipcashtest.azurewebsites.net.
 *
 * Needs `PAYMENT_PROVIDER=skipcash`, `SKIPCASH_ENV=sandbox` and the four
 * sandbox keys in `.env` — the same ones the server uses.
 */

export const SANDBOX = 'https://skipcashtest.azurewebsites.net'

export const skipcashReady =
  process.env.PAYMENT_PROVIDER === 'skipcash' &&
  (process.env.SKIPCASH_ENV ?? '').toLowerCase() !== 'production' &&
  Boolean(
    process.env.SKIPCASH_CLIENT_ID &&
    process.env.SKIPCASH_KEY_ID &&
    process.env.SKIPCASH_KEY_SECRET &&
    process.env.SKIPCASH_WEBHOOK_KEY,
  )

/**
 * SkipCash's documented sandbox card that pays without a 3-D Secure challenge
 * (dev.skipcash.app → Test Cards). Test data, not a real card.
 */
const SANDBOX_CARD = { cvv: '256', expiry: '04/27', number: '5200000000000007' }

export const DOHA_ADDRESS = {
  addressLine1: 'Building 12, Street 340',
  addressLine2: 'Zone 66',
  city: 'Doha',
  country: 'QA',
  firstName: 'Test',
  lastName: 'Shopper',
  /** SkipCash blocks payments that share a phone number, so each checkout gets its own. */
  phone: '+974 5555 0000',
  postalCode: '',
}

const uniquePhone = () => `+974 5${String(Date.now()).slice(-7)}`

type LineOptions = { personalisation?: unknown[]; quantity?: number }

export type StartedCheckout = {
  cart: { id: number; secret?: string }
  paymentId: string
  redirectURL: string
}

/**
 * Builds a bag and asks the store for a payment page. As a guest by default
 * (the store's default checkout); pass `headers` to act as a signed-in user.
 */
export const startCheckout = async (
  request: APIRequestContext,
  opts: LineOptions & {
    discountCode?: string
    email: string
    gift?: boolean
    giftNote?: string
    headers?: Record<string, string>
  },
): Promise<StartedCheckout> => {
  const cartRes = await request.post(`${BASE}/api/carts`, {
    data: {
      currency: 'QAR',
      items: [
        {
          personalisation: opts.personalisation ?? [],
          product: 1,
          quantity: opts.quantity ?? 1,
          variant: 2,
        },
      ],
    },
    headers: opts.headers,
  })
  expect(
    cartRes.ok(),
    `creating the cart failed: ${cartRes.status()} ${await cartRes.text()}`,
  ).toBe(true)
  const cart = (await cartRes.json()).doc

  const address = { ...DOHA_ADDRESS, phone: uniquePhone() }
  const initiated = await request.post(`${BASE}/api/payments/skipcash/initiate`, {
    data: {
      billingAddress: address,
      cartID: cart.id,
      currency: 'QAR',
      ...(opts.headers ? {} : { customerEmail: opts.email, secret: cart.secret }),
      discountCode: opts.discountCode,
      gift: opts.gift ?? false,
      giftNote: opts.giftNote ?? '',
      shippingAddress: address,
      shippingCityKey: 'doha',
    },
    headers: opts.headers,
  })
  // Assert before reading fields off it (see CLAUDE.md): a failed initiate would
  // otherwise surface later as a navigation to "undefined".
  expect(
    initiated.ok(),
    `initiating payment failed: ${initiated.status()} ${await initiated.text()}`,
  ).toBe(true)
  const body = await initiated.json()
  expect(body.redirectURL, 'initiate returned no redirectURL').toMatch(
    new RegExp(`^${SANDBOX}/pay/`),
  )

  return { cart, paymentId: body.paymentId, redirectURL: body.redirectURL }
}

/** What SkipCash itself says about a payment, straight from its API. */
export const skipcashPayment = async (
  request: APIRequestContext,
  paymentId: string,
): Promise<{ amount: string; statusId: number; transactionId: string }> => {
  const res = await request.get(`${SANDBOX}/api/v1/payments/${paymentId}`, {
    headers: { Authorization: process.env.SKIPCASH_CLIENT_ID ?? '' },
  })
  expect(res.ok(), `SkipCash lookup failed: ${res.status()}`).toBe(true)
  return (await res.json()).resultObj
}

/**
 * Fills SkipCash's page with the sandbox card and submits it. The card
 * number and CVV live in CyberSource's secure iframes, in that order.
 */
export const payOnSkipcash = async (page: Page, redirectURL: string): Promise<void> => {
  await page.goto(redirectURL)
  const secure = page.locator('iframe[title="secure payment field"]')
  await expect(secure.first()).toBeVisible({ timeout: 30_000 })

  await secure.nth(0).contentFrame().locator('input').fill(SANDBOX_CARD.number)
  await page.locator('#CardExpiryDate:visible').fill(SANDBOX_CARD.expiry)
  await secure.nth(1).contentFrame().locator('input').fill(SANDBOX_CARD.cvv)
  await page.locator('#CardholderName').fill('Test Shopper')

  await page.locator('#submit_button').click()
}

/** Pays and follows SkipCash back to the store, returning the order it lands on. */
export const payAndReturn = async (page: Page, redirectURL: string) => {
  await payOnSkipcash(page, redirectURL)
  await page.waitForURL(/\/order\/\d+\?/, { timeout: 90_000 })
  const url = new URL(page.url())
  return {
    orderId: Number(url.pathname.split('/').pop()),
    placed: url.searchParams.get('placed'),
    token: url.searchParams.get('token') ?? '',
  }
}

/**
 * Pays, but never lets the browser reach the store again — the customer who
 * closes the tab the moment SkipCash says "paid". Waits until SkipCash itself
 * reports the payment paid.
 */
export const payAndVanish = async (
  page: Page,
  request: APIRequestContext,
  started: StartedCheckout,
) => {
  await page.route('**/checkout/return**', (route) => route.abort())
  await payOnSkipcash(page, started.redirectURL)

  await expect
    .poll(async () => (await skipcashPayment(request, started.paymentId)).statusId, {
      message: 'SkipCash never reported the payment paid',
      timeout: 90_000,
    })
    .toBe(2)
}

/* -------------------------------------------------------------------------- */
/*                           Signed webhook callbacks                          */
/* -------------------------------------------------------------------------- */

const WEBHOOK_FIELDS = ['PaymentId', 'Amount', 'StatusId', 'TransactionId', 'Custom1', 'VisaId']

/**
 * Signs a callback the way SkipCash does, with the Webhook Key. Written out
 * here rather than imported from the app, so a mistake in the app's signing
 * cannot also hide in the test.
 */
export const signCallback = (
  body: Record<string, unknown>,
  key = process.env.SKIPCASH_WEBHOOK_KEY ?? '',
) =>
  crypto
    .createHmac('sha256', key)
    .update(
      WEBHOOK_FIELDS.filter((f) => body[f] !== undefined && body[f] !== null && body[f] !== '')
        .map((f) => `${f}=${String(body[f])}`)
        .join(','),
      'utf8',
    )
    .digest('base64')

/** A callback shaped like SkipCash's (dev.skipcash.app → Webhooks). */
export const callback = (args: {
  amount: string
  paymentId: string
  reference: string
  statusId: number
}) => ({
  Amount: args.amount,
  CardNubmer: null,
  CardType: 'Credit Card',
  Custom1: null,
  PaymentId: args.paymentId,
  RecurringSubscriptionId: '00000000-0000-0000-0000-000000000000',
  StatusId: args.statusId,
  TokenId: 'NA',
  TransactionId: args.reference,
  VisaId: `${Date.now()}`,
})
