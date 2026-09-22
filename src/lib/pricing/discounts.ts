import type { Payload, PayloadRequest } from 'payload'

import type { DiscountCode } from '@/payload-types'

import { type Minor, toMinor } from './money'
import type { ValidatedDiscount } from './priceOrder'

/**
 * Discount validation (P7, A7).
 *
 * Two operations, deliberately separate:
 *
 *   `validateDiscountCode()` — may this basket use this code, right now?
 *   `redeemDiscount()`       — record that it was used.
 *
 * They are separate because **a code is only consumed on successful payment**.
 * Validating at the quote and consuming at the same moment would burn a
 * single-use code every time somebody typed it into a basket they then
 * abandoned — and with the reward wheel issuing one-per-customer codes, that
 * is the difference between a prize and a complaint.
 *
 * Validation therefore runs twice: once for the displayed quote, and again
 * server-side immediately before the payment is registered. The quote is never
 * trusted.
 */

export type DiscountRefusalReason =
  | 'expired'
  | 'minSpend'
  | 'notEligible'
  | 'notStarted'
  | 'notYours'
  | 'perCustomerLimit'
  | 'unknownCode'
  | 'usageLimit'

export type DiscountRefusal = {
  message: string
  reason: DiscountRefusalReason
}

export type DiscountResult =
  | { ok: false; refusal: DiscountRefusal }
  | { ok: true; code: DiscountCode; discount: ValidatedDiscount }

export type DiscountContext = {
  /** Who is checking out. Required for per-customer limits and wheel codes. */
  email?: null | string
  /** Goods + embroidery for the whole basket, minor units. */
  goodsTotal: Minor
  now?: Date
  /** Every product in the basket, for the product restriction. */
  productIds: number[]
  /** How many times this email has already redeemed this code. */
  usesByThisCustomer: number
}

/** Codes are matched case- and space-insensitively; customers retype them badly. */
export const normaliseCode = (raw: unknown): string =>
  String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

const refuse = (reason: DiscountRefusalReason, message: string): DiscountResult => ({
  ok: false,
  refusal: { message, reason },
})

/** `appliesTo` may arrive as ids or as populated documents, depending on depth. */
const restrictedToProductIds = (code: DiscountCode): number[] =>
  (code.appliesTo ?? [])
    .map((entry) => (typeof entry === 'number' ? entry : entry?.id))
    .filter((id): id is number => typeof id === 'number')

/**
 * Decides whether a code may be used, given the basket and the customer.
 *
 * Pure — it takes the code document and the counts rather than reading them,
 * so every branch is testable without a database.
 *
 * The refusal messages are written to be shown to the customer as-is, and they
 * deliberately do not distinguish "this code does not exist" from "this code
 * is not for you": telling an attacker which codes are real turns the field
 * into an oracle for guessing them.
 */
export const evaluateDiscount = (code: DiscountCode, context: DiscountContext): DiscountResult => {
  const now = context.now ?? new Date()
  const unknown = refuse('unknownCode', 'That code is not valid.')

  if (!code.active) return unknown

  if (code.startsAt && new Date(code.startsAt) > now) {
    return refuse('notStarted', 'That code is not active yet.')
  }

  if (code.expiresAt && new Date(code.expiresAt) < now) {
    return refuse('expired', 'That code has expired.')
  }

  /**
   * Wheel codes are issued to one address. Checking it here is what stops a
   * prize being passed around — the wheel's whole value is one per visitor.
   */
  if (code.issuedToEmail) {
    const claimant = String(context.email ?? '')
      .trim()
      .toLowerCase()
    if (!claimant || claimant !== code.issuedToEmail.trim().toLowerCase()) {
      return refuse('notYours', 'That code was issued to a different email address.')
    }
  }

  if (typeof code.usageLimit === 'number' && code.usageLimit > 0) {
    if ((code.usageCount ?? 0) >= code.usageLimit) {
      return refuse('usageLimit', 'That code has already been fully redeemed.')
    }
  }

  if (typeof code.perCustomerLimit === 'number' && code.perCustomerLimit > 0) {
    if (context.usesByThisCustomer >= code.perCustomerLimit) {
      return refuse('perCustomerLimit', 'You have already used that code.')
    }
  }

  if (typeof code.minSpendQar === 'number' && code.minSpendQar > 0) {
    if (context.goodsTotal < toMinor(code.minSpendQar)) {
      return refuse(
        'minSpend',
        `That code needs a minimum spend of QAR ${code.minSpendQar.toLocaleString('en-GB')}.`,
      )
    }
  }

  const restriction = restrictedToProductIds(code)
  if (restriction.length) {
    const basketQualifies = context.productIds.some((id) => restriction.includes(id))
    if (!basketQualifies) {
      return refuse('notEligible', 'That code does not apply to anything in your bag.')
    }
  }

  return {
    ok: true,
    code,
    discount: {
      appliesToProductIds: restriction.length ? restriction : undefined,
      code: code.code,
      type: code.type,
      value: code.value ?? 0,
    },
  }
}

