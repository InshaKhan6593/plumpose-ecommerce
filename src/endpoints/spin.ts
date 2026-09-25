import type { Endpoint, PayloadRequest } from 'payload'


import type { DiscountCode, Media, SiteSetting, SpinSegment } from '@/payload-types'

import { scheduleSpinRewardEmail } from '@/email/spinReward'
import { describeReward, drawableSegments, newRewardCode, pickSegment, rewardExpiry } from '@/lib/spin/wheel'
import { deviceOf } from '@/utilities/deviceOf'

/**
 * The reward wheel's two endpoints (REQUIREMENTS C7, A8, N6).
 *
 *   GET  /api/spin  — what the wheel shows: heading, words, and each segment's
 *                     label and colour. Never the odds.
 *   POST /api/spin  — `{ email }` → one spin, decided here.
 *
 * Everything that matters happens on the server: the draw, the code, the
 * rules. The browser only animates towards the segment it is told.
 *
 * The rules, all set by her in Site settings → Reward wheel:
 *   - one prize per email, ever — enforced by a unique column, so two spins
 *     arriving at once cannot both win;
 *   - "roll again" gives up to N extra spins, then drops out of the draw;
 *   - optionally, only emails that have never ordered;
 *   - at most M spins per device per day (a salted hash of the IP, never the
 *     address), so one person cannot collect codes under many emails.
 *
 * A won code is single use, locked to the email that won it (the discount
 * engine refuses it for anyone else), and expires after the segment's number
 * of days. The email joins the newsletter list — the wheel's words say so —
 * and the code is emailed once the spin has committed.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }, status })

/** The same reply for "already won" and "has ordered", so neither can be probed. */
const NOT_AGAIN = { message: 'This email has already had its spin.', outcome: 'alreadySpun' } as const

const settingsFor = (s: Partial<SiteSetting>) => ({
  body: s.spinWheelBody ?? '',
  dailyLimit: Math.max(1, s.spinWheelDailyLimit ?? 5),
  enabled: s.spinWheelEnabled !== false,
  heading: s.spinWheelHeading || 'Before anyone else.',
  maxRerolls: Math.min(5, Math.max(0, s.spinWheelMaxRerolls ?? 1)),
  newCustomersOnly: s.spinWheelNewCustomersOnly === true,
})


export const wheelEndpoint: Endpoint = {
  handler: async (req) => {
    const settings = settingsFor((await req.payload.findGlobal({ depth: 0, slug: 'siteSettings' })) as Partial<SiteSetting>)
    if (!settings.enabled) return json({ enabled: false })

    const { docs } = await req.payload.find({
      collection: 'spinSegments',
      depth: 0,
      limit: 20,
      pagination: false,
      sort: '_order',
      where: { active: { not_equals: false } },
    })

    // The print, for the wheel's centre — the square crop of the seeded macro photograph.
    const print = (
      await req.payload.find({ collection: 'media', depth: 0, limit: 1, where: { filename: { equals: 'brand-02-print-macro.jpg' } } })
    ).docs[0] as Media | undefined
    // For the fine print: how long a code lasts (the shortest, if prizes differ).
    const days = (docs as SpinSegment[]).filter((s) => s.rewardType !== 'rollAgain').map((s) => s.expiryDays ?? 30)

    return json({
      body: settings.body,
      centreImage: print?.sizes?.square?.url ?? print?.url ?? null,
      enabled: docs.length > 0,
      heading: settings.heading,
      // Label and colour only — `weight` is admin-only at field level, and is not asked for here anyway.
      segments: (docs as SpinSegment[]).map((s) => ({ colour: s.colour ?? '#f6f4f0', id: s.id, label: s.label })),
      validDays: days.length ? Math.min(...days) : 30,
    })
  },
  method: 'get',
  path: '/spin',
}

