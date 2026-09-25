import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'

import { ValidationError } from 'payload'

import { checkRole } from '@/access/utilities'
import { deviceOf } from '@/utilities/deviceOf'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Reviews one device may send in a day — plenty for a household, not for a script. */
export const REVIEWS_PER_DEVICE_PER_DAY = 5

const isAdmin = (req: PayloadRequest) =>
  Boolean(req.user && checkRole(['admin'], req.user as never))

/**
 * Checks a review a customer sends from the product page (REQUIREMENTS S18).
 * The collection is publicly writable — that is how the form sends it — so
 * everything is checked here, on the server:
 *
 *   - a name, an email address, a whole-star rating 1–5 and a few real words;
 *   - the piece exists and is on sale;
 *   - one review per person per piece (the same email cannot pile on);
 *   - at most five a day from one device.
 *
 * It also marks a **verified purchase** when that email has an order for
 * this piece. What a stranger may not set — the approval, the reply, the
 * homepage flag — has field access that drops it (see collections/Reviews.ts),
 * so every public review starts pending.
 *
 * Her own edits in the admin skip all of this.
 */
export const validateReview: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || !data || isAdmin(req)) return data

  const name = String(data.name ?? '')
    .trim()
    .slice(0, 80)
  const email = String(data.email ?? '')
    .trim()
    .toLowerCase()
  const title = String(data.title ?? '')
    .trim()
    .slice(0, 120)
  const body = String(data.body ?? '')
    .trim()
    .slice(0, 2000)
  const rating = Number(data.rating)
  const productId =
    typeof data.product === 'object' && data.product
      ? (data.product as { id: unknown }).id
      : data.product

  const errors: Array<{ message: string; path: string }> = []
  if (!name) errors.push({ message: 'Please add your name.', path: 'name' })
  if (!EMAIL.test(email)) errors.push({ message: 'Please check the email address.', path: 'email' })
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    errors.push({ message: 'Please choose from one to five stars.', path: 'rating' })
  if (body.length < 10)
    errors.push({ message: 'Please write a few words — at least a sentence.', path: 'body' })

  const product = productId
    ? await req.payload
        .find({
          collection: 'products',
          depth: 0,
          limit: 1,
          req,
          where: { and: [{ id: { equals: productId } }, { _status: { equals: 'published' } }] },
        })
        .then((r) => r.docs[0])
        .catch(() => undefined)
    : undefined
  if (!product) errors.push({ message: 'That piece could not be found.', path: 'product' })

  if (!errors.length && product) {
    const already = await req.payload.count({
      collection: 'reviews',
      overrideAccess: true,
      req,
      trash: true,
      where: { and: [{ product: { equals: product.id } }, { email: { equals: email } }] },
    })
    if (already.totalDocs)
      errors.push({ message: 'You have already reviewed this piece — thank you.', path: 'email' })
  }

  const device = deviceOf(req)
  if (!errors.length && device) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const recent = await req.payload.count({
      collection: 'reviews',
      overrideAccess: true,
      req,
      trash: true,
      where: { and: [{ ipHash: { equals: device } }, { createdAt: { greater_than: since } }] },
    })
    if (recent.totalDocs >= REVIEWS_PER_DEVICE_PER_DAY)
      errors.push({
        message: 'Thank you — that is enough reviews from here for today.',
        path: 'body',
      })
  }

  if (errors.length) throw new ValidationError({ collection: 'reviews', errors }, req.t)

  return {
    ...data,
    body,
    email,
    ipHash: device,
    name,
    product: product!.id,
    rating,
    title: title || undefined,
    verifiedPurchase: await boughtIt(req, email, product!.id),
  }
}

/** Has this email an order with this piece in it — as a guest, or through an account? */
async function boughtIt(req: PayloadRequest, email: string, productId: number): Promise<boolean> {
  const account = await req.payload
    .find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
      where: { email: { equals: email } },
    })
    .then((r) => r.docs[0])
    .catch(() => undefined)
  if (account) {
    const viaAccount = await req.payload.count({
      collection: 'orders',
      overrideAccess: true,
      req,
      where: {
        and: [{ 'items.product': { equals: productId } }, { customer: { equals: account.id } }],
      },
    })
    if (viaAccount.totalDocs) return true
  }
  // Guest orders keep the email as typed ("Mariam@…"), so compare without case.
  const asGuest = await req.payload.find({
    collection: 'orders',
    depth: 0,
    limit: 50,
    overrideAccess: true,
    req,
    select: { customerEmail: true },
    where: {
      and: [{ 'items.product': { equals: productId } }, { customerEmail: { like: email } }],
    },
  })
  return asGuest.docs.some((o) => (o.customerEmail ?? '').trim().toLowerCase() === email)
}
