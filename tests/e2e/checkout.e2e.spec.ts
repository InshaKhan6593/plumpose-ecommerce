import type { APIRequestContext } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { BASE } from '../helpers/base'
import {
  payAndReturn,
  skipcashPayment,
  skipcashReady,
  startCheckout,
} from '../helpers/skipcashCheckout'

/**
 * A whole purchase, end to end, against the SkipCash sandbox — through
 * SkipCash's own payment page, the redirect flow the store uses.
 *
 * This is the test that proves the pieces actually meet: the pricing engine,
 * the cart, the gateway, the return page, order creation, stock and the
 * discount ledger. Each has its own tests; none of them catch the seams between
 * them. It is slower than the rest of the suite and worth it — "the order was
 * created but the embroidery instructions are missing" is exactly the class of
 * bug that only appears once the whole path runs.
 *
 * Requires `PAYMENT_PROVIDER=skipcash` and the SkipCash sandbox keys; skips
 * cleanly without them. Needs network access to skipcashtest.azurewebsites.net.
 */

const DEV_USER = { email: 'dev@plumpose.local', password: 'devpassword' }

/** A fresh guest per test, so per-customer discount limits never collide. */
const shopper = (tag: string) => `e2e-${tag}-${Date.now()}@plumpose.local`

test.describe('checkout, end to end', () => {
  test.skip(!skipcashReady, 'needs PAYMENT_PROVIDER=skipcash and the SkipCash sandbox keys')
  test.setTimeout(150_000)

  let token: string
  const madeCodes: number[] = []

  const admin = () => ({ Authorization: `JWT ${token}` })

  const readOrder = async (request: APIRequestContext, id: number) => {
    const res = await request.get(`${BASE}/api/orders/${id}?depth=0`, { headers: admin() })
    expect(res.ok(), `reading order ${id} failed: ${res.status()}`).toBe(true)
    return res.json()
  }

  const readStock = async (request: APIRequestContext, variantId: number): Promise<number> => {
    const res = await request.get(`${BASE}/api/variants/${variantId}`, { headers: admin() })
    return (await res.json()).inventory ?? 0
  }

  test.beforeAll(async ({ request }) => {
    const login = await request.post(`${BASE}/api/users/login`, { data: DEV_USER })
    expect(login.ok(), `login as ${DEV_USER.email} failed: ${login.status()}`).toBe(true)
    token = (await login.json()).token
  })

  /**
   * Best-effort cleanup. A code that was actually redeemed cannot be removed:
   * `discountUses` rows reference it and that ledger is deliberately
   * undeletable — it is a financial record. The prefix marks leftovers.
   */
  test.afterAll(async ({ request }) => {
    for (const id of madeCodes) {
      await request
        .delete(`${BASE}/api/discountCodes/${id}`, { headers: admin() })
        .catch(() => undefined)
    }
  })

  test('charges the engine total, not the cart subtotal', async ({ request }) => {
    const { paymentId } = await startCheckout(request, { email: shopper('total') })
    const payment = await skipcashPayment(request, paymentId)

    // QAR 1,399 goods + QAR 20 Doha delivery. The plugin alone would charge 1399.00.
    expect(payment.amount).toBe('1419.00')
    expect(payment.statusId).toBe(0)
  })

  test('creates an order carrying the money breakdown, address and gift note', async ({
    page,
    request,
  }) => {
    const email = shopper('order')
    const { redirectURL } = await startCheckout(request, {
      email,
      gift: true,
      giftNote: 'With love, from Doha.',
    })
    const landed = await payAndReturn(page, redirectURL)

    expect(landed.placed).toBe('1')
    expect(landed.token, 'the order link carries its access token').toMatch(/^[0-9a-f-]{36}$/)
    await expect(page.locator('h1')).toHaveText('Thank you, Test.')

    const order = await readOrder(request, landed.orderId)
    expect(order.amount).toBe(141900)
    expect(order.subtotalQar).toBe(139900)
    expect(order.shippingQar).toBe(2000)
    expect(order.shippingLabel).toBe('Delivery to Doha')
    expect(order.shippingZone).toBe('qatar')
    expect(order.personalisationTotalQar).toBe(0)
    expect(order.customerEmail).toBe(email)
    expect(order.gift).toBe(true)
    expect(order.giftNote).toBe('With love, from Doha.')
    expect(order.shippingAddress).toMatchObject({
      addressLine1: 'Building 12, Street 340',
      city: 'Doha',
      country: 'QA',
    })
  })

  test('carries embroidery instructions onto the order', async ({ page, request }) => {
    const started = await startCheckout(request, {
      email: shopper('embroidery'),
      personalisation: [{ lettering: 'AK', placement: 'pocket', style: 'text', thread: 'gold' }],
    })

    // QAR 1,399 + 160 embroidery + 20 delivery.
    expect((await skipcashPayment(request, started.paymentId)).amount).toBe('1579.00')

    const { orderId } = await payAndReturn(page, started.redirectURL)
    const order = await readOrder(request, orderId)
    expect(order.personalisationTotalQar).toBe(16000)

    // The atelier cannot work without this.
    const placement = order.items[0].personalisation[0]
    expect(placement.placementName).toBe('Pocket')
    expect(placement.lettering).toBe('AK')
    expect(placement.threadName).toBe('Gold')
  })

  /*
   * Stock (@/lib/pricing/stock, @/hooks/stockAfterSale). The plugin never
   * checked a sized product's stock and decremented it without a floor, so
   * size M reached −115 in testing. Each test sets the stock it needs and
   * puts both it and the product's switch back afterwards.
   */
  const setStock = async (request: APIRequestContext, variantId: number, inventory: number) => {
    const res = await request.patch(`${BASE}/api/variants/${variantId}`, {
      data: { inventory },
      headers: admin(),
    })
    expect(res.ok(), `setting stock failed: ${res.status()}`).toBe(true)
  }
  const setMadeToOrder = async (request: APIRequestContext, madeToOrder: boolean) => {
    const res = await request.patch(`${BASE}/api/products/1`, {
      data: { madeToOrder },
      headers: admin(),
    })
    expect(res.ok(), `setting made to order failed: ${res.status()}`).toBe(true)
  }

  test('decrements stock by the quantity ordered', async ({ page, request }) => {
    // From a known figure: other tests buy size M too, and stock now stops at zero.
    const before = await readStock(request, 2)
    await setStock(request, 2, 5)
    try {
      const { redirectURL } = await startCheckout(request, { email: shopper('stock'), quantity: 2 })
      await payAndReturn(page, redirectURL)
      expect(await readStock(request, 2)).toBe(3)
    } finally {
      await setStock(request, 2, before)
    }
  })

  test('made to order: a sale beyond stock goes through, stock stops at zero, the order is noted', async ({
    page,
    request,
  }) => {
    const before = await readStock(request, 2)
    await setMadeToOrder(request, true)
    await setStock(request, 2, 1)
    try {
      const { redirectURL } = await startCheckout(request, {
        email: shopper('beyond'),
        quantity: 2,
      })
      const { orderId } = await payAndReturn(page, redirectURL)

      expect(await readStock(request, 2), 'stock must never go below zero').toBe(0)
      const order = await readOrder(request, orderId)
      expect(order.adminNotes).toMatch(
        /Made to order — Al Shaheen Nights, size M: 1 beyond ready stock/,
      )
    } finally {
      await setStock(request, 2, before)
    }
  })

  test('not made to order: a sold-out size cannot reach the payment page', async ({ request }) => {
    const before = await readStock(request, 2)
    await setMadeToOrder(request, false)
    await setStock(request, 2, 0)
    try {
      const cart = (
        await (
          await request.post(`${BASE}/api/carts`, {
            data: {
              currency: 'QAR',
              items: [{ personalisation: [], product: 1, quantity: 1, variant: 2 }],
            },
          })
        ).json()
      ).doc
      const res = await request.post(`${BASE}/api/payments/skipcash/initiate`, {
        data: {
          cartID: cart.id,
          currency: 'QAR',
          customerEmail: shopper('soldout'),
          secret: cart.secret,
          shippingAddress: {
            addressLine1: 'x',
            city: 'Doha',
            country: 'QA',
            firstName: 'x',
            lastName: 'x',
            phone: '1234567',
          },
          shippingCityKey: 'doha',
        },
      })
      expect(res.ok(), 'a sold-out size opened a payment page').toBe(false)

      // The plugin replaces the adapter's reason with a generic error, so the
      // words the customer sees come from the quote checkout shows before Pay.
      const quote = await request.post(`${BASE}/api/quote`, {
        data: { city: 'doha', country: 'QA', items: [{ productId: 1, quantity: 1, variantId: 2 }] },
      })
      expect(quote.status()).toBe(400)
      expect((await quote.json()).error).toMatch(/size M is sold out/)
    } finally {
      await setStock(request, 2, before)
      await setMadeToOrder(request, true)
    }
  })

  test('redeems a discount code only once payment succeeds', async ({ page, request }) => {
    const code = `E2EPAID-${Date.now()}`
    const created = await request.post(`${BASE}/api/discountCodes`, {
      data: { active: true, code, perCustomerLimit: 1, type: 'percent', value: 10 },
      headers: admin(),
    })
    expect(created.ok(), `creating the code failed: ${created.status()}`).toBe(true)
    const codeId = (await created.json()).doc.id
    madeCodes.push(codeId)

    const email = shopper('discount')
    const started = await startCheckout(request, { discountCode: code, email })

    // 10% off QAR 1,399 goods; delivery untouched.
    // QAR 1,399 − 139.90 + 20.
    expect((await skipcashPayment(request, started.paymentId)).amount).toBe('1279.10')

    const usage = async () =>
      (
        await (
          await request.get(`${BASE}/api/discountCodes/${codeId}`, { headers: admin() })
        ).json()
      ).usageCount ?? 0

    // Opening the payment page must not consume the code.
    expect(await usage()).toBe(0)

    const { orderId } = await payAndReturn(page, started.redirectURL)
    const order = await readOrder(request, orderId)
    expect(order.discountTotalQar).toBe(13990)
    expect(order.discountCode).toBe(code)

    expect(await usage()).toBe(1)
    const uses = await (
      await request.get(`${BASE}/api/discountUses?where[code][equals]=${codeId}`, {
        headers: admin(),
      })
    ).json()
    expect(uses.totalDocs).toBe(1)
    // A guest's redemption is recorded against the address they checked out with.
    expect(uses.docs[0].email).toBe(email)
  })

  /**
   * Back from SkipCash without paying — its page's own back button, or a
   * closed card form. The return page asks SkipCash, hears "new", and sends
   * the customer back to checkout with nothing made.
   */
  test('coming back without paying leaves the bag and creates nothing', async ({
    page,
    request,
  }) => {
    const started = await startCheckout(request, { email: shopper('cancel') })

    await page.goto(`${BASE}/checkout/return?id=${started.paymentId}`)
    await page.waitForURL(/\/checkout\?payment=cancelled/, { timeout: 30_000 })

    const transactions = await (
      await request.get(
        `${BASE}/api/transactions?where[skipcash.paymentId][equals]=${started.paymentId}&depth=0`,
        { headers: admin() },
      )
    ).json()
    expect(transactions.docs[0].status).toBe('pending')
    expect(transactions.docs[0].order ?? null).toBeNull()
  })

  /**
   * The return address is public, so anyone can put anything in it. An id
   * SkipCash never issued, or "paid" typed into the address, must make
   * nothing — only SkipCash's own answer counts.
   */
  test('a made-up return address makes no order', async ({ page, request }) => {
    const email = shopper('forged')
    const started = await startCheckout(request, { email })

    await page.goto(`${BASE}/checkout/return?id=00000000-0000-4000-8000-000000000000&statusId=2`)
    await expect(page.locator('main h1')).toHaveText('We could not find that payment.')

    await page.goto(`${BASE}/checkout/return?id=${started.paymentId}&statusId=2&status=Paid`)
    await page.waitForURL(/\/checkout\?payment=cancelled/, { timeout: 30_000 })

    const orders = await (
      await request.get(`${BASE}/api/orders?where[customerEmail][equals]=${email}`, {
        headers: admin(),
      })
    ).json()
    expect(orders.totalDocs).toBe(0)
  })

  /**
   * A signed-in customer's order must settle as theirs — the plugin refuses
   * otherwise ("Guest transaction belongs to an authenticated customer"). The
   * return page settles as the customer the transaction belongs to.
   */
  test('a signed-in customer’s order settles as theirs', async ({ context, page, request }) => {
    const started = await startCheckout(request, { email: DEV_USER.email, headers: admin() })

    await context.addCookies([{ name: 'payload-token', url: BASE, value: token }])
    const { orderId } = await payAndReturn(page, started.redirectURL)

    const order = await readOrder(request, orderId)
    const me = await (await request.get(`${BASE}/api/users/me`, { headers: admin() })).json()
    expect(order.customer).toBe(me.user.id)
  })

  test('refuses to open a payment page for a blocked destination', async ({ request }) => {
    const cart = (
      await (
        await request.post(`${BASE}/api/carts`, {
          data: {
            currency: 'QAR',
            items: [{ personalisation: [], product: 1, quantity: 1, variant: 2 }],
          },
        })
      ).json()
    ).doc

    const blocked = (
      await (
        await request.get(`${BASE}/api/countries?where[blockedReason][exists]=true&limit=1`)
      ).json()
    ).docs[0]
    test.skip(!blocked, 'no blocked country seeded')

    const res = await request.post(`${BASE}/api/payments/skipcash/initiate`, {
      data: {
        cartID: cart.id,
        currency: 'QAR',
        customerEmail: shopper('blocked'),
        secret: cart.secret,
        shippingAddress: {
          addressLine1: 'x',
          city: 'x',
          country: blocked.code,
          firstName: 'x',
          lastName: 'x',
          phone: '1234567',
        },
      },
    })
    expect(res.ok()).toBe(false)
  })
})
