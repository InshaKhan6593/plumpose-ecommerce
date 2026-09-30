import type { Order } from '@/payload-types'
import type { Payload, PayloadRequest } from 'payload'

import { createLocalReq, getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { QBAS_ZONES, qbasZone, zoneLabel } from '@/data/qbasZones'
import { applyCourierStatus } from '@/delivery/qbas/apply'
import { qbasConfig, qbasMissing } from '@/delivery/qbas/config'
import {
  orderCourierEndpoints,
  qbasCheckEndpoint,
  qbasWebhookEndpoint,
} from '@/delivery/qbas/endpoints'
import {
  bookingProblems,
  courierStatus,
  qbasPhone,
  shipmentRequest,
} from '@/delivery/qbas/protocol'
import { courierAlert } from '@/email/courierAlert'
import { toOrderView } from '@/email/orderEmails'
import { deliveryFor } from '@/lib/pricing/shipping'
import { readCheckoutDetails } from '@/payments/checkout'
import { orderTotalsFromSnapshot } from '@/payments/finaliseOrder'

/**
 * QBAS, the Qatar courier (BUILD-LOG §69). QBAS itself is never called:
 * `fetch` is replaced, and email is off so no alert reaches a real inbox.
 */

const ENV = {
  CRON_SECRET: 'test-cron-secret-0123456789',
  QBAS_EMAIL: 'shop@example.test',
  QBAS_PASSWORD: 'not-a-real-password',
  QBAS_SENDER_ADDRESS: 'Building 1, Street 1, Zone 51',
  QBAS_SENDER_PHONE: '+974 5555 0000',
  QBAS_SENDER_ZONE_ID: '570481',
  QBAS_VEHICLE_TYPE_ID: '',
  QBAS_WEBHOOK_SECRET: 'test-webhook-secret-0123456789',
  RESEND_API_KEY: '',
}
const saved: Record<string, string | undefined> = {}
for (const [key, value] of Object.entries(ENV)) {
  saved[key] = process.env[key]
  process.env[key] = value
}

const AL_SAAD = 570561

/* ------------------------------------------------------------ pure parts -- */

describe('the zone list', () => {
  it('has every QBAS zone once, by the id QBAS books with', () => {
    expect(QBAS_ZONES.length).toBe(161)
    expect(new Set(QBAS_ZONES.map((z) => z.id)).size).toBe(161)
    expect(qbasZone(570481)).toMatchObject({ name: 'Al Gharrafa', zone: 51 })
    expect(qbasZone('570561')).toMatchObject({ name: 'Al Saad', zone: 38 })
    expect(qbasZone(1)).toBeUndefined()
  })

  it('reads as the blue plate does', () => {
    expect(zoneLabel(qbasZone(AL_SAAD)!)).toBe('Zone 38 · Al Saad')
    expect(zoneLabel(qbasZone(570581)!)).toBe('Zone 50')
    expect(qbasZone(570528)).toMatchObject({ name: 'Al Wakrah', zone: 90 })
  })
})

describe('phones for the driver', () => {
  it('sends a Qatari number as its 8 digits, others with their code', () => {
    expect(qbasPhone('33501133')).toBe('33501133')
    expect(qbasPhone('+974 3350 1133')).toBe('33501133')
    expect(qbasPhone('00974 3350 1133')).toBe('33501133')
    expect(qbasPhone('97433501133')).toBe('33501133')
    expect(qbasPhone('+44 7700 900123')).toBe('+447700900123')
    expect(qbasPhone('')).toBe('')
  })
})

describe('what each QBAS status means', () => {
  it('maps the documented codes to a stage and plain words', () => {
    expect(courierStatus('SCANNED_BY_DRIVER_AND_IN_CAR')).toMatchObject({
      customer: 'Collected by the courier',
      stage: 'withCourier',
    })
    expect(courierStatus('out_for_delivery').stage).toBe('outForDelivery')
    expect(courierStatus('DELIVERED_TO_RECIPIENT').stage).toBe('delivered')
    expect(courierStatus('FAILED').stage).toBe('attention')
    expect(courierStatus('LOST').customer).toBe('Delayed — we are looking into it')
  })

  it('shows an unknown code as written, and moves nothing', () => {
    expect(courierStatus('SOMETHING_NEW')).toMatchObject({ admin: 'Something new', stage: 'booked' })
  })
})

describe('the booking request', () => {
  const order = {
    amount: 141900,
    id: 12,
    reference: 'PLM-261001-ABCDEF',
    shippingAddress: {
      addressLine1: 'Building 885, Street 9',
      addressLine2: 'Flat 4',
      country: 'QA',
      firstName: 'Mariam',
      lastName: 'Al-Thani',
      phone: '+974 3350 1133',
    },
  } as unknown as Order

  it('is prepaid, to the chosen zone, from her pickup, under the order code', () => {
    const body = shipmentRequest(order, { id: AL_SAAD }, qbasConfig()) as Record<string, any>
    expect(body.email).toBe(ENV.QBAS_EMAIL)
    expect(body.pkgUnitType).toBe('METRIC')
    expect(body.pkg).toMatchObject({
      cod: 0,
      declaredValue: 1419,
      invoiceNumber: 'PLM-261001-ABCDEF',
      receiverName: 'Mariam Al-Thani',
      receiverPhone: '33501133',
      senderPhone: '55550000',
      serviceTypeId: 281,
      shipmentType: 'REGULAR',
    })
    expect(body.pkg.vehicleTypeId).toBeUndefined()
    expect(body.destinationAddress).toEqual({
      addressLine1: 'Building 885, Street 9, Flat 4',
      addressLine2: 'Flat 4',
      cityId: AL_SAAD,
    })
    expect(body.originAddress).toEqual({ addressLine1: ENV.QBAS_SENDER_ADDRESS, cityId: 570481 })
  })

  it('refuses what QBAS cannot deliver', () => {
    expect(bookingProblems({ shippingAddress: { ...order.shippingAddress, country: 'GB' } } as Order)).toContain(
      'QBAS delivers within Qatar only.',
    )
    expect(bookingProblems({ ...order, fulfilment: 'refunded' } as Order)).toContain('This order is closed.')
    expect(bookingProblems(order)).toEqual([])
  })

  it('knows when it is not connected', () => {
    expect(qbasMissing()).toEqual([])
    expect(qbasMissing({ ...qbasConfig(), password: '' })).toEqual(['the QBAS login'])
  })
})

describe('Qatar only, for now', () => {
  const tables = {
    cities: [],
    countries: [{ code: 'GB', name: 'United Kingdom', zoneKey: 'europe' }],
    zones: [
      { active: false, feeQar: 200, key: 'europe', name: 'Europe' },
      { active: false, feeQar: 150, key: 'gcc', name: 'GCC' },
    ],
  } as never

  it('says so for a country whose zone is switched off', () => {
    const result = deliveryFor({ countryCode: 'GB' }, tables, {})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal.reason).toBe('notDelivering')
    expect(result.refusal.message).toMatch(/^We are delivering within Qatar only for now\. For United Kingdom/)
  })

  it('says "not at the moment" when other zones are still on', () => {
    const some = {
      ...(tables as object),
      zones: [
        { active: false, feeQar: 200, key: 'europe', name: 'Europe' },
        { active: true, feeQar: 150, key: 'gcc', name: 'GCC' },
      ],
    } as never
    const result = deliveryFor({ countryCode: 'GB' }, some, {})
    expect(!result.ok && result.refusal.message).toMatch(/^We are not delivering to United Kingdom at the moment/)
  })
})

