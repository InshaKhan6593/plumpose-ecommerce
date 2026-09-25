import type { PayloadRequest } from 'payload'

import { createHmac } from 'node:crypto'

/**
 * A device, as a salted hash of its IP — for per-device limits (the reward
 * wheel, reviews), never the raw address. Behind the host's proxy the address
 * is the first `x-forwarded-for` entry. With none (a local request) there is
 * nothing to count, and a per-device limit does not apply.
 */
export const deviceOf = (req: Pick<PayloadRequest, 'headers'>): null | string => {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('x-real-ip')?.trim()
  if (!ip) return null
  return createHmac('sha256', process.env.PAYLOAD_SECRET || 'plumpose').update(ip).digest('hex').slice(0, 40)
}
