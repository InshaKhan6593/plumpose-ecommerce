import type { Payload, TypedUser } from 'payload'

import { createLocalReq } from 'payload'

/**
 * The parts of a checkout that do not depend on the gateway.
 *
 * Payment is a redirect: the customer leaves our site to pay on the gateway's
 * page and comes back to `/checkout/return`, while the gateway's webhook
 * reports the same payment to the server. Either can arrive first, so both
 * settle through the plugin's own confirm-order endpoint, whose atomic claim
 * on the transaction guarantees exactly one order however many callers race.
 */

/* -------------------------------------------------------------------------- */
/*                      What the checkout form sends                           */
/* -------------------------------------------------------------------------- */

export type CheckoutAddress = {
  addressLine1: string
  addressLine2: string
  city: string
  /** ISO-2. */
  country: string
  firstName: string
  lastName: string
  phone: string
  postalCode: string
}

export type CheckoutDetails = {
  address: CheckoutAddress
  /** Qatar only — the key into the city rate table. */
  cityKey: null | string
  discountCode: null | string
  gift: boolean
  giftNote: string
}

/** Longest gift note the card takes. Mirrored by the form's `maxLength`. */
export const GIFT_NOTE_MAX = 300

const text = (value: unknown, max: number): string =>
  String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)

/**
 * The extra fields the checkout form sends alongside the plugin's own, cleaned.
 * Everything here is re-checked by the pricing engine before any money moves;
 * this only bounds and tidies what is stored.
 */
export const readCheckoutDetails = (data: unknown): CheckoutDetails => {
  const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const address = (
    body.shippingAddress && typeof body.shippingAddress === 'object' ? body.shippingAddress : {}
  ) as Record<string, unknown>

  const gift = body.gift === true

  return {
    address: {
      addressLine1: text(address.addressLine1, 120),
      addressLine2: text(address.addressLine2, 120),
      city: text(address.city, 80),
      country: text(address.country, 2).toUpperCase(),
      firstName: text(address.firstName, 60),
      lastName: text(address.lastName, 60),
      phone: text(address.phone, 30),
      postalCode: text(address.postalCode, 20),
    },
    cityKey: text(body.shippingCityKey, 60) || null,
    discountCode: text(body.discountCode, 40).toUpperCase() || null,
    gift,
    giftNote: gift ? text(body.giftNote, GIFT_NOTE_MAX) : '',
  }
}

/**
 * Cart items as the transaction records them — the plugin's own flattening
 * (relationships to ids), minus personalisation.
 *
 * The transactions collection has no personalisation field and would drop it.
 * It is read back from the cart's pricing snapshot at confirmation instead,
 * where the engine's resolved names and fees are (see `./finaliseOrder`).
 */
export const itemsForGateway = (items: unknown[] = []): Record<string, unknown>[] =>
  items.map((raw) => {
    const item = raw as Record<string, unknown>
    const { id: _rowId, personalisation: _dropped, product, variant, ...rest } = item
    const idOf = (value: unknown) =>
      value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value
    const variantID = variant ? idOf(variant) : undefined
    return {
      ...rest,
      product: idOf(product),
      quantity: item.quantity,
      ...(variantID ? { variant: variantID } : {}),
    }
  })

/* -------------------------------------------------------------------------- */
/*                         Settling a paid payment                             */
/* -------------------------------------------------------------------------- */

export type SettleResult =
  | { accessToken: string; orderId: number; status: 'confirmed' }
  /** The customer's card was refused. Nothing was charged; the bag is untouched. */
  | { status: 'failed' }
  /** Paid is not yet reported, or confirmation is still in flight. Try again shortly. */
  | { status: 'pending' }
  /** The customer left without paying, or the payment page closed. The bag is untouched. */
  | { status: 'unpaid' }
  | { reason: string; status: 'error' }

export const orderForTransaction = async (payload: Payload, transactionId: number) => {
  const found = await payload.find({
    collection: 'orders',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    select: { accessToken: true },
    where: { transactions: { equals: transactionId } },
  })
  const order = found.docs[0]
  return order ? { accessToken: order.accessToken ?? '', orderId: order.id } : null
}

/**
 * Calls the plugin's own confirm-order endpoint for `provider` in this
 * process, as `user` (or as a guest), on a request of its own.
 *
 * Not an HTTP call to ourselves: that could only carry the shopper's cookie,
 * the webhook has none, and a protected Vercel preview refuses a self-request
 * outright. In process, the endpoint still runs every check it runs for the
 * browser — the atomic claim, the adapter's own verification, the stock
 * decrement — and opens its own database transaction, because this request
 * carries none. So anything it must see has to be committed before this runs.
 *
 * Whose order it is comes from the transaction, never from whoever is
 * calling: the plugin settles a signed-in customer's payment only for that
 * customer, and the webhook has no one signed in (docs/BUILD-LOG.md §31).
 */
export const confirmInProcess = async ({
  data,
  payload,
  provider,
  user,
}: {
  data: Record<string, unknown>
  payload: Payload
  provider: string
  user: null | (TypedUser & { collection: 'users' })
}): Promise<null | Response> => {
  const endpoint = payload.config.endpoints.find(
    (e) => e.path === `/payments/${provider}/confirm-order` && e.method === 'post',
  )
  if (!endpoint) {
    payload.logger.error(`The ${provider} confirm-order endpoint is not registered.`)
    return null
  }
  const req = await createLocalReq({ req: { method: 'POST' }, user: user ?? undefined }, payload)
  req.data = data
  return Promise.resolve(endpoint.handler(req)).catch((error: unknown) => {
    payload.logger.error({ err: error }, 'Confirming an order in process threw.')
    return null
  })
}

/** The account a transaction belongs to, loaded so the plugin can act as them. */
export const customerOfTransaction = async (
  payload: Payload,
  customer: unknown,
): Promise<{ missing: boolean; user: null | (TypedUser & { collection: 'users' }) }> => {
  const customerID =
    customer && typeof customer === 'object' ? (customer as { id?: number }).id : customer
  if (!customerID) return { missing: false, user: null }
  const found = await payload
    .findByID({ collection: 'users', depth: 0, id: customerID as number, overrideAccess: true })
    .catch(() => null)
  return found
    ? { missing: false, user: { ...found, collection: 'users' } }
    : { missing: true, user: null }
}
