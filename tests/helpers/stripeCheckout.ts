import type { APIRequestContext, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import type Stripe from 'stripe'

import { BASE } from './base'

/**
 * Driving a purchase through Stripe's **hosted** Checkout page, the way a
 * customer does. A hosted page cannot be paid through the API, so the payment
 * step runs in a real browser against checkout.stripe.com in test mode.
 */

export const DOHA_ADDRESS = {
  addressLine1: 'Building 12, Street 340',
  addressLine2: 'Zone 66',
  city: 'Doha',
  country: 'QA',
  firstName: 'Test',
  lastName: 'Shopper',
  phone: '+974 5555 0000',
  postalCode: '',
}

type LineOptions = { personalisation?: unknown[]; quantity?: number }

export type StartedCheckout = {
  cart: { id: number; secret?: string }
  redirectURL: string
  sessionId: string
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
      items: [{ personalisation: opts.personalisation ?? [], product: 1, quantity: opts.quantity ?? 1, variant: 2 }],
    },
    headers: opts.headers,
  })
  expect(cartRes.ok(), `creating the cart failed: ${cartRes.status()} ${await cartRes.text()}`).toBe(true)
  const cart = (await cartRes.json()).doc

  const initiated = await request.post(`${BASE}/api/payments/stripe/initiate`, {
    data: {
      billingAddress: DOHA_ADDRESS,
      cartID: cart.id,
      currency: 'QAR',
      ...(opts.headers ? {} : { customerEmail: opts.email, secret: cart.secret }),
      discountCode: opts.discountCode,
      gift: opts.gift ?? false,
      giftNote: opts.giftNote ?? '',
      shippingAddress: DOHA_ADDRESS,
      shippingCityKey: 'doha',
    },
    headers: opts.headers,
  })
  // Assert before reading fields off it (see CLAUDE.md): a failed initiate would
  // otherwise surface later as a navigation to "undefined".
  expect(initiated.ok(), `initiating payment failed: ${initiated.status()} ${await initiated.text()}`).toBe(true)
  const body = await initiated.json()
  expect(body.redirectURL, 'initiate returned no redirectURL').toMatch(/^https:\/\/checkout\.stripe\.com\//)

  return { cart, redirectURL: body.redirectURL, sessionId: body.checkoutSessionID }
}

/** Fills Stripe's hosted page with the test Visa and submits it. */
export const payOnStripe = async (page: Page, redirectURL: string): Promise<void> => {
  await page.goto(redirectURL)
  await page.waitForSelector('#cardNumber', { timeout: 30_000 })
  await page.fill('#cardNumber', '4242424242424242')
  await page.fill('#cardExpiry', '12 / 34')
  await page.fill('#cardCvc', '123')
  await page.fill('#billingName', 'Test Shopper')

  const country = page.locator('#billingCountry')
  if (await country.count()) await country.selectOption('QA').catch(() => undefined)
  const postcode = page.locator('#billingPostalCode')
  if ((await postcode.count()) && (await postcode.isVisible())) await postcode.fill('00000')

  await page.locator('button[type="submit"], .SubmitButton').first().click()
}

/** Pays and follows Stripe back to the store, returning the order it lands on. */
export const payAndReturn = async (page: Page, redirectURL: string) => {
  await payOnStripe(page, redirectURL)
  await page.waitForURL(/\/order\/\d+\?/, { timeout: 60_000 })
  const url = new URL(page.url())
  return {
    orderId: Number(url.pathname.split('/').pop()),
    placed: url.searchParams.get('placed'),
    token: url.searchParams.get('token') ?? '',
  }
}

/**
 * Pays, but never lets the browser reach the store again — the customer who
 * closes the tab the moment Stripe says "paid". Waits until Stripe itself
 * reports the session paid.
 */
export const payAndVanish = async (page: Page, stripe: Stripe, started: StartedCheckout) => {
  await page.route('**/checkout/return**', (route) => route.abort())
  await payOnStripe(page, started.redirectURL)

  await expect
    .poll(async () => (await stripe.checkout.sessions.retrieve(started.sessionId)).payment_status, {
      message: 'Stripe never reported the session paid',
      timeout: 60_000,
    })
    .toBe('paid')
}
