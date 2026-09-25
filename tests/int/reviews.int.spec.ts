import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { averageRating } from '@/components/product/Stars'

/**
 * Reviews (REQUIREMENTS S18, A15), against the database, sent the way the
 * product page's form sends them — as the public, with no admin rights
 * (`overrideAccess: false`, no user). Everything made here is removed.
 */

const EMAIL = 'e2eonly-reviewer@plumpose.local'
let payload: Payload
let productId: number
const reviews: number[] = []
const orders: number[] = []

const asPublic = (data: Record<string, unknown>) =>
  payload.create({ collection: 'reviews', data: { product: productId, ...data } as never, overrideAccess: false }).then((doc) => {
    reviews.push(doc.id)
    return doc
  })

const errorsOf = async (promise: Promise<unknown>): Promise<Record<string, string>> => {
  try {
    await promise
    return {}
  } catch (error) {
    const list = (error as { data?: { errors?: Array<{ message: string; path: string }> } }).data?.errors ?? []
    return Object.fromEntries(list.map((e) => [e.path, e.message]))
  }
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const product = (await payload.find({ collection: 'products', limit: 1, where: { slug: { equals: 'al-shaheen-nights' } } })).docs[0]
  productId = product.id
}, 120_000)

afterAll(async () => {
  for (const id of reviews) await payload.delete({ collection: 'reviews', id, overrideAccess: true }).catch(() => undefined)
  // Trashed rows too — `trash: true` keeps them otherwise.
  await payload.delete({ collection: 'reviews', overrideAccess: true, trash: true, where: { email: { like: 'e2eonly-' } } }).catch(() => undefined)
  for (const id of orders) await payload.db.deleteOne({ collection: 'orders', where: { id: { equals: id } } }).catch(() => undefined)
})

describe('reviews — sent by the public', () => {
  it('always arrives pending, whatever the request claims', async () => {
    const doc = await asPublic({ body: 'Softest thing I own. Worth every riyal.', email: EMAIL, featured: true, name: 'Mariam', rating: 5, reply: 'Thank you!', status: 'approved', verifiedPurchase: true })
    const saved = await payload.findByID({ collection: 'reviews', id: doc.id, overrideAccess: true })
    expect(saved.status).toBe('pending')
    expect(saved.featured).toBe(false)
    expect(saved.reply ?? null).toBeNull()
    // No order for this email, so the "verified" claim is the server's to make, and it is false.
    expect(saved.verifiedPurchase).toBe(false)
  })

  it('is invisible to the public until approved', async () => {
    const seen = await payload.find({ collection: 'reviews', overrideAccess: false, where: { id: { equals: reviews[0] } } })
    expect(seen.totalDocs).toBe(0)
    // Nor can the public search reviews by email: that field is admin-only.
    await expect(payload.find({ collection: 'reviews', overrideAccess: false, where: { email: { equals: EMAIL } } })).rejects.toThrow(/cannot be queried: email/)
  })

  it('checks the rating, the words and the name on the server', async () => {
    expect(await errorsOf(asPublic({ body: 'Lovely.', email: 'e2eonly-a@plumpose.local', name: '', rating: 7 }))).toEqual({
      body: 'Please write a few words — at least a sentence.',
      name: 'Please add your name.',
      rating: 'Please choose from one to five stars.',
    })
    expect(await errorsOf(asPublic({ body: 'A proper sentence here.', email: 'not-an-email', name: 'A', rating: 4.5 }))).toMatchObject({
      email: 'Please check the email address.',
      rating: 'Please choose from one to five stars.',
    })
  })

  it('takes one review per person per piece', async () => {
    expect(await errorsOf(asPublic({ body: 'Second go at the same piece.', email: EMAIL.toUpperCase(), name: 'Mariam', rating: 4 }))).toEqual({
      email: 'You have already reviewed this piece — thank you.',
    })
  })

  it('refuses a piece that is not on sale', async () => {
    expect(await errorsOf(payload.create({ collection: 'reviews', data: { body: 'Nice nice nice nice.', email: 'e2eonly-b@plumpose.local', name: 'B', product: 999999, rating: 5 } as never, overrideAccess: false }))).toMatchObject({
      product: 'That piece could not be found.',
    })
  })

  it('marks a verified purchase when that email has an order for the piece', async () => {
    const order = await payload.create({
      collection: 'orders',
      context: { disableRevalidate: true },
      data: { amount: 139900, currency: 'QAR', customerEmail: 'E2EONLY-Buyer@plumpose.local', items: [{ product: productId, quantity: 1 }], status: 'processing' } as never,
      overrideAccess: true,
    })
    orders.push(order.id)
    const doc = await asPublic({ body: 'Bought it for my wedding morning.', email: 'e2eonly-buyer@plumpose.local', name: 'Noor', rating: 5 })
    expect((await payload.findByID({ collection: 'reviews', id: doc.id, overrideAccess: true })).verifiedPurchase).toBe(true)
  })

  it('shows once she approves it, with her reply', async () => {
    const [first] = reviews
    await payload.update({ collection: 'reviews', data: { reply: 'Thank you, Mariam.', status: 'approved' }, id: first, overrideAccess: true })
    const seen = await payload.find({ collection: 'reviews', overrideAccess: false, where: { id: { equals: first } } })
    const mine = seen.docs[0]
    expect(mine?.reply).toBe('Thank you, Mariam.')
    // The email is never sent to the public.
    expect((mine as { email?: string }).email).toBeUndefined()
  })
})

describe('reviews — the average', () => {
  it('is to one decimal, and absent with no reviews', () => {
    expect(averageRating([5, 4, 5])).toBe(4.7)
    expect(averageRating([])).toBeNull()
  })
})