describe('the zone through checkout', () => {
  it('keeps a real zone for Qatar and drops anything else', () => {
    const qa = { shippingAddress: { country: 'qa' }, shippingZoneId: AL_SAAD }
    expect(readCheckoutDetails(qa).zoneId).toBe(AL_SAAD)
    expect(readCheckoutDetails({ ...qa, shippingZoneId: 42 }).zoneId).toBeNull()
    expect(readCheckoutDetails({ shippingAddress: { country: 'GB' }, shippingZoneId: AL_SAAD }).zoneId).toBeNull()
  })

  it('lands on the order', () => {
    const snapshot = {
      delivery: { address: { country: 'QA' }, gift: false, giftNote: '', zoneId: AL_SAAD },
      total: 1,
    }
    expect(orderTotalsFromSnapshot(snapshot)).toMatchObject({ deliveryZone: AL_SAAD })
  })

  it('is in every order email’s address', () => {
    const view = toOrderView(
      {
        deliveryZone: AL_SAAD,
        id: 1,
        items: [],
        shippingAddress: { addressLine1: '885', addressLine2: 'Flat 4', city: 'Doha', country: 'QA' },
      } as unknown as Order,
      { adminUrl: '', footer: {} as never, leadTime: '', orderUrl: '' },
    )
    expect(view.address).toContain('Zone 38 · Al Saad')
    expect(view.address).toContain('Apartment, floor: Flat 4')
  })
})

