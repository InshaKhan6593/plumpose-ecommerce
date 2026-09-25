import type { APIRequestContext } from '@playwright/test'

import { expect, test } from '@playwright/test'
import crypto from 'node:crypto'

import { BASE } from '../helpers/base'
import {
  callback,
  payAndVanish,
  signCallback,
  skipcashReady,
  startCheckout,
} from '../helpers/skipcashCheckout'

/**
 * The payment webhook (P4) — `POST /api/payments/skipcash/webhooks`.
 *
 * Callbacks are signed here with the sandbox Webhook Key, exactly as SkipCash
 * signs them, so these run without SkipCash having to reach this machine
 * (it cannot reach localhost). The receiver re-reads every payment from
 * SkipCash's API before acting, so a signed callback still cannot make an
 * order for a payment SkipCash says is unpaid.
 *
 * The case worth the most: a customer pays on SkipCash's page and closes the
 * tab before it sends them back. They have still paid. Without the webhook
 * their order simply never exists. That test pays for real on SkipCash's
 * sandbox page.
 */

const WEBHOOK = `${BASE}/api/payments/skipcash/webhooks`
const DEV_USER = { email: 'dev@plumpose.local', password: 'devpassword' }

test.describe('payment webhook', () => {
  test.skip(!skipcashReady, 'needs PAYMENT_PROVIDER=skipcash and the SkipCash sandbox keys')

  let token: string

  const admin = () => ({ Authorization: `JWT ${token}` })

  /** Sends a callback signed the way SkipCash signs it. */
  const send = async (request: APIRequestContext, body: Record<string, unknown>, key?: string) => {
    const response = await request.post(WEBHOOK, {
      data: JSON.stringify(body),
      headers: { Authorization: signCallback(body, key), 'Content-Type': 'application/json' },
    })
    return { body: await response.json(), status: response.status() }
  }

  const logsFor = async (request: APIRequestContext, eventId: string) => {
    const res = await request.get(
      `${BASE}/api/webhookLog?where[eventId][equals]=${encodeURIComponent(eventId)}&limit=50`,
      { headers: admin() },
    )
    return (await res.json()).docs as Array<Record<string, unknown>>
  }

  /** Our record of a payment, by SkipCash's id for it. */
  const transactionFor = async (request: APIRequestContext, paymentId: string) => {
    const res = await request.get(
      `${BASE}/api/transactions?where[skipcash.paymentId][equals]=${paymentId}&depth=0`,
      { headers: admin() },
    )
    const doc = (await res.json()).docs[0]
    expect(doc, `no transaction for ${paymentId}`).toBeTruthy()
    return doc
  }

  test.beforeAll(async ({ request }) => {
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
    const forged = () =>
      callback({
        amount: '1419.00',
        paymentId: crypto.randomUUID(),
        reference: 'PLM-260925-FORGED',
        statusId: 2,
      })

    test('rejects an unsigned callback', async ({ request }) => {
      const response = await request.post(WEBHOOK, { data: forged() })
      expect(response.status()).toBe(401)
      expect((await response.json()).error).toContain('Invalid signature')
    })

    test('rejects one signed with the wrong key', async ({ request }) => {
      const { status } = await send(request, forged(), 'not-the-webhook-key')
      expect(status).toBe(401)
    })

    test('rejects one whose amount was changed after signing', async ({ request }) => {
      const body = forged()
      const response = await request.post(WEBHOOK, {
        data: JSON.stringify({ ...body, Amount: '1.00' }),
        headers: { Authorization: signCallback(body), 'Content-Type': 'application/json' },
      })
      expect(response.status()).toBe(401)
    })

    test('rejects a body that is not JSON', async ({ request }) => {
      const response = await request.post(WEBHOOK, {
        data: 'PaymentId=x&StatusId=2',
        headers: { 'Content-Type': 'text/plain' },
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
      expect((await request.post(WEBHOOK, { data: forged() })).status()).toBe(401)

      // A run of these is what a forgery attempt looks like; losing them hides it.
      // The receiver awaits the log write before replying, so this cannot race.
      expect(await countRejected()).toBe(countBefore + 1)
    })
  })

  test('accepts a properly signed callback and logs it as verified', async ({ request }) => {
    const paymentId = crypto.randomUUID()
    const { body, status } = await send(
      request,
      callback({ amount: '1419.00', paymentId, reference: 'PLM-260925-NOSUCH', statusId: 2 }),
    )

    // SkipCash does not know this payment, so nothing is made — and a retry would not help.
    expect(status).toBe(200)
    expect(body.reason).toBe('error')

    const logs = await logsFor(request, `${paymentId}:2`)
    expect(logs).toHaveLength(1)
    expect(logs[0].signatureValid).toBe(true)
    expect(logs[0].applied).toBe(false)
    expect(logs[0].event).toBe('skipcash.paid')
  })

  /**
   * A genuine "paid" callback is only a prompt to ask. Here the payment is
   * real but unpaid: SkipCash's API says so, and no order is made.
   */
  test('a "paid" callback for a payment SkipCash says is unpaid makes nothing', async ({
    request,
  }) => {
    const started = await startCheckout(request, { email: `unpaid-${Date.now()}@plumpose.local` })
    const transaction = await transactionFor(request, started.paymentId)

    const { body, status } = await send(
      request,
      callback({
        amount: '1419.00',
        paymentId: started.paymentId,
        reference: transaction.skipcash.reference,
        statusId: 2,
      }),
    )
    expect(status).toBe(200)
    expect(body.reason).toBe('unpaid')
    expect((await transactionFor(request, started.paymentId)).status).toBe('pending')
  })

  /**
   * The whole point of the webhook: the customer paid on SkipCash's page,
   * then closed the tab before it sent them back. The order must still exist.
   *
   * The browser is stopped from ever reaching `/checkout/return`, so only the
   * webhook can create the order. A guest here; the signed-in case follows.
   */
  test('creates the order when the customer never comes back', async ({ page, request }) => {
    test.setTimeout(180_000)
    const started = await startCheckout(request, {
      email: `webhook-only-${Date.now()}@plumpose.local`,
    })
    await payAndVanish(page, request, started)

    const { reference } = (await transactionFor(request, started.paymentId)).skipcash
    const paid = callback({
      amount: '1419.00',
      paymentId: started.paymentId,
      reference,
      statusId: 2,
    })
    const { body, status } = await send(request, paid)

    expect(status).toBe(200)
    expect(body.reason).toBe('confirmed')

    const transaction = await transactionFor(request, started.paymentId)
    expect(transaction.status).toBe('succeeded')
    expect(transaction.order, 'the transaction is linked to an order').toBeTruthy()
    // What the card network says, kept for reconciliation.
    expect(transaction.skipcash.visaId).toBeTruthy()

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

    /**
     * Callbacks arrive out of order. A failure or cancellation for the same
     * payment, landing after it was paid, must not move it backwards.
     */
    for (const statusId of [4, 3]) {
      await send(request, { ...paid, StatusId: statusId })
    }
    expect((await transactionFor(request, started.paymentId)).status).toBe('succeeded')
  })

  /**
   * The same, for a customer who was signed in. The webhook has no one signed
   * in, and the plugin settles an account holder's payment only as that
   * account — so it settles as the customer the transaction belongs to
   * (BUILD-LOG §31).
   */
  test('creates a signed-in customer’s order when they never come back', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000)
    const started = await startCheckout(request, { email: DEV_USER.email, headers: admin() })
    await payAndVanish(page, request, started)

    const { reference } = (await transactionFor(request, started.paymentId)).skipcash
    const { body, status } = await send(
      request,
      callback({ amount: '1419.00', paymentId: started.paymentId, reference, statusId: 2 }),
    )
    expect(status).toBe(200)
    expect(body.reason).toBe('confirmed')

    const transaction = await transactionFor(request, started.paymentId)
    expect(transaction.status).toBe('succeeded')

    const orders = await (
      await request.get(
        `${BASE}/api/orders?where[transactions][equals]=${transaction.id}&depth=0`,
        {
          headers: admin(),
        },
      )
    ).json()
    expect(orders.totalDocs).toBe(1)

    // The order is the account's, not a guest's.
    const me = await (await request.get(`${BASE}/api/users/me`, { headers: admin() })).json()
    expect(orders.docs[0].customer).toBe(me.user.id)
    expect(orders.docs[0].customerEmail ?? null).toBeNull()
  })

  /**
   * SkipCash retries, and sends the same event more than once. Applying one
   * twice would, for a paid one, decrement stock twice and burn a discount
   * code twice. A cancellation is used here because it applies
   * deterministically without paying.
   */
  test('applies a repeated callback only once', async ({ request }) => {
    const started = await startCheckout(request, { email: `retry-${Date.now()}@plumpose.local` })
    const { reference } = (await transactionFor(request, started.paymentId)).skipcash
    const cancelled = callback({
      amount: '1419.00',
      paymentId: started.paymentId,
      reference,
      statusId: 3,
    })

    const first = await send(request, cancelled)
    expect(first.status).toBe(200)

    const second = await send(request, cancelled)
    expect(second.status).toBe(200)
    expect(second.body.reason).toBe('duplicate')

    const logs = await logsFor(request, `${started.paymentId}:3`)
    // Both callbacks recorded; only one of them applied.
    expect(logs.length).toBeGreaterThanOrEqual(2)
    expect(logs.filter((log) => log.applied === true)).toHaveLength(1)

    // An abandoned checkout stays visible, marked expired (P11).
    expect((await transactionFor(request, started.paymentId)).status).toBe('expired')
  })

  /**
   * A refused card is logged but must not fail the transaction. SkipCash keeps
   * the payment link open for another card and reports the refusal under a
   * copy with a new payment id; the original may still be paid.
   */
  test('records a refused card without failing the transaction', async ({ request }) => {
    const started = await startCheckout(request, { email: `declined-${Date.now()}@plumpose.local` })
    const { reference } = (await transactionFor(request, started.paymentId)).skipcash

    const copyId = crypto.randomUUID()
    const { status } = await send(
      request,
      callback({ amount: '1419.00', paymentId: copyId, reference, statusId: 4 }),
    )

    expect(status).toBe(200)
    const logs = await logsFor(request, `${copyId}:4`)
    expect(logs[0].signatureValid).toBe(true)
    expect(logs[0].event).toBe('skipcash.failed')
    // Matched to the checkout, so the admin can say "card declined once".
    expect(logs[0].orderRef).toBe(String(started.cart.id))
    expect((await transactionFor(request, started.paymentId)).status).toBe('pending')
  })
})
