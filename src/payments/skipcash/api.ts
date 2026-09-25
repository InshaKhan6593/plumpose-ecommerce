import crypto from 'node:crypto'

import { signPayment } from './protocol'

/**
 * SkipCash's REST API: create a payment, read one back.
 *
 * The four keys come from the Merchant Portal → Online Payments, one set per
 * environment (sandbox / production), and live only in environment variables
 * — never in the admin (REQUIREMENTS §4.3, "SkipCash credentials").
 *
 * | Variable              | Used for                                        |
 * |-----------------------|-------------------------------------------------|
 * | SKIPCASH_ENV          | `sandbox` or `production` — which API is called |
 * | SKIPCASH_CLIENT_ID    | Reading a payment (sent as `Authorization`)     |
 * | SKIPCASH_KEY_ID       | Named in every payment request                  |
 * | SKIPCASH_KEY_SECRET   | Signs every payment request                     |
 * | SKIPCASH_WEBHOOK_KEY  | Verifies every webhook                          |
 */

export const SANDBOX_URL = 'https://skipcashtest.azurewebsites.net'
export const PRODUCTION_URL = 'https://api.skipcash.app'

export type SkipCashConfig = {
  baseUrl: string
  clientId: string
  isSandbox: boolean
  keyId: string
  keySecret: string
  webhookKey: string
}

/**
 * Anything other than exactly `production` is the sandbox, so a typo can
 * only ever point at test money, never at real money.
 */
export const skipcashConfig = (): SkipCashConfig => {
  const isSandbox = (process.env.SKIPCASH_ENV ?? '').trim().toLowerCase() !== 'production'
  return {
    baseUrl: isSandbox ? SANDBOX_URL : PRODUCTION_URL,
    clientId: process.env.SKIPCASH_CLIENT_ID?.trim() ?? '',
    isSandbox,
    keyId: process.env.SKIPCASH_KEY_ID?.trim() ?? '',
    keySecret: process.env.SKIPCASH_KEY_SECRET?.trim() ?? '',
    webhookKey: process.env.SKIPCASH_WEBHOOK_KEY?.trim() ?? '',
  }
}

/** The variables still empty — logged at start-up, never shown to a customer. */
export const missingSkipcashConfig = (config = skipcashConfig()): string[] =>
  (
    [
      ['SKIPCASH_CLIENT_ID', config.clientId],
      ['SKIPCASH_KEY_ID', config.keyId],
      ['SKIPCASH_KEY_SECRET', config.keySecret],
      ['SKIPCASH_WEBHOOK_KEY', config.webhookKey],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name)

/** SkipCash takes payment when chosen and fully configured. */
export const isSkipcashEnabled = (): boolean =>
  process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === 'skipcash' &&
  missingSkipcashConfig().length === 0

/** A payment as `GET /api/v1/payments/{id}` returns it. Only what we read. */
export type SkipCashPayment = {
  amount: string
  cardNumber?: null | string
  cardType?: null | string
  currency?: string
  id: string
  payUrl?: string
  status?: string
  statusId: number
  transactionId?: null | string
  visaId?: null | string
}

type Envelope = {
  errorMessage?: null | string
  hasError?: boolean
  resultObj?: SkipCashPayment
  validationErrors?: Array<{ errorMessage?: string; message?: string }> | null
}

/** SkipCash can be slow; a customer waiting on "Pay" should not wait forever. */
const TIMEOUT_MS = 20_000

export class SkipCashError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'SkipCashError'
  }
}

const reasonOf = (envelope: Envelope | null): string =>
  envelope?.errorMessage ||
  envelope?.validationErrors?.map((e) => e.errorMessage || e.message).find(Boolean) ||
  ''

export type NewPayment = {
  Amount: string
  City?: string
  Country?: string
  Custom1?: string
  Description?: string
  Email: string
  FirstName: string
  LastName: string
  Phone: string
  PostalCode?: string
  ReturnUrl?: string
  Street?: string
  Subject?: string
  TransactionId: string
  WebhookUrl?: string
}

/** `POST /api/v1/payments` — registers the payment and returns its `payUrl`. */
export const createPayment = async (
  config: SkipCashConfig,
  fields: NewPayment,
): Promise<SkipCashPayment & { payUrl: string }> => {
  const body: Record<string, string> = {
    Uid: crypto.randomUUID(),
    KeyId: config.keyId,
    ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== '')),
  }

  let res: Response
  try {
    res = await fetch(`${config.baseUrl}/api/v1/payments`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: signPayment(config.keySecret, body),
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new SkipCashError('SkipCash could not be reached.', undefined, String(error))
  }

  const envelope = (await res.json().catch(() => null)) as Envelope | null
  const payment = envelope?.resultObj
  if (!res.ok || envelope?.hasError || !payment?.payUrl || !payment.id) {
    throw new SkipCashError(
      reasonOf(envelope) || 'SkipCash refused the payment.',
      res.status,
      envelope,
    )
  }
  return payment as SkipCashPayment & { payUrl: string }
}

/**
 * `GET /api/v1/payments/{id}` — what SkipCash itself says about a payment.
 * `null` when it does not know the id. Throws only when SkipCash could not be
 * asked, so a caller can tell "no such payment" from "try again".
 */
export const getPayment = async (
  config: SkipCashConfig,
  paymentId: string,
): Promise<null | SkipCashPayment> => {
  let res: Response
  try {
    res = await fetch(`${config.baseUrl}/api/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Accept: 'application/json', Authorization: config.clientId },
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new SkipCashError('SkipCash could not be reached.', undefined, String(error))
  }

  if (res.status === 404) return null
  const envelope = (await res.json().catch(() => null)) as Envelope | null
  if (res.status >= 500) {
    throw new SkipCashError(reasonOf(envelope) || 'SkipCash is not answering.', res.status)
  }
  const payment = envelope?.resultObj
  if (!res.ok || !payment?.id) return null
  return payment
}