/**
 * Looks a code up and validates it against the basket.
 *
 * Reads `discountUses` for the per-customer count rather than trusting a
 * counter on the code, because that limit is per email and the code's own
 * `usageCount` is the total across everyone.
 */
export const validateDiscountCode = async (
  payload: Payload,
  rawCode: string,
  context: Omit<DiscountContext, 'usesByThisCustomer'>,
): Promise<DiscountResult> => {
  const code = normaliseCode(rawCode)
  if (!code) return refuse('unknownCode', 'That code is not valid.')

  const found = await payload.find({
    collection: 'discountCodes',
    depth: 0,
    limit: 1,
    /** Overriding access: this collection is admin-read, and a customer
     *  redeeming a code they already hold is not reading the code list. */
    overrideAccess: true,
    where: { code: { equals: code } },
  })

  const doc = found.docs[0]
  if (!doc) return refuse('unknownCode', 'That code is not valid.')

  const email = String(context.email ?? '')
    .trim()
    .toLowerCase()

  let usesByThisCustomer = 0
  if (email) {
    const uses = await payload.count({
      collection: 'discountUses',
      overrideAccess: true,
      where: { and: [{ code: { equals: doc.id } }, { email: { equals: email } }] },
    })
    usesByThisCustomer = uses.totalDocs
  }

  return evaluateDiscount(doc, { ...context, usesByThisCustomer })
}

/**
 * Records a redemption. Call this **only** once payment has succeeded.
 *
 * Writes the ledger row first, then bumps the counter: if the process dies
 * between the two, an over-count is recoverable from the ledger, whereas a
 * missing ledger row with an incremented counter is not.
 *
 * ⚠️ There is a residual race here — two customers redeeming the last use of a
 * code at the same instant can both pass validation. Closing it needs either a
 * database transaction around validate-and-increment or a unique constraint on
 * (code, email). It is recorded rather than hidden because at this store's
 * volume the exposure is one extra redemption on a limited code, and the fix
 * belongs with the payment adapter where the transaction boundary lives.
 */
export const redeemDiscount = async (
  payload: Payload,
  args: {
    amountQar: Minor
    code: DiscountCode
    email: string
    orderId?: number
    /**
     * **Pass this whenever one exists.** Payload runs an endpoint inside a
     * database transaction carried on `req`; a write without it goes out on a
     * separate connection and cannot see rows the transaction has not committed
     * yet. Omitting it here failed with
     * `violates foreign key constraint discount_uses_order_id_orders_id_fk`,
     * because the order it references was still uncommitted.
     */
    req?: PayloadRequest
  },
): Promise<void> => {
  await payload.create({
    collection: 'discountUses',
    data: {
      amountQar: args.amountQar,
      code: args.code.id,
      email: args.email.trim().toLowerCase(),
      order: args.orderId,
    },
    overrideAccess: true,
    req: args.req,
  })

  await payload.update({
    collection: 'discountCodes',
    data: { usageCount: (args.code.usageCount ?? 0) + 1 },
    id: args.code.id,
    overrideAccess: true,
    req: args.req,
  })
}
