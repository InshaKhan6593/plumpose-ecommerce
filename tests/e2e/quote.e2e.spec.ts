import type { APIRequestContext } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { BASE } from '../helpers/base'

/**
 * `POST /api/quote` over real HTTP.
 *
 * The pricing engine is covered by unit and database tests; this covers the
 * layer above it — the part that decides which records a request is allowed to
 * price, and which of the browser's claims to ignore.
 *
 * Most of these are **tampering** cases. They are written as tests rather than
 * left to code review because "the server re-prices everything" is the single
 * guarantee the checkout rests on, and it is the kind of guarantee that quietly
 * stops being true during a refactor.
 */

const PREFIX = 'E2EONLY-'

/** The local development fixture, seeded by `pnpm seed`. */
const DEV_USER = { email: 'dev@plumpose.local', password: 'devpassword' }

const quote = async (request: APIRequestContext, body: unknown) => {
  const response = await request.post(`${BASE}/api/quote`, { data: body })
  return { body: await response.json(), status: response.status() }
}

const doha = { city: 'doha', country: 'QA' }

test.describe('POST /api/quote', () => {
  test('prices a real bag', async ({ request }) => {
    const { body, status } = await quote(request, {
      ...doha,
      items: [{ productId: 1, quantity: 1, variantId: 2 }],
    })

    expect(status).toBe(200)
    // QAR 1,399 + QAR 20 delivery to Doha.
    expect(body.totalsInQar).toMatchObject({ shipping: 20, subtotal: 1399, total: 1419 })
    expect(body.totals.shippingLabel).toBe('Delivery to Doha')
  })

  test('charges embroidery per placement, per garment', async ({ request }) => {
    const { body } = await quote(request, {
      ...doha,
      items: [
        {
          personalisation: [
            { lettering: 'AK', placement: 'pocket', style: 'text', thread: 'gold' },
            { placement: 'cuff', style: 'symbol', symbol: 'star' },
          ],
          productId: 1,
          quantity: 2,
          variantId: 2,
        },
      ],
    })

    // 2 placements x QAR 160 x 2 garments.
    expect(body.totalsInQar.personalisation).toBe(640)
    expect(body.lines[0].personalisation).toHaveLength(2)
  })

  test('prices an international address from its zone', async ({ request }) => {
    const { body } = await quote(request, {
      country: 'AE',
      items: [{ productId: 1, quantity: 1 }],
    })
    expect(body.totalsInQar.shipping).toBe(150)
  })

  test('refuses a blocked country with the reason, not a bare error', async ({ request }) => {
    const { body, status } = await quote(request, {
      country: 'AF',
      items: [{ productId: 1, quantity: 1 }],
    })

    expect(status).toBe(403)
    expect(body.blocked).toBe(true)
    expect(body.reason).toBe('blockedCountry')
    expect(body.error).toContain('Afghanistan')
  })

  test('will not guess a Qatar city', async ({ request }) => {
    const { body, status } = await quote(request, {
      country: 'QA',
      items: [{ productId: 1, quantity: 1 }],
    })
    expect(status).toBe(400)
    expect(body.reason).toBe('unknownCity')
  })

  test.describe('ignores what the browser claims', () => {
    test('a price sent by the client', async ({ request }) => {
      const { body } = await quote(request, {
        ...doha,
        items: [
          { priceInQAR: 1, productId: 1, quantity: 1, subtotal: 1, unitPrice: 1, variantId: 2 },
        ],
      })
      // Re-priced from the database, not from the request.
      expect(body.totalsInQar.total).toBe(1419)
    })

    test('a personalisation placement we do not offer', async ({ request }) => {
      const { body } = await quote(request, {
        ...doha,
        items: [
          {
            personalisation: [
              { lettering: 'HACK', placement: 'sleeve', style: 'text' },
              { lettering: 'AK', placement: 'pocket', style: 'text' },
            ],
            productId: 1,
            quantity: 1,
          },
        ],
      })

      expect(body.lines[0].personalisation).toHaveLength(1)
      expect(body.lines[0].personalisation[0].placement).toBe('pocket')
      expect(body.totalsInQar.personalisation).toBe(160)
    })

    test('lettering that cannot be embroidered', async ({ request }) => {
      const { body } = await quote(request, {
        ...doha,
        items: [
          {
            personalisation: [
              { lettering: 'A\u{1F642}B\u{1F480}', placement: 'pocket', style: 'text' },
            ],
            productId: 1,
            quantity: 1,
          },
        ],
      })
      expect(body.lines[0].personalisation[0].lettering).toBe('AB')
    })

    test('a variant that is not on this product', async ({ request }) => {
      const { body } = await quote(request, {
        ...doha,
        items: [{ productId: 1, quantity: 1, variantId: 9999 }],
      })
      expect(body.lines[0].variantId).toBeUndefined()
      expect(body.totalsInQar.total).toBe(1419)
    })

    test('a negative quantity', async ({ request }) => {
      const { body } = await quote(request, {
        ...doha,
        items: [{ productId: 1, quantity: -5 }],
      })
      expect(body.lines[0].quantity).toBe(1)
    })

    test('an enormous quantity', async ({ request }) => {
      const { body } = await quote(request, {
        ...doha,
        items: [{ productId: 1, quantity: 100000 }],
      })
      // Capped at MAX_QUANTITY rather than quoting a six-figure order.
      expect(body.lines[0].quantity).toBe(10)
    })

    test('a product that does not exist', async ({ request }) => {
      const { body, status } = await quote(request, {
        ...doha,
        items: [{ productId: 99999, quantity: 1 }],
      })
      expect(status).toBe(400)
      expect(body.error).toContain('available')
    })
  })

  test('rejects an empty bag', async ({ request }) => {
    const { status } = await quote(request, { ...doha, items: [] })
    expect(status).toBe(400)
  })

  test.describe('discount codes', () => {
    let token: string
    let codeId: number
    const codeText = `${PREFIX}TENOFF`

    test.beforeAll(async ({ request }) => {
      const login = await request.post(`${BASE}/api/users/login`, { data: DEV_USER })
      token = (await login.json()).token

      const created = await request.post(`${BASE}/api/discountCodes`, {
        data: {
          active: true,
          code: codeText,
          perCustomerLimit: 1,
          type: 'percent',
          value: 10,
        },
        headers: { Authorization: `JWT ${token}` },
      })
      codeId = (await created.json()).doc?.id
    })

    test.afterAll(async ({ request }) => {
      if (!codeId) return
      await request.delete(`${BASE}/api/discountCodes/${codeId}`, {
        headers: { Authorization: `JWT ${token}` },
      })
    })

    test('applies a valid code to goods but not to delivery', async ({ request }) => {
      const { body } = await quote(request, {
        ...doha,
        discountCode: codeText,
        email: 'shopper@plumpose.local',
        items: [{ productId: 1, quantity: 1 }],
      })

      expect(body.discountError).toBeNull()
      expect(body.totalsInQar.discount).toBe(139.9)
      expect(body.totalsInQar.shipping).toBe(20)
      expect(body.totalsInQar.total).toBe(1399 - 139.9 + 20)
    })

    test('matches a code however the customer types it', async ({ request }) => {
      const { body } = await quote(request, {
        ...doha,
        discountCode: `  ${codeText.toLowerCase()}  `,
        email: 'shopper@plumpose.local',
        items: [{ productId: 1, quantity: 1 }],
      })
      expect(body.discountError).toBeNull()
      expect(body.totalsInQar.discount).toBeGreaterThan(0)
    })

    test('still prices the bag when the code is wrong', async ({ request }) => {
      const { body, status } = await quote(request, {
        ...doha,
        discountCode: 'DEFINITELYNOTREAL',
        items: [{ productId: 1, quantity: 1 }],
      })

      expect(status).toBe(200)
      expect(body.discountError).toBe('That code is not valid.')
      expect(body.totalsInQar.total).toBe(1419)
    })

    test('quoting a code never consumes it', async ({ request }) => {
      for (let i = 0; i < 3; i++) {
        await quote(request, {
          ...doha,
          discountCode: codeText,
          email: 'shopper@plumpose.local',
          items: [{ productId: 1, quantity: 1 }],
        })
      }

      const reloaded = await request.get(`${BASE}/api/discountCodes/${codeId}`, {
        headers: { Authorization: `JWT ${token}` },
      })
      // A quote is not a redemption — this is what protects a one-per-customer prize.
      expect((await reloaded.json()).usageCount ?? 0).toBe(0)
    })
  })
})
