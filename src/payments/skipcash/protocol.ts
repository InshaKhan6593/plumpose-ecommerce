import crypto from 'node:crypto'

import { DIAL_CODES } from '@/data/dialCodes'
import { type Minor, MINOR_UNITS_PER_MAJOR } from '@/lib/pricing/money'

/**
 * SkipCash's wire protocol, pure — the part REQUIREMENTS §7.2 calls "the most
 * brittle part of the integration". No network, no database, so every rule
 * here is pinned by `tests/int/skipcash.int.spec.ts`.
 *
 * Source: dev.skipcash.app (Authentication, API integration, Webhooks, Get
 * Transaction Details), checked 25 Sep 2026, and the old site's
 * `netlify/lib/skipcash.mjs`, which ran against the same API.
 */

/* -------------------------------------------------------------------------- */
/*                                 Signatures                                  */
/* -------------------------------------------------------------------------- */

/**
 * The fields a payment request is signed over, **in this order**. Absent or
 * empty ones are skipped. Custom1 is the only custom field in the signature;
 * Custom2–10, Subject, Description, ReturnUrl and WebhookUrl travel unsigned.
 */
export const PAYMENT_SIGNED_FIELDS = [
  'Uid',
  'KeyId',
  'Amount',
  'FirstName',
  'LastName',
  'Phone',
  'Email',
  'Street',
  'City',
  'State',
  'Country',
  'PostalCode',
  'TransactionId',
  'Custom1',
] as const

/** The fields a webhook is signed over, in this order, with the Webhook Key. */
export const WEBHOOK_SIGNED_FIELDS = [
  'PaymentId',
  'Amount',
  'StatusId',
  'TransactionId',
  'Custom1',
  'VisaId',
] as const

const present = (value: unknown): boolean => value !== undefined && value !== null && value !== ''

/** "Uid=…,KeyId=…,Amount=…" — non-empty fields only, in the given order. */
export const signingString = (fields: readonly string[], body: Record<string, unknown>): string =>
  fields
    .filter((field) => present(body[field]))
    .map((field) => `${field}=${String(body[field])}`)
    .join(',')

const hmac = (secret: string, message: string): string =>
  crypto.createHmac('sha256', secret).update(message, 'utf8').digest('base64')

/** The `Authorization` header for `POST /api/v1/payments`, signed with the Key Secret. */
export const signPayment = (keySecret: string, body: Record<string, unknown>): string =>
  hmac(keySecret, signingString(PAYMENT_SIGNED_FIELDS, body))

/**
 * Did this webhook come from SkipCash? Recomputes the signature with the
 * Webhook Key and compares in constant time. Anything missing is a no.
 */
export const webhookSignatureValid = (
  webhookKey: string,
  body: Record<string, unknown>,
  signature: null | string | undefined,
): boolean => {
  if (!webhookKey || !signature) return false
  const expected = Buffer.from(hmac(webhookKey, signingString(WEBHOOK_SIGNED_FIELDS, body)))
  const received = Buffer.from(signature.trim())
  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
}

/* -------------------------------------------------------------------------- */
/*                                   Status                                    */
/* -------------------------------------------------------------------------- */

/**
 * SkipCash status ids. 12 means the customer is on the card form now, and
 * falls back to 0 after two minutes if they leave.
 */
export const STATUS = {
  0: 'new',
  1: 'pending',
  2: 'paid',
  3: 'canceled',
  4: 'failed',
  5: 'rejected',
  6: 'refunded',
  7: 'pending refund',
  8: 'refund failed',
  12: 'paying now',
} as const

export const PAID = 2

export const statusName = (statusId: unknown): string =>
  STATUS[Number(statusId) as keyof typeof STATUS] ?? `status ${String(statusId)}`

/* -------------------------------------------------------------------------- */
/*                               Request fields                                */
/* -------------------------------------------------------------------------- */