describe('her alert', () => {
  it('names the order, the problem and the customer', () => {
    const email = courierAlert({
      adminUrl: 'https://plumpose.com/admin/collections/orders/1',
      code: 'FAILED',
      customerName: 'Mariam',
      notes: 'Phone off',
      orderCode: 'PLM-261001-ABCDEF',
      phone: '+974 3350 1133',
      status: 'Delivery failed',
      zone: 'Zone 38 · Al Saad',
    })
    expect(email.subject).toBe('Delivery delivery failed — PLM-261001-ABCDEF')
    expect(email.text).toContain('QBAS note: Phone off')
    expect(email.html).toContain('Zone 38 · Al Saad')
  })
})

/* ------------------------------------------------------- the database ---- */

describe('against the database', () => {
  let payload: Payload
  const made: number[] = []
  const admin = { collection: 'users', email: 'testonly-admin@plumpose.local', id: 1, roles: ['admin'] } as never
  const endpoint = (path: string) => orderCourierEndpoints.find((e) => e.path === path)!

  /** QBAS, pretended: remembers each call and answers as the documentation says. */
  let calls: Array<{ body: unknown; method: string; url: string }> = []
  let statusAnswer = 'PENDING_CUSTOMER_CARE_APPROVAL'
  const fakeFetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    // Anything else (Payload's own telemetry) is not QBAS: answered, not recorded.
    if (!String(url).includes('logestechs.com')) return new Response(null, { status: 204 })
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ body, method: init.method ?? 'GET', url })
    const reply = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }, status })
    if (url.includes('/ship/request/by-email'))
      return reply({ barcode: `QBS${calls.length}00012345`, cost: 15, id: 4242 + calls.length })
    if (url.includes('/packages/status')) return reply({ cost: 15, notes: '', status: statusAnswer })
    if (url.includes('/packages/pdf')) return reply({ url: 'https://labels.example.test/awb.pdf' })
    if (url.includes('/packages/cancel')) return reply({})
    return reply({ message: 'not found' }, 404)
  })

  const call = async (
    handler: (req: PayloadRequest) => Promise<Response> | Response,
    opts: { body?: unknown; headers?: Record<string, string>; id?: number; query?: string; user?: unknown } = {},
  ) => {
    const req = await createLocalReq(
      { req: { headers: new Headers(opts.headers ?? {}) } as never, user: (opts.user ?? admin) as never },
      payload,
    )
    req.routeParams = opts.id ? { id: String(opts.id) } : {}
    req.json = async () => opts.body ?? {}
    // Read-only on the type; the handlers read it, as they do from a real request.
    Object.defineProperty(req, 'searchParams', { value: new URLSearchParams(opts.query ?? '') })
    const res = await handler(req)
    return { body: (await res.json()) as Record<string, any>, status: res.status }
  }

  const newOrder = async (over: Record<string, unknown> = {}): Promise<Order> => {
    const order = (await payload.create({
      collection: 'orders',
      context: { skipOrderEmails: true },
      data: {
        amount: 141900,
        currency: 'QAR',
        customerEmail: 'testonly@plumpose.local',
        deliveryZone: AL_SAAD,
        shippingAddress: {
          addressLine1: 'Building 885, Street 9',
          city: 'Doha',
          country: 'QA',
          firstName: 'Test',
          lastName: 'Only',
          phone: '33501133',
        },
        ...over,
      } as never,
      overrideAccess: true,
    })) as Order
    made.push(order.id)
    return order
  }

  const reload = async (id: number) =>
    (await payload.findByID({ collection: 'orders', depth: 0, id, overrideAccess: true })) as Order

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    vi.stubGlobal('fetch', fakeFetch)
  }, 120_000)

  beforeEach(() => {
    calls = []
    statusAnswer = 'PENDING_CUSTOMER_CARE_APPROVAL'
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    for (const id of made) await payload.db.deleteOne({ collection: 'orders', where: { id: { equals: id } } })
    await payload.db.deleteMany({ collection: 'webhookLog', where: { event: { like: 'qbas.' } } })
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('Send to QBAS books the pickup and fills in the tracking number', async () => {
    const order = await newOrder()
    const { body, status } = await call(endpoint('/:id/courier/book').handler, { id: order.id })
    expect(status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://apisv2.logestechs.com/api/ship/request/by-email')
    expect((calls[0].body as any).destinationAddress.cityId).toBe(AL_SAAD)
    expect(body.booked).toBe(true)

    const after = await reload(order.id)
    expect(after.courier?.barcode).toMatch(/^QBS/)
    expect(after.trackingNumber).toBe(after.courier?.barcode)
    expect(after.courier?.status).toBe('PENDING_CUSTOMER_CARE_APPROVAL')
    expect(after.courier?.events?.map((e) => e.code)).toEqual(['PENDING_CUSTOMER_CARE_APPROVAL'])
    expect(after.fulfilment ?? 'unfulfilled').toBe('unfulfilled')

    // Twice is refused: one parcel, one booking.
    const again = await call(endpoint('/:id/courier/book').handler, { id: order.id })
    expect(again.status).toBe(409)
    expect(calls).toHaveLength(1)
  })

  it('needs a zone, and Qatar, and staff', async () => {
    const noZone = await newOrder({ deliveryZone: null })
    expect((await call(endpoint('/:id/courier/book').handler, { id: noZone.id })).status).toBe(422)

    const abroad = await newOrder({
      shippingAddress: { addressLine1: '1 High St', country: 'GB', firstName: 'A', phone: '+447700900123' },
    })
    const refused = await call(endpoint('/:id/courier/book').handler, { id: abroad.id })
    expect(refused.status).toBe(422)
    expect(refused.body.message).toContain('within Qatar only')

    const customer = { collection: 'users', id: 99, roles: ['customer'] }
    expect((await call(endpoint('/:id/courier/book').handler, { id: noZone.id, user: customer })).status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('the parcel moves the order forward, never back, and says each step once', async () => {
    const order = await newOrder({ courier: { barcode: 'QBSMOVE1' }, trackingNumber: 'QBSMOVE1' })
    let current = await reload(order.id)
    for (const code of [
      'PENDING_CUSTOMER_CARE_APPROVAL',
      'SCANNED_BY_DRIVER_AND_IN_CAR',
      'SCANNED_BY_DRIVER_AND_IN_CAR',
      'OUT_FOR_DELIVERY',
    ]) {
      current = (await applyCourierStatus(payload, current, { code })).order
    }
    expect(current.fulfilment).toBe('shipped')
    expect(current.courier?.events?.map((e) => e.code)).toEqual([
      'PENDING_CUSTOMER_CARE_APPROVAL',
      'SCANNED_BY_DRIVER_AND_IN_CAR',
      'OUT_FOR_DELIVERY',
    ])

    current = (await applyCourierStatus(payload, current, { code: 'DELIVERED_TO_RECIPIENT' })).order
    expect(current.fulfilment).toBe('delivered')
    current = (await applyCourierStatus(payload, current, { code: 'OUT_FOR_DELIVERY' })).order
    expect(current.fulfilment).toBe('delivered')
  })

  it('never reopens a closed order', async () => {
    const order = await newOrder({ courier: { barcode: 'QBSCLOSED' }, fulfilment: 'refunded' })
    const { order: after } = await applyCourierStatus(payload, await reload(order.id), {
      code: 'DELIVERED_TO_RECIPIENT',
    })
    expect(after.fulfilment).toBe('refunded')
  })

  it('a problem is recorded once, and marked as alerted', async () => {
    const order = await newOrder({ courier: { barcode: 'QBSFAIL1' } })
    let current = await reload(order.id)
    current = (await applyCourierStatus(payload, current, { code: 'FAILED', notes: 'Phone off' })).order
    current = (await applyCourierStatus(payload, current, { code: 'FAILED', notes: 'Phone off' })).order
    expect(current.courier?.events).toHaveLength(1)
    expect(current.courier?.alertedStatus).toBe('FAILED')
  })

  it('label, check and cancel', async () => {
    const order = await newOrder()
    await call(endpoint('/:id/courier/book').handler, { id: order.id })
    const barcode = (await reload(order.id)).courier!.barcode!

    const label = await call(endpoint('/:id/courier/label').handler, { id: order.id })
    expect(label.body.url).toBe('https://labels.example.test/awb.pdf')
    expect(calls.at(-1)!.url).toBe('https://apisv2.logestechs.com/api/guests/553/packages/pdf')

    statusAnswer = 'ACCEPTED_BY_DRIVER_AND_PENDING_PICKUP'
    const checked = await call(endpoint('/:id/courier/check').handler, { id: order.id })
    expect(checked.body.status.code).toBe('ACCEPTED_BY_DRIVER_AND_PENDING_PICKUP')
    expect(calls.at(-1)!.url).toContain(`/guests/packages/status?barcode=${barcode}`)

    const cancelled = await call(endpoint('/:id/courier/cancel').handler, { id: order.id })
    expect(cancelled.status).toBe(200)
    expect(calls.at(-1)).toMatchObject({ method: 'PUT' })
    expect(calls.at(-1)!.url).toContain(`/guests/553/packages/cancel?barcode=${barcode}`)
    const after = await reload(order.id)
    expect(after.courier?.status).toBe('CANCELLED')
    expect(after.trackingNumber ?? null).toBeNull()

    // A cancelled booking can be sent again.
    expect((await call(endpoint('/:id/courier/book').handler, { id: order.id })).status).toBe(200)
  })

  it('cancelling after QBAS said "picked up" takes the order back to the atelier', async () => {
    const order = await newOrder()
    await call(endpoint('/:id/courier/book').handler, { id: order.id })
    statusAnswer = 'SCANNED_BY_DRIVER_AND_IN_CAR'
    await call(endpoint('/:id/courier/check').handler, { id: order.id })
    expect((await reload(order.id)).fulfilment).toBe('shipped')

    await call(endpoint('/:id/courier/cancel').handler, { id: order.id })
    const after = await reload(order.id)
    expect(after.courier?.status).toBe('CANCELLED')
    expect(after.fulfilment).toBe('inAtelier')
    expect(after.trackingNumber ?? null).toBeNull()
  })

  it('the webhook needs its secret, and is logged either way', async () => {
    const order = await newOrder({ courier: { barcode: 'QBSHOOK1' }, trackingNumber: 'QBSHOOK1' })
    const body = { barcode: 'QBSHOOK1', invoiceNumber: 'x', newStatus: 'OUT_FOR_DELIVERY', time: Date.now() }

    expect((await call(qbasWebhookEndpoint.handler, { body, query: 'key=wrong', user: null })).status).toBe(401)
    expect((await reload(order.id)).courier?.status ?? null).toBeNull()

    statusAnswer = 'OUT_FOR_DELIVERY'
    const ok = await call(qbasWebhookEndpoint.handler, {
      body,
      query: `key=${ENV.QBAS_WEBHOOK_SECRET}`,
      user: null,
    })
    expect(ok.status).toBe(200)
    const after = await reload(order.id)
    expect(after.courier?.status).toBe('OUT_FOR_DELIVERY')
    expect(after.fulfilment).toBe('shipped')

    const logged = await payload.find({
      collection: 'webhookLog',
      where: { paymentId: { equals: 'QBSHOOK1' } },
    })
    expect(logged.docs.map((d) => d.signatureValid).sort()).toEqual([false, true])
  })

  it('the webhook trusts QBAS’s own answer over the claim', async () => {
    const order = await newOrder({ courier: { barcode: 'QBSHOOK2' }, trackingNumber: 'QBSHOOK2' })
    statusAnswer = 'IN_HUB'
    await call(qbasWebhookEndpoint.handler, {
      body: { barcode: 'QBSHOOK2', newStatus: 'DELIVERED_TO_RECIPIENT' },
      query: `key=${ENV.QBAS_WEBHOOK_SECRET}`,
      user: null,
    })
    expect((await reload(order.id)).courier?.status).toBe('IN_HUB')
  })

  it('the half-hourly check runs only for the scheduler, and skips finished parcels', async () => {
    expect((await call(qbasCheckEndpoint.handler, { user: null })).status).toBe(403)

    const open = await newOrder({ courier: { barcode: 'QBSCRON1', status: 'PENDING_CUSTOMER_CARE_APPROVAL' } })
    await newOrder({ courier: { barcode: 'QBSCRON2', status: 'DELIVERED_TO_RECIPIENT' } })
    statusAnswer = 'SCANNED_BY_DRIVER_AND_IN_CAR'
    const run = await call(qbasCheckEndpoint.handler, {
      headers: { authorization: `Bearer ${ENV.CRON_SECRET}` },
      user: null,
    })
    expect(run.status).toBe(200)
    const asked = calls.filter((c) => c.url.includes('/packages/status')).map((c) => c.url)
    expect(asked.some((u) => u.includes('QBSCRON1'))).toBe(true)
    expect(asked.some((u) => u.includes('QBSCRON2'))).toBe(false)
    expect((await reload(open.id)).courier?.status).toBe('SCANNED_BY_DRIVER_AND_IN_CAR')
  })
})
