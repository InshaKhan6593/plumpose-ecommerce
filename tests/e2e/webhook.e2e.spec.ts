import type { APIRequestContext } from '@playwright/test'

import { expect, test } from '@playwright/test'
import Stripe from 'stripe'

/**
 * The payment webhook (P4).
 *
 * Signed requests are built here with `generateTestHeaderString` rather than
 * driven through the Stripe CLI, so these run deterministically without a
 * listener open in another terminal.
 *
 * The case worth the most: a customer pays and closes the tab before the
 * confirmation call lands. They have still paid. Without the webhook their
 * order simply never exists — and nobody finds out until they ask where it is.
 */

const BASE = 'http://localhost:3000'
const WEBHOOK = `${BASE}/api/payments/stripe/webhooks`
const DEV_USER = { email: 'dev@plumpose.local', password: 'devpassword' }

const secretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOKS_SIGNING_SECRET
const ready = Boolean(secretKey?.startsWith('sk_test_') && webhookSecret?.startsWith('whsec_'))

test.describe('payment webhook', () => {
  test.skip(!ready, 'needs STRIPE_SECRET_KEY and STRIPE_WEBHOOKS_SIGNING_SECRET')

  let stripe: Stripe
  let token: string

  const admin = () => ({ Authorization: `JWT ${token}` })

  /** Signs a payload the way Stripe would, so the receiver accepts it. */
  const send = async (request: APIRequestContext, event: Record<string, unknown>) => {
    const body = JSON.stringify(event)
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: webhookSecret as string,
    })

    const response = await request.post(WEBHOOK, {
      data: body,
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
    })

    return { body: await response.json(), status: response.status() }
  }

  const paidEvent = (args: { cartID?: string; id: string; paymentIntentID: string }) => ({
    data: {
      object: {
        id: args.paymentIntentID,
        metadata: args.cartID ? { cartID: args.cartID } : {},
        object: 'payment_intent',
      },
    },
    id: args.id,
    object: 'event',
    type: 'payment_intent.succeeded',
  })

  const logsFor = async (request: APIRequestContext, eventId: string) => {
    const res = await request.get(
      `${BASE}/api/webhookLog?where[eventId][equals]=${eventId}&limit=50`,
      { headers: admin() },
    )
    return (await res.json()).docs as Array<Record<string, unknown>>
  }

  /**
   * A **guest** purchase, paid but never confirmed.
   *
   * Guest deliberately: the plugin refuses to settle a signed-in customer's
   * transaction from an anonymous caller ("Guest transaction belongs to an
   * authenticated customer"), and a webhook is always anonymous. Guest checkout
   * is the store's default (C4/S10), so this is the case that matters — see the
   * build log for the limitation on account holders.
   */
  const payAsGuestWithoutConfirming = async (request: APIRequestContext, email: string) => {
    const cartRes = await request.post(`${BASE}/api/carts`, {
      data: {
        items: [{ personalisation: [], product: 1, quantity: 1, variant: 2 }],
        shippingCityKey: 'doha',
      },
    })
    const cart = (await cartRes.json()).doc

    const initiated = await request.post(`${BASE}/api/payments/stripe/initiate`, {
      data: {
        billingAddress: { city: 'Doha', country: 'QA' },
        cartID: cart.id,
        customerEmail: email,
        secret: cart.secret,
        shippingAddress: { city: 'Doha', country: 'QA' },
      },
    })
    const { paymentIntentID } = await initiated.json()

    await stripe.paymentIntents.confirm(paymentIntentID, {
      payment_method: 'pm_card_visa',
      return_url: BASE,
    })

    return { cart, paymentIntentID }
  }

  test.beforeAll(async ({ request }) => {
    stripe = new Stripe(secretKey as string)
    const login = await request.post(`${BASE}/api/users/login`, { data: DEV_USER })
    token = (await login.json()).token
  })

  test.describe('refuses what it cannot verify', () => {
    /**
     * The defect this replaced: the plugin's receiver wrapped verification in
     * `if (stripeSignature)`, so an unsigned request skipped the check entirely
     * and got back `200 {received:true}`.
     */
    test('rejects an unsigned request', async ({ request }) => {
      const response = await request.post(WEBHOOK, {
        data: { type: 'payment_intent.succeeded' },
      })
      expect(response.status()).toBe(400)
      expect((await response.json()).error).toContain('Missing signature')
    })

    test('rejects a forged signature', async ({ request }) => {
      const response = await request.post(WEBHOOK, {
        data: { type: 'payment_intent.succeeded' },
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      })
      expect(response.status()).toBe(400)
    })

    test('records the attempt rather than discarding it', async ({ request }) => {
      const before = await request.get(
        `${BASE}/api/webhookLog?where[signatureValid][equals]=false&limit=1`,
        { headers: admin() },
      )
      const countBefore = (await before.json()).totalDocs

      await request.post(WEBHOOK, { data: { type: 'payment_intent.succeeded' } })

      const after = await request.get(
        `${BASE}/api/webhookLog?where[signatureValid][equals]=false&limit=1`,
        { headers: admin() },
      )
      // A run of these is what a forgery attempt looks like; losing them hides it.
      expect((await after.json()).totalDocs).toBe(countBefore + 1)
    })
  })

  test('accepts a properly signed event and logs it as verified', async ({ request }) => {
    const eventId = `evt_test_${Date.now()}`
    const { body, status } = await send(
      request,
      paidEvent({ id: eventId, paymentIntentID: 'pi_nonexistent' }),
    )

    expect(status).toBe(200)
    // No cart id on it, so there is nothing to confirm.
    expect(body.reason).toBe('unusable')

    const logs = await logsFor(request, eventId)
    expect(logs).toHaveLength(1)
    expect(logs[0].signatureValid).toBe(true)
    expect(logs[0].applied).toBe(false)
  })

  test('ignores event types it does not act on', async ({ request }) => {
    const eventId = `evt_test_${Date.now()}_other`
    const { body } = await send(request, {
      data: { object: { id: 'pi_x', object: 'payment_intent' } },
      id: eventId,
      object: 'event',
      type: 'payment_intent.created',
    })
    expect(body.reason).toBe('ignored')
  })

  /**
   * The whole point of the webhook: the customer paid, then closed the tab
   * before `/confirm-order` ran. The order must still exist.
   */
  test('creates the order when the browser never confirmed it', async ({ request }) => {
    const { cart, paymentIntentID } = await payAsGuestWithoutConfirming(
      request,
      'webhook-only@plumpose.local',
    )

    // Deliberately skip /confirm-order — this is the abandoned-tab case.
    const eventId = `evt_test_${Date.now()}_orphan`
    const { body, status } = await send(
      request,
      paidEvent({ cartID: String(cart.id), id: eventId, paymentIntentID }),
    )

    expect(status).toBe(200)
    expect(body.reason).toBe('confirmed by webhook')

    const orders = await request.get(
      `${BASE}/api/orders?where[subtotalQar][equals]=139900&sort=-createdAt&limit=1`,
      { headers: admin() },
    )
    const order = (await orders.json()).docs[0]

    // Built through the same path the browser would have used.
    expect(order.amount).toBe(141900)
    expect(order.shippingQar).toBe(2000)
    expect(order.shippingLabel).toBe('Delivery to Doha')

    const logs = await logsFor(request, eventId)
    expect(logs[0].applied).toBe(true)
  })

  /**
   * Gateways retry. Applying the same callback twice would decrement stock
   * twice and burn a discount code twice.
   */
  test('applies a repeated callback only once', async ({ request }) => {
    const { cart, paymentIntentID } = await payAsGuestWithoutConfirming(
      request,
      'retry@plumpose.local',
    )

    const eventId = `evt_test_${Date.now()}_retry`
    const event = paidEvent({ cartID: String(cart.id), id: eventId, paymentIntentID })

    const first = await send(request, event)
    expect(first.body.reason).toBe('confirmed by webhook')

    const second = await send(request, event)
    expect(second.status).toBe(200)
    expect(second.body.reason).toBe('duplicate')

    const logs = await logsFor(request, eventId)
    // Both callbacks recorded; only one of them applied.
    expect(logs.length).toBeGreaterThanOrEqual(2)
    expect(logs.filter((log) => log.applied === true)).toHaveLength(1)
  })

  test('records a failed payment rather than dropping it', async ({ request }) => {
    const eventId = `evt_test_${Date.now()}_failed`
    const { status } = await send(request, {
      data: { object: { id: 'pi_failed_x', object: 'payment_intent' } },
      id: eventId,
      object: 'event',
      type: 'payment_intent.payment_failed',
    })

    expect(status).toBe(200)
    const logs = await logsFor(request, eventId)
    expect(logs[0].signatureValid).toBe(true)
    expect(logs[0].event).toBe('payment_intent.payment_failed')
  })
})
