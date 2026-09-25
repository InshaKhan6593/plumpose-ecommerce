import type { APIRequestContext } from '@playwright/test'

import { expect, test } from '@playwright/test'
import Stripe from 'stripe'

import { BASE } from '../helpers/base'
import { payAndVanish, startCheckout } from '../helpers/stripeCheckout'

/**
 * The payment webhook (P4).
 *
 * Signed requests are built here with `generateTestHeaderString` rather than
 * driven through the Stripe CLI, so these run deterministically without a
 * listener open in another terminal.
 *
 * The case worth the most: a customer pays on Stripe's hosted page and closes
 * the tab before it sends them back. They have still paid. Without the webhook
 * their order simply never exists — and nobody finds out until they ask where
 * it is. That test pays for real on checkout.stripe.com (test mode).
 */

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

  /** A Checkout Session event, as Stripe sends it; the receiver re-reads the real session. */
  const sessionEvent = (args: { cartID: string; id: string; sessionId: string; type: string }) => ({
    data: {
      object: { id: args.sessionId, metadata: { cartID: args.cartID }, object: 'checkout.session' },
    },
    id: args.id,
    object: 'event',
    type: args.type,
  })

  const transactionFor = async (request: APIRequestContext, sessionId: string) => {
    const res = await request.get(
      `${BASE}/api/transactions?where[stripe.checkoutSessionID][equals]=${sessionId}&depth=0`,
      { headers: admin() },
    )
    const doc = (await res.json()).docs[0]
    expect(doc, `no transaction for ${sessionId}`).toBeTruthy()
    return doc
  }

  test.beforeAll(async ({ request }) => {
    stripe = new Stripe(secretKey as string)
    const login = await request.post(`${BASE}/api/users/login`, { data: DEV_USER })
    // Assert it here. Without this a failed login leaves `token` undefined,
    // every later request goes out as `Authorization: JWT undefined`, and the
    // first thing to fail is an assertion on a field the 403 body does not
    // have -- which reports as "Expected: NaN" and says nothing about auth.
    expect(login.ok(), `login as ${DEV_USER.email} failed: ${login.status()}`).toBe(true)
    token = (await login.json()).token
    expect(token, 'login returned no token').toBeTruthy()
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
      /** `webhookLog.read` is admin-only, so an unauthenticated GET 403s. */
      const countRejected = async (): Promise<number> => {
        const response = await request.get(
          `${BASE}/api/webhookLog?where[signatureValid][equals]=false&limit=1`,
          { headers: admin() },
        )
        expect(
          response.ok(),
          `reading webhookLog failed: ${response.status()} ${await response.text()}`,
        ).toBe(true)
        const { totalDocs } = await response.json()
        expect(typeof totalDocs, 'webhookLog did not return totalDocs').toBe('number')
        return totalDocs as number
      }

      const countBefore = await countRejected()

      const rejected = await request.post(WEBHOOK, {
        data: { type: 'payment_intent.succeeded' },
      })
      expect(rejected.status()).toBe(400)

      // A run of these is what a forgery attempt looks like; losing them hides it.
      // The receiver awaits the log write before replying, so this cannot race.
      expect(await countRejected()).toBe(countBefore + 1)
    })
  })

  test('accepts a properly signed event and logs it as verified', async ({ request }) => {
    const eventId = `evt_test_${Date.now()}`
    const { body, status } = await send(
      request,
      paidEvent({ id: eventId, paymentIntentID: 'pi_nonexistent' }),
    )

    expect(status).toBe(200)
    // No Checkout Session behind it, so it was not made by this store: logged, not retried.
    expect(body.reason).toBe('not a checkout payment')

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
   * The whole point of the webhook: the customer paid on Stripe's page, then
   * closed the tab before it sent them back. The order must still exist.
   *
   * The browser is stopped from ever reaching `/checkout/return`, so only the
   * webhook can create the order. A guest here; the signed-in case follows.
   */
  test('creates the order when the customer never comes back', async ({ page, request }) => {
    test.setTimeout(120_000)
    const started = await startCheckout(request, {
      email: `webhook-only-${Date.now()}@plumpose.local`,
    })
    await payAndVanish(page, stripe, started)

    const eventId = `evt_test_${Date.now()}_orphan`
    const { body, status } = await send(
      request,
      sessionEvent({
        cartID: String(started.cart.id),
        id: eventId,
        sessionId: started.sessionId,
        type: 'checkout.session.completed',
      }),
    )

    expect(status).toBe(200)
    // "confirmed" whether this call made the order or a forwarded real event beat it to it.
    expect(body.reason).toBe('confirmed')

    const transaction = await transactionFor(request, started.sessionId)
    expect(transaction.status).toBe('succeeded')
    expect(transaction.order, 'the transaction is linked to an order').toBeTruthy()

    const orders = await (
      await request.get(`${BASE}/api/orders?where[transactions][equals]=${transaction.id}`, {
        headers: admin(),
      })
    ).json()
    // Exactly one, however many callers raced to create it.
    expect(orders.totalDocs).toBe(1)

    // Built through the same path the browser would have used.
    const order = orders.docs[0]
    expect(order.amount).toBe(141900)
    expect(order.shippingQar).toBe(2000)
    expect(order.shippingLabel).toBe('Delivery to Doha')
  })

  /**
   * The same, for a customer who was signed in. The webhook has no one signed
   * in, and the plugin settles an account holder's payment only as that
   * account — so this order used to be lost. It now settles as the customer
   * the transaction belongs to (BUILD-LOG §31).
   */
  test('creates a signed-in customer’s order when they never come back', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const started = await startCheckout(request, { email: DEV_USER.email, headers: admin() })
    await payAndVanish(page, stripe, started)

    const { body, status } = await send(
      request,
      sessionEvent({
        cartID: String(started.cart.id),
        id: `evt_test_${Date.now()}_orphan_account`,
        sessionId: started.sessionId,
        type: 'checkout.session.completed',
      }),
    )
    expect(status).toBe(200)
    expect(body.reason).toBe('confirmed')

    const transaction = await transactionFor(request, started.sessionId)
    expect(transaction.status).toBe('succeeded')

    const orders = await (
      await request.get(`${BASE}/api/orders?where[transactions][equals]=${transaction.id}&depth=0`, {
        headers: admin(),
      })
    ).json()
    expect(orders.totalDocs).toBe(1)

    // The order is the account's, not a guest's.
    const me = await (await request.get(`${BASE}/api/users/me`, { headers: admin() })).json()
    expect(orders.docs[0].customer).toBe(me.user.id)
    expect(orders.docs[0].customerEmail ?? null).toBeNull()
  })

  /**
   * Gateways retry. Applying the same callback twice would, for a paid one,
   * decrement stock twice and burn a discount code twice. An expiry is used
   * here because it applies deterministically without paying.
   */
  test('applies a repeated callback only once', async ({ request }) => {
    const started = await startCheckout(request, { email: `retry-${Date.now()}@plumpose.local` })
    const event = sessionEvent({
      cartID: String(started.cart.id),
      id: `evt_test_${Date.now()}_retry`,
      sessionId: started.sessionId,
      type: 'checkout.session.expired',
    })

    const first = await send(request, event)
    expect(first.status).toBe(200)

    const second = await send(request, event)
    expect(second.status).toBe(200)
    expect(second.body.reason).toBe('duplicate')

    const logs = await logsFor(request, event.id)
    // Both callbacks recorded; only one of them applied.
    expect(logs.length).toBeGreaterThanOrEqual(2)
    expect(logs.filter((log) => log.applied === true)).toHaveLength(1)

    // An abandoned checkout stays visible, marked expired (P11).
    expect((await transactionFor(request, started.sessionId)).status).toBe('expired')
    await stripe.checkout.sessions.expire(started.sessionId).catch(() => undefined)
  })

  /**
   * A declined card is logged but must not fail the transaction: on the hosted
   * page the customer can try another card in the same session, and the plugin
   * only settles a transaction that is still pending.
   */
  test('records a declined card without failing the transaction', async ({ request }) => {
    const started = await startCheckout(request, { email: `declined-${Date.now()}@plumpose.local` })

    const eventId = `evt_test_${Date.now()}_failed`
    const { status } = await send(request, {
      data: {
        object: {
          id: 'pi_failed_x',
          metadata: { cartID: String(started.cart.id) },
          object: 'payment_intent',
        },
      },
      id: eventId,
      object: 'event',
      type: 'payment_intent.payment_failed',
    })

    expect(status).toBe(200)
    const logs = await logsFor(request, eventId)
    expect(logs[0].signatureValid).toBe(true)
    expect(logs[0].event).toBe('payment_intent.payment_failed')
    expect((await transactionFor(request, started.sessionId)).status).toBe('pending')

    await stripe.checkout.sessions.expire(started.sessionId).catch(() => undefined)
  })
})
