import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

/**
 * The admin trimmed to what she needs (BUILD-LOG §43), against the database:
 * a piece needs a photo to go live, a size is live when saved and seen only
 * when its piece is, Shipped needs a tracking number, and the customer page
 * shows orders but not the bag or address ids. Everything made here is
 * removed afterwards.
 */

let payload: Payload
const made: { orders: number[]; products: number[]; variants: number[] } = {
  orders: [],
  products: [],
  variants: [],
}
const quiet = { disableRevalidate: true }

const errorsOf = (e: unknown) =>
  ((e as { data?: { errors?: Array<{ message: string; path: string }> } }).data?.errors ?? []).map(
    (x) => `${x.path}: ${x.message}`,
  )

beforeAll(async () => {
  payload = await getPayload({ config: await config })
}, 120_000)

afterAll(async () => {
  for (const id of made.orders) {
    await payload.db.deleteOne({ collection: 'orders', where: { id: { equals: id } } })
  }
  for (const id of made.variants) {
    await payload.delete({ collection: 'variants', context: quiet, id, overrideAccess: true, trash: false })
  }
  for (const id of made.products) {
    await payload.delete({ collection: 'products', context: quiet, id, overrideAccess: true, trash: false })
  }
})

const aPhoto = async () =>
  (await payload.find({ collection: 'media', depth: 0, limit: 1 })).docs[0]?.id

describe('a piece needs a photo to go live', () => {
  it('refuses to publish without one, by name', async () => {
    const error = await payload
      .create({
        collection: 'products',
        context: quiet,
        data: { _status: 'published', slug: '', title: 'TESTONLY No Photo' },
        draft: false,
        overrideAccess: true,
      })
      .then(() => null)
      .catch((e) => e)
    expect(errorsOf(error)).toContain('gallery: Add at least one photo before publishing.')
  })

  it('saves a draft without one', async () => {
    const draft = await payload.create({
      collection: 'products',
      context: quiet,
      data: { _status: 'draft', title: 'TESTONLY Draft No Photo' },
      draft: true,
      overrideAccess: true,
    })
    made.products.push(draft.id)
    expect(draft._status).toBe('draft')
  })

  it('publishes with one, and makes the web address from the title', async () => {
    const image = await aPhoto()
    expect(image, 'the database has a photo').toBeDefined()
    const piece = await payload.create({
      collection: 'products',
      context: quiet,
      data: { _status: 'published', gallery: [{ image: image! }], slug: '', title: 'TESTONLY With Photo' },
      draft: false,
      overrideAccess: true,
    })
    made.products.push(piece.id)
    expect(piece.slug).toBe('testonly-with-photo')
  })
})

describe('sizes', () => {
  it('have no drafts: saved means live, shown only while the piece is published', async () => {
    const image = await aPhoto()
    expect(image, 'the database has a photo').toBeDefined()
    const size = (
      await payload.find({ collection: 'variantOptions', depth: 0, limit: 1, where: { label: { equals: 'S' } } })
    ).docs[0]
    const sizeType = (
      await payload.find({ collection: 'variantTypes', depth: 0, limit: 1, where: { label: { equals: 'Size' } } })
    ).docs[0]
    expect(size && sizeType, 'the seed has Size → S').toBeTruthy()

    const piece = await payload.create({
      collection: 'products',
      context: quiet,
      data: {
        _status: 'published',
        enableVariants: true,
        gallery: [{ image: image! }],
        slug: '',
        title: 'TESTONLY Sizes',
        variantTypes: [sizeType!.id],
      },
      draft: false,
      overrideAccess: true,
    })
    made.products.push(piece.id)
    const variant = await payload.create({
      collection: 'variants',
      context: quiet,
      data: { inventory: 3, options: [size!.id], product: piece.id },
      overrideAccess: true,
    })
    made.variants.push(variant.id)
    expect('_status' in variant).toBe(false)

    const publicSizes = () =>
      payload.find({
        collection: 'variants',
        depth: 0,
        overrideAccess: false,
        where: { product: { equals: piece.id } },
      })
    expect((await publicSizes()).totalDocs).toBe(1)

    await payload.update({
      collection: 'products',
      context: quiet,
      data: { _status: 'draft' },
      id: piece.id,
      overrideAccess: true,
    })
    expect((await publicSizes()).totalDocs).toBe(0)
  })
})

describe('an order marked Shipped needs a tracking number', () => {
  let orderId: number

  beforeAll(async () => {
    const order = await payload.db.create({
      collection: 'orders',
      data: { amount: 1000, currency: 'QAR', customerEmail: 'testonly@plumpose.local', fulfilment: 'unfulfilled' },
    })
    orderId = order.id as number
    made.orders.push(orderId)
  })

  it('refuses Shipped with none', async () => {
    const error = await payload
      .update({ collection: 'orders', context: quiet, data: { fulfilment: 'shipped' }, id: orderId, overrideAccess: true })
      .then(() => null)
      .catch((e) => e)
    expect(errorsOf(error).join()).toMatch(/fulfilment: Add the tracking number/)
  })

  it('takes Shipped with one, and lets a shipped order be edited afterwards', async () => {
    await payload.update({
      collection: 'orders',
      context: quiet,
      data: { fulfilment: 'shipped', trackingNumber: 'TESTONLY-1' },
      id: orderId,
      overrideAccess: true,
    })
    await payload.db.updateOne({ collection: 'orders', data: { trackingNumber: null }, id: orderId })
    const edited = await payload.update({
      collection: 'orders',
      context: quiet,
      data: { adminNotes: 'shipped before the rule' },
      id: orderId,
      overrideAccess: true,
    })
    expect(edited.fulfilment).toBe('shipped')
  })
})

describe('the customer page', () => {
  it('shows orders by amount and fulfilment; the bag and addresses stay for the shop only', async () => {
    const users = (await config).collections.find((c) => c.slug === 'users')!
    const field = (name: string) =>
      users.fields.find((f) => 'name' in f && f.name === name) as {
        admin?: { defaultColumns?: string[]; disabled?: boolean }
      }
    expect(field('orders').admin?.defaultColumns).toEqual(['id', 'createdAt', 'amount', 'fulfilment'])
    expect(field('cart').admin?.disabled).toBe(true)
    expect(field('addresses').admin?.disabled).toBe(true)
  })
})
