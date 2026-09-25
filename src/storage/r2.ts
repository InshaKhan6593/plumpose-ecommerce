import type { Plugin } from 'payload'

import { s3Storage } from '@payloadcms/storage-s3'

/**
 * Where uploaded photographs live.
 *
 * Locally they are written to `public/media`. A serverless host has no disk
 * that survives a deploy, so there they go to Cloudflare R2 instead — switched
 * on with `MEDIA_STORAGE=r2` and the four `R2_*` keys.
 *
 * The switch is explicit rather than following NODE_ENV: a production build
 * run on this machine (`plumpose-prod`) must keep reading the local files,
 * and a stray `.env` key must never send local test uploads to the live bucket.
 *
 * The bucket stays **private**. Photos are served through Payload as
 * `/api/media/file/<name>` — the same address as locally, so nothing in the
 * storefront changes — and Next resizes and caches them, so R2 is read once
 * per photo and size, not once per visitor. A public R2 address would need
 * plumpose.com's DNS on Cloudflare, and it is on Squarespace.
 *
 * Films are not uploads: they are copied from the same bucket into the build
 * (`scripts/films.ts`) and served by the host's CDN.
 */

export type R2Config = {
  accessKeyId: string
  accountId: string
  bucket: string
  /**
   * A bucket created under a data jurisdiction (`eu`) has its own endpoint,
   * `<account>.eu.r2.cloudflarestorage.com`. Empty for an ordinary bucket.
   */
  jurisdiction: string
  secretAccessKey: string
}

export const r2Config = (): null | R2Config => {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? ''
  const bucket = process.env.R2_BUCKET?.trim() ?? ''
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? ''
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? ''
  const jurisdiction = (process.env.R2_JURISDICTION?.trim().toLowerCase() ?? '').replace(
    /[^a-z]/g,
    '',
  )
  return accountId && bucket && accessKeyId && secretAccessKey
    ? { accessKeyId, accountId, bucket, jurisdiction, secretAccessKey }
    : null
}

/** The S3 client settings R2 needs: its own endpoint, and region `auto`. */
export const r2ClientConfig = (config: R2Config) => ({
  credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  endpoint: `https://${config.accountId}.${config.jurisdiction ? `${config.jurisdiction}.` : ''}r2.cloudflarestorage.com`,
  region: 'auto',
})

/** Photographs under `media/`, films under `video/`, in the one bucket. */
export const MEDIA_PREFIX = 'media'
export const VIDEO_PREFIX = 'video'

export const isR2MediaEnabled = (): boolean =>
  process.env.MEDIA_STORAGE?.trim().toLowerCase() === 'r2'

/**
 * Always registered, switched on or off. The plugin adds a `prefix` field to
 * Media only while it is on; `alwaysInsertFields` adds it either way, so the
 * local schema and the live one — built from the same migrations — match.
 */
export const mediaStorage = (): Plugin[] => {
  const enabled = isR2MediaEnabled()
  const config = r2Config()

  if (enabled && !config) {
    throw new Error(
      'MEDIA_STORAGE=r2 but R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY is missing.',
    )
  }

  return [
    s3Storage({
      alwaysInsertFields: true,
      bucket: config?.bucket ?? '',
      collections: {
        media: {
          prefix: MEDIA_PREFIX,
          /**
           * `/api/media/file/<name>` answers with a redirect to a signed R2
           * link (valid an hour) rather than streaming the file through
           * Payload. Next's optimiser gives an upstream photo 7 seconds, fixed;
           * streamed through Payload, a page asking for ~40 at once (the shop)
           * ran past that, fetched directly they arrive in about half a second.
           * The bucket stays private: each link is signed, and expires.
           */
          signedDownloads: { expiresIn: 3600 },
        },
      },
      config: config ? r2ClientConfig(config) : {},
      enabled,
    }),
  ]
}
