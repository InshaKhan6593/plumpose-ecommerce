import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

/** The sale's was-price (REQUIREMENTS A3), on a demo piece, put back afterwards. */

let payload: Payload
let id: number
let before: null | number | undefined

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const piece = (await payload.find({ collection: 'products', limit: 1, where: { slug: { equals: 'demo-noir-slip' } } })).docs[0]
  if (!piece) throw new Error('Run `pnpm demo:seed` first.')
  id = piece.id
  before = piece.compareAtPriceInQAR
}, 120_000)

afterAll(async () => {
  await payload.update({ collection: 'products', context: { disableRevalidate: true }, data: { compareAtPriceInQAR: before ?? null }, id, overrideAccess: true })
})

describe('sale price', () => {
  it('takes a was-price higher than the price', async () => {
    const saved = await payload.update({ collection: 'products', context: { disableRevalidate: true }, data: { compareAtPriceInQAR: 95000 }, id, overrideAccess: true })
    expect(saved.compareAtPriceInQAR).toBe(95000)
  })

  it('refuses one at or below the price — that would not be a sale', async () => {
    const error = await payload
      .update({ collection: 'products', context: { disableRevalidate: true }, data: { compareAtPriceInQAR: 75000 }, id, overrideAccess: true })
      .then(() => null)
      .catch((e: { data?: { errors?: Array<{ message: string; path: string }> } }) => e)
    expect(error?.data?.errors).toEqual([expect.objectContaining({ message: 'The was-price must be higher than the price, or empty.', path: 'compareAtPriceInQAR' })])
  })

  it('can be cleared when the sale ends', async () => {
    const saved = await payload.update({ collection: 'products', context: { disableRevalidate: true }, data: { compareAtPriceInQAR: null }, id, overrideAccess: true })
    expect(saved.compareAtPriceInQAR ?? null).toBeNull()
  })
})