export const spinEndpoint: Endpoint = {
  handler: async (req) => {
    const { payload } = req

    let email: string
    try {
      const body = ((await req.json?.()) ?? {}) as { email?: unknown }
      email = String(body.email ?? '').trim().toLowerCase().slice(0, 200)
    } catch {
      return json({ message: 'Could not read that request.', outcome: 'invalid' }, 400)
    }
    if (!EMAIL.test(email)) return json({ message: 'Please enter your email address.', outcome: 'invalid' }, 400)

    const settings = settingsFor((await payload.findGlobal({ depth: 0, req, slug: 'siteSettings' })) as Partial<SiteSetting>)
    if (!settings.enabled) return json({ message: 'The wheel is resting for now.', outcome: 'closed' }, 404)

    // ---- one device, a few spins a day ----
    const device = deviceOf(req)
    if (device) {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString()
      const recent = await payload.count({
        collection: 'spinEntries',
        overrideAccess: true,
        req,
        where: { and: [{ ipHash: { equals: device } }, { createdAt: { greater_than: since } }] },
      })
      if (recent.totalDocs >= settings.dailyLimit) {
        return json({ message: 'That is enough spins for today. Please come back tomorrow.', outcome: 'tooMany' }, 429)
      }
    }

    // ---- one prize per email ----
    const won = await payload.count({ collection: 'spinEntries', overrideAccess: true, req, where: { winnerEmail: { equals: email } } })
    if (won.totalDocs > 0) return json(NOT_AGAIN, 409)

    if (settings.newCustomersOnly) {
      const ordered = await payload.count({
        collection: 'orders',
        overrideAccess: true,
        req,
        where: { or: [{ customerEmail: { equals: email } }, { 'customer.email': { equals: email } }] },
      })
      if (ordered.totalDocs > 0) return json(NOT_AGAIN, 409)
    }

    // ---- the draw ----
    const [segments, rerolls] = await Promise.all([
      payload.find({ collection: 'spinSegments', depth: 0, limit: 20, overrideAccess: true, pagination: false, req }),
      payload.count({
        collection: 'spinEntries',
        overrideAccess: true,
        req,
        where: { and: [{ email: { equals: email } }, { issuedCode: { exists: false } }] },
      }),
    ])
    const rerollsLeft = Math.max(0, settings.maxRerolls - rerolls.totalDocs)
    const segment = pickSegment(drawableSegments(segments.docs as SpinSegment[], { rerollsLeft }))
    if (!segment) return json({ message: 'The wheel is resting for now.', outcome: 'closed' }, 503)

    if (segment.rewardType === 'rollAgain') {
      await payload.create({ collection: 'spinEntries', data: { email, ipHash: device ?? undefined, segment: segment.id }, overrideAccess: true, req })
      return json({ outcome: 'rollAgain', segmentId: segment.id, spinsLeft: rerollsLeft - 1 })
    }

    // ---- the prize: a code of its own ----
    const expiresAt = rewardExpiry(segment.expiryDays ?? 30)
    let code: DiscountCode | null = null
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      code = (await payload
        .create({
          collection: 'discountCodes',
          data: {
            active: true,
            code: newRewardCode(),
            expiresAt: expiresAt.toISOString(),
            issuedToEmail: email,
            perCustomerLimit: 1,
            source: 'spinWheel',
            type: segment.rewardType as DiscountCode['type'],
            usageLimit: 1,
            value: segment.rewardType === 'freeShipping' ? undefined : (segment.rewardValue ?? undefined),
          },
          overrideAccess: true,
          req,
        })
        // A clash on the (unique) code: draw another.
        .catch(() => null)) as DiscountCode | null
    }
    if (!code) return json({ message: 'That didn’t work. Please try again.', outcome: 'error' }, 500)

    try {
      await payload.create({
        collection: 'spinEntries',
        data: { email, ipHash: device ?? undefined, issuedCode: code.id, segment: segment.id, winnerEmail: email },
        overrideAccess: true,
        req,
      })
    } catch {
      // The unique winnerEmail refused a second win arriving at the same moment: withdraw this code.
      await payload.delete({ collection: 'discountCodes', id: code.id, overrideAccess: true, req }).catch(() => undefined)
      return json(NOT_AGAIN, 409)
    }

    // The wheel's words promise the list; a repeat address is simply already on it.
    const listed = await payload.count({ collection: 'subscribers', overrideAccess: true, req, where: { email: { equals: email } } })
    if (!listed.totalDocs) {
      await payload.create({ collection: 'subscribers', data: { email, source: 'spinWheel' }, overrideAccess: true, req }).catch(() => undefined)
    }

    scheduleSpinRewardEmail(payload, { codeId: code.id, email })

    return json({
      code: code.code,
      expiresAt: expiresAt.toISOString(),
      outcome: 'won',
      reward: describeReward(segment),
      segmentId: segment.id,
    })
  },
  method: 'post',
  path: '/spin',
}