/** QAR minor units to SkipCash's amount: a string, dot separator, two decimals. */
export const skipcashAmount = (minor: Minor): string =>
  (Math.round(minor) / MINOR_UNITS_PER_MAJOR).toFixed(2)

/**
 * SkipCash's amount back to minor units. `null` for anything that is not a
 * plain non-negative decimal, so a malformed figure can never match a real one.
 */
export const minorFromSkipcash = (amount: unknown): Minor | null => {
  const text = String(amount ?? '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  return Math.round(Number(text) * MINOR_UNITS_PER_MAJOR)
}

/**
 * A name as SkipCash accepts it: "should not contain any special characters",
 * at most 60. Letters (any script), spaces, hyphens and apostrophes survive.
 */
export const skipcashName = (value: string, fallback: string): string => {
  const cleaned = value
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}' -]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim()
  return cleaned || fallback
}

/**
 * The phone number with its country code, at most 15 characters.
 *
 * SkipCash accepts a Qatari number with or without +974 but refuses any other
 * without its code, and wants "+", never "00". A number typed without a code
 * takes the delivery country's, dropping a leading trunk 0 ("07700…" → "+447700…").
 */
export const skipcashPhone = (raw: string, countryCode: string): string => {
  const typed = raw.trim()
  const digits = typed.replace(/\D/g, '')
  if (!digits) return ''

  if (typed.startsWith('+')) return `+${digits}`.slice(0, 15)
  if (digits.startsWith('00')) return `+${digits.slice(2)}`.slice(0, 15)

  const dial = (DIAL_CODES[countryCode.toUpperCase()] ?? '').replace(/\D/g, '')
  if (!dial) return `+${digits}`.slice(0, 15)
  if (digits.startsWith(dial) && digits.length > 9) return `+${digits}`.slice(0, 15)
  return `+${dial}${digits.replace(/^0+/, '')}`.slice(0, 15)
}

/** Longest the address fields may be, all together. */
export const ADDRESS_BUDGET = 50

const tidy = (value: string): string =>
  value
    .replace(/[\u0000-\u001f\u007f,=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The billing address, fitted to SkipCash's rule that all address fields
 * together stay within 50 characters. Country and city matter most to card
 * checks, so they are kept whole where they can be and the street takes what
 * is left. Commas and "=" are removed: the signature is a comma-separated list
 * of `key=value` pairs, and neither may appear inside a value.
 */
export const skipcashAddress = (address: {
  addressLine1: string
  city: string
  country: string
  postalCode: string
}): { City?: string; Country?: string; PostalCode?: string; Street?: string } => {
  const country = tidy(address.country).toUpperCase().slice(0, 2)
  let budget = ADDRESS_BUDGET - country.length

  const city = tidy(address.city).slice(0, Math.min(40, budget))
  budget -= city.length

  const postal = tidy(address.postalCode)
  const postalCode = postal.length <= 5 && postal.length <= budget - 10 ? postal : ''
  budget -= postalCode.length

  const street = tidy(address.addressLine1).slice(0, Math.min(60, budget)).trim()

  return {
    ...(street ? { Street: street } : {}),
    ...(city ? { City: city } : {}),
    ...(country ? { Country: country } : {}),
    ...(postalCode ? { PostalCode: postalCode } : {}),
  }
}

/**
 * Our reference for one payment attempt — SkipCash's `TransactionId`, and how
 * a payment it reports is matched back to our record. "PLM-250925-7K4QX2":
 * at most 40 characters, nothing but letters, digits and hyphens, and random
 * enough that it cannot be guessed. A new one for every attempt.
 */
export const newReference = (now: Date = new Date()): string => {
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY34679'
  const bytes = crypto.randomBytes(6)
  const tail = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${String(now.getUTCFullYear()).slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`
  return `PLM-${stamp}-${tail}`
}

/** SkipCash's own payment ids are UUIDs. Anything else is not worth a network call. */
export const isPaymentId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
