import type { APIRequestContext } from '@playwright/test'

import { expect, test } from '@playwright/test'
import Stripe from 'stripe'

/**
 * A whole purchase, end to end, against the Stripe sandbox.
 *
 * This is the test that proves the pieces actually meet: the pricing engine,
 * the cart, the gateway, order creation, stock, and the discount ledger. Each
 * has its own tests; none of them catch the seams between them.
 *
 * It is slower and noisier than the rest of the suite, and it is worth it —
 * "the order was created but the embroidery instructions are missing" is
 * exactly the class of bug that only appears once the whole path runs.
 *
 * Requires `PAYMENT_PROVIDER=stripe` and the Stripe test keys. Skips cleanly
 * when they are absent, so the suite still runs on a machine without them.
 */

const BASE = 'http://localhost:3000'
const DEV_USER = { email: 'dev@plumpose.local', password: 'devpassword' }
const SHOPPER = 'checkout-e2e@plumpose.local'

const secretKey = process.env.STRIPE_SECRET_KEY
const stripeReady = Boolean(secretKey?.startsWith('sk_test_'))

test.describe('checkout, end to end', () => {
  test.skip(!stripeReady, 'needs STRIPE_SECRET_KEY in test mode')

  let stripe: Stripe
  let token: string
  const madeCodes: number[] = []

  const admin = () => ({ Authorization: `JWT ${token}` })

  const readStock = async (request: APIRequestContext, variantId: number): Promise<number> => {
    const res = await request.get(`${BASE}/api/variants/${variantId}`, { headers: admin() })
    return (await res.json()).inventory ?? 0
  }

  test.beforeAll(async ({ request }) => {
    stripe = new Stripe(secretKey as string)
    const login = await request.post(`${BASE}/api/users/login`, { data: DEV_USER })
    token = (await login.json()).token
  })

  /**
   * Best-effort cleanup.
   *
   * A code that was actually redeemed cannot be removed: `discountUses` rows
   * reference it and that ledger is deliberately undeletable — it is a
   * financial record. The delete fails on the foreign key and that is correct,
   * so the prefix is what marks the leftovers as disposable.
   */
  test.afterAll(async ({ request }) => {
    for (const id of madeCodes) {
      await request
        .delete(`${BASE}/api/discountCodes/${id}`, { headers: admin() })
        .catch(() => undefined)
    }
  })

  /**
   * Drives a real purchase: build a bag, ask the gateway for a payment,
   * confirm it with a test card, then tell the store the payment succeeded.
   */
  const purchase = async (
    request: APIRequestContext,
    opts: { discountCode?: string; personalisation?: unknown[]; quantity?: number } = {},
  ) => {
    const cartRes = await request.post(`${BASE}/api/carts`, {
      data: {
        discountCode: opts.discountCode,
        items: [
          {
            personalisation: opts.personalisation ?? [],
            product: 1,
            quantity: opts.quantity ?? 1,
            variant: 2,
          },
        ],
        shippingCityKey: 'doha',
      },
      headers: admin(),
    })
    expect(
      cartRes.ok(),
      `creating the cart failed: ${cartRes.status()} ${await cartRes.text()}`,
    ).toBe(true)
    const cart = (await cartRes.json()).doc

    const initiated = await request.post(`${BASE}/api/payments/stripe/initiate`, {
      data: {
        billingAddress: { city: 'Doha', country: 'QA' },
        cartID: cart.id,
        customerEmail: SHOPPER,
        shippingAddress: { city: 'Doha', country: 'QA' },
      },
      headers: admin(),
    })
    // Assert before using it. Otherwise a failed initiate surfaces further down
    // as Stripe complaining that "intent" is undefined, which hides the cause.
    expect(
      initiated.ok(),
      `initiating payment failed: ${initiated.status()} ${await initiated.text()}`,
    ).toBe(true)
    const initiatedBody = await initiated.json()
    expect(initiatedBody.paymentIntentID, 'initiate returned no paymentIntentID').toBeTruthy()

    // Pay it, the way a customer's browser would.
    await stripe.paymentIntents.confirm(initiatedBody.paymentIntentID, {
      payment_method: 'pm_card_visa',
      return_url: BASE,
    })

    const confirmed = await request.post(`${BASE}/api/payments/stripe/confirm-order`, {
      /** The transaction is looked up from the payment intent, not passed in. */
      data: {
        cartID: cart.id,
        customerEmail: SHOPPER,
        paymentIntentID: initiatedBody.paymentIntentID,
      },
      headers: admin(),
    })

    return {
      cart,
      confirmed: await confirmed.json(),
      initiated: initiatedBody,
      status: confirmed.status(),
    }
  }

  test('charges the engine total, not the cart subtotal', async ({ request }) => {
    const { initiated } = await purchase(request)
    const intent = await stripe.paymentIntents.retrieve(initiated.paymentIntentID)

    // QAR 1,399 goods + QAR 20 delivery. The plugin alone would charge 139900.
    expect(intent.amount).toBe(141900)
    expect(intent.currency).toBe('qar')
  })

  test('creates an order carrying the full money breakdown', async ({ request }) => {
    const { confirmed, status } = await purchase(request)
    expect(status).toBe(200)

    const order = await (
      await request.get(`${BASE}/api/orders/${confirmed.orderID}`, { headers: admin() })
    ).json()

    expect(order.amount).toBe(141900)
    expect(order.subtotalQar).toBe(139900)
    expect(order.shippingQar).toBe(2000)
    expect(order.shippingLabel).toBe('Delivery to Doha')
    expect(order.shippingZone).toBe('qatar')
    expect(order.personalisationTotalQar).toBe(0)
  })

  test('carries embroidery instructions onto the order', async ({ request }) => {
    const { confirmed, initiated } = await purchase(request, {
      personalisation: [{ lettering: 'AK', placement: 'pocket', style: 'text', thread: 'gold' }],
    })

    const intent = await stripe.paymentIntents.retrieve(initiated.paymentIntentID)
    // QAR 1,399 + 160 embroidery + 20 delivery.
    expect(intent.amount).toBe(157900)

    const order = await (
      await request.get(`${BASE}/api/orders/${confirmed.orderID}`, { headers: admin() })
    ).json()

    expect(order.personalisationTotalQar).toBe(16000)

    // The atelier cannot work without this.
    const placement = order.items[0].personalisation[0]
    expect(placement.placementName).toBe('Pocket')
    expect(placement.lettering).toBe('AK')
    expect(placement.threadName).toBe('Gold')
  })

  test('decrements stock by the quantity ordered', async ({ request }) => {
    const before = await readStock(request, 2)
    await purchase(request, { quantity: 2 })
    expect(await readStock(request, 2)).toBe(before - 2)
  })

  test('redeems a discount code only once payment succeeds', async ({ request }) => {
    const code = `E2EPAID-${Date.now()}`
    const created = await request.post(`${BASE}/api/discountCodes`, {
      data: { active: true, code, perCustomerLimit: 1, type: 'percent', value: 10 },
      headers: admin(),
    })
    const codeId = (await created.json()).doc.id
    madeCodes.push(codeId)

    const { confirmed, initiated } = await purchase(request, { discountCode: code })

    // 10% off QAR 1,399 goods; delivery untouched.
    const intent = await stripe.paymentIntents.retrieve(initiated.paymentIntentID)
    expect(intent.amount).toBe(139900 - 13990 + 2000)

    const order = await (
      await request.get(`${BASE}/api/orders/${confirmed.orderID}`, { headers: admin() })
    ).json()
    expect(order.discountTotalQar).toBe(13990)
    expect(order.discountCode).toBe(code)

    // The counter moved, and the ledger row exists.
    const reloaded = await (
      await request.get(`${BASE}/api/discountCodes/${codeId}`, { headers: admin() })
    ).json()
    expect(reloaded.usageCount).toBe(1)

    const uses = await (
      await request.get(`${BASE}/api/discountUses?where[code][equals]=${codeId}`, {
        headers: admin(),
      })
    ).json()
    expect(uses.totalDocs).toBe(1)
    /**
     * The ledger records the *authenticated* customer, not whatever email the
     * request carried — the plugin uses `req.user.email` when someone is
     * signed in. These tests run as the dev admin, so that is the address
     * here; a guest checkout would record the one they typed.
     */
    expect(uses.docs[0].email).toBe(DEV_USER.email)
  })
})
