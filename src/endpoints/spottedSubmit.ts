import type { Endpoint, PayloadRequest } from 'payload'

import { addDataAndFileToRequest } from 'payload'
import sharp from 'sharp'

import { deviceOf } from '@/utilities/deviceOf'

/**
 * POST /api/spotted/submit — a customer sends a photograph of themselves in
 * plumpose (REQUIREMENTS S15). Multipart: `file` (the photo) and `_payload`
 * (JSON: handle, caption, postUrl, email, consent).
 *
 * The photo library is admin-only, so this is the one way in, and everything
 * is checked here:
 *   - a real JPEG, PNG or WebP (read by the image library, not trusted from
 *     its name), at most 12 MB, at least 600 px on its short side;
 *   - an Instagram handle that looks like one; a post link only if it is an
 *     Instagram link; an email only if it looks like one;
 *   - their permission to show it, ticked;
 *   - at most three a day from one device.
 *
 * It arrives **pending**: nothing shows until she approves it in the admin.
 */

export const MAX_BYTES = 12 * 1024 * 1024
export const SPOTTED_PER_DEVICE_PER_DAY = 3
const MIN_SIDE = 600
const HANDLE = /^@?[A-Za-z0-9._]{1,30}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const INSTAGRAM = /^https:\/\/(www\.)?instagram\.com\/[^\s]+$/i
const FORMATS: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' }

type Errors = Record<string, string>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }, status })

/** Reads and checks a submission. Pure apart from reading the image; exported for tests. */
export async function checkSubmission(input: {
  data: Record<string, unknown>
  file?: { data?: Buffer; mimetype?: string; size?: number }
}): Promise<{ errors: Errors; value?: { caption: string; email: string; format: string; handle: string; postUrl: string } }> {
  const errors: Errors = {}
  const d = input.data
  const rawHandle = String(d.handle ?? '').trim()
  const handle = rawHandle ? `@${rawHandle.replace(/^@+/, '')}` : ''
  const caption = String(d.caption ?? '').trim().slice(0, 200)
  const postUrl = String(d.postUrl ?? '').trim()
  const email = String(d.email ?? '').trim().toLowerCase()

  if (!handle || !HANDLE.test(handle)) errors.handle = 'Please add your Instagram name, like @yourname.'
  if (postUrl && !INSTAGRAM.test(postUrl)) errors.postUrl = 'That should be a link to the post on Instagram.'
  if (email && !EMAIL.test(email)) errors.email = 'Please check the email address.'
  if (d.consent !== true) errors.consent = 'Please confirm we may share your photograph.'

  let format = ''
  const file = input.file
  if (!file?.data?.length) errors.file = 'Please choose a photograph.'
  else if ((file.size ?? file.data.length) > MAX_BYTES) errors.file = 'That photograph is over 12 MB — please send a smaller one.'
  else {
    const meta = await sharp(file.data).metadata().catch(() => null)
    format = meta?.format ? (FORMATS[meta.format] ?? '') : ''
    if (!meta || !format) errors.file = 'Please send a JPEG, PNG or WebP photograph.'
    else if (Math.min(meta.width ?? 0, meta.height ?? 0) < MIN_SIDE) errors.file = 'That photograph is too small to show well — please send a larger one.'
  }

  return Object.keys(errors).length ? { errors } : { errors, value: { caption, email, format, handle, postUrl } }
}

export const spottedSubmitEndpoint: Endpoint = {
  handler: async (req: PayloadRequest) => {
    await addDataAndFileToRequest(req)
    const { errors, value } = await checkSubmission({ data: (req.data ?? {}) as Record<string, unknown>, file: req.file as never })
    if (!value) return json({ errors }, 400)

    const device = deviceOf(req)
    if (device) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const recent = await req.payload.count({
        collection: 'spotted',
        overrideAccess: true,
        req,
        trash: true,
        where: { and: [{ ipHash: { equals: device } }, { createdAt: { greater_than: since } }] },
      })
      if (recent.totalDocs >= SPOTTED_PER_DEVICE_PER_DAY) return json({ errors: { file: 'Thank you — that is enough photographs from here for today.' } }, 429)
    }

    const file = req.file as unknown as { data: Buffer; mimetype: string; size: number }
    const media = await req.payload.create({
      collection: 'media',
      data: { alt: `Spotted — ${value.handle}, as sent in (awaiting approval)` },
      file: { data: file.data, mimetype: file.mimetype, name: `spotted-${Date.now()}.${value.format}`, size: file.size },
      overrideAccess: true,
      req,
    })
    try {
      await req.payload.create({
        collection: 'spotted',
        data: {
          caption: value.caption || undefined,
          consent: true,
          email: value.email || undefined,
          image: media.id,
          instagramHandle: value.handle,
          ipHash: device ?? undefined,
          postUrl: value.postUrl || undefined,
          status: 'pending',
          submitted: true,
        },
        overrideAccess: true,
        req,
      })
    } catch (error) {
      // Never leave an orphaned photograph behind.
      await req.payload.delete({ collection: 'media', id: media.id, overrideAccess: true, req }).catch(() => undefined)
      throw error
    }

    return json({ ok: true }, 201)
  },
  method: 'post',
  // On the Spotted collection: POST /api/spotted/submit.
  path: '/submit',
}
