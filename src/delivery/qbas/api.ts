import type { QbasConfig } from './config'
import type { ShipmentRequest } from './protocol'

/**
 * The four QBAS (LogesTechs) calls the store makes.
 *
 * | Call | Endpoint | Signed in by |
 * |---|---|---|
 * | Book | `POST /ship/request/by-email` | email + password in the body |
 * | Cancel | `PUT /guests/{companyId}/packages/cancel?barcode=` | email + password in the body |
 * | Label | `POST /guests/{companyId}/packages/pdf` | nothing — by barcode |
 * | Status | `GET /guests/packages/status?barcode=` | nothing — by barcode |
 *
 * Every call carries the `company-id` header (553 is QBAS). A failure is a
 * `QbasError` whose message is safe to show her: QBAS's own words where it
 * gave some, never the password.
 */

export class QbasError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'QbasError'
  }
}

const TIMEOUT_MS = 20_000

const call = async (
  config: QbasConfig,
  path: string,
  init: { body?: unknown; method: 'GET' | 'POST' | 'PUT' },
): Promise<unknown> => {
  let res: Response
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        Accept: 'application/json',
        'company-id': String(config.companyId),
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      method: init.method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = (error as { name?: string })?.name === 'TimeoutError'
    throw new QbasError(
      timedOut ? 'QBAS did not answer in time. Try again in a minute.' : 'QBAS could not be reached.',
    )
  }

  const text = await res.text().catch(() => '')
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* not JSON — kept as text */
  }

  if (!res.ok) throw new QbasError(reason(body, res.status, config), res.status)
  return body
}

/** QBAS's own message, cleaned: short, and never echoing the login. */
const reason = (body: unknown, status: number, config: QbasConfig): string => {
  const raw =
    body && typeof body === 'object'
      ? String(
          (body as Record<string, unknown>).message ??
            (body as Record<string, unknown>).error ??
            (body as Record<string, unknown>).errorMessage ??
            '',
        )
      : typeof body === 'string'
        ? body
        : ''
  let text = raw.replace(/\s+/g, ' ').trim().slice(0, 300)
  if (config.password) text = text.split(config.password).join('•••')
  if (status === 401 || status === 403)
    return `QBAS refused the login${text ? ` (${text})` : ''}. Check QBAS_EMAIL and QBAS_PASSWORD.`
  return text ? `QBAS said: ${text}` : `QBAS answered with an error (${status}).`
}

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export type Booking = { barcode: string; cost: null | number; packageId: null | number }

export const createShipment = async (
  config: QbasConfig,
  request: ShipmentRequest,
): Promise<Booking> => {
  const body = obj(await call(config, '/ship/request/by-email', { body: request, method: 'POST' }))
  const barcode = String(body.barcode ?? '').trim()
  if (!barcode) throw new QbasError('QBAS accepted the request but sent back no tracking number.')
  const id = Number(body.id)
  const cost = Number(body.cost)
  return {
    barcode,
    cost: Number.isFinite(cost) ? cost : null,
    packageId: Number.isInteger(id) ? id : null,
  }
}

export type PackageStatus = { code: string; notes: string }

export const packageStatus = async (config: QbasConfig, barcode: string): Promise<PackageStatus> => {
  const body = obj(
    await call(config, `/guests/packages/status?${new URLSearchParams({ barcode })}`, {
      method: 'GET',
    }),
  )
  const code = String(body.status ?? '').trim()
  if (!code) throw new QbasError('QBAS did not say where this parcel is.')
  return { code, notes: String(body.notes ?? '').trim() }
}

/** A link to the shipping label PDF, to print and stick on the parcel. */
export const labelUrl = async (config: QbasConfig, barcode: string): Promise<string> => {
  const body = obj(
    await call(config, `/guests/${config.companyId}/packages/pdf`, {
      body: { barcodes: [barcode] },
      method: 'POST',
    }),
  )
  const url = String(body.url ?? '').trim()
  if (!/^https:\/\//.test(url)) throw new QbasError('QBAS did not send a label for this parcel.')
  return url
}

export const cancelShipment = async (config: QbasConfig, barcode: string): Promise<void> => {
  await call(config, `/guests/${config.companyId}/packages/cancel?${new URLSearchParams({ barcode })}`, {
    body: { email: config.email, password: config.password },
    method: 'PUT',
  })
}
