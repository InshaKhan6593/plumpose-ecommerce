import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Endpoint,
  PayloadRequest,
} from 'payload'

import { createHmac, timingSafeEqual } from 'node:crypto'
// `.js`: the e2e suite loads the config as strict ESM, where `next/cache` alone does not resolve.
import { revalidatePath, revalidateTag } from 'next/cache.js'
import { after } from 'next/server.js'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * The storefront's content pages are prerendered at build time — `/`, `/faq`,
 * `/press`, `/spotted`, `/our-story`, `/shipping-returns` are all static in
 * the route table. Without this, an FAQ she edits, a review or Spotted post
 * she approves, a delivery fee or a price she changes would not appear on the
 * live site until the next deploy.
 *
 * Any change to a collection these pages read marks the whole storefront for
 * refresh (`revalidatePath('/', 'layout')`). It is not rebuilt there and then:
 * each page re-renders on its next visit. The shop is small and edits are
 * rare, so refreshing everything is cheaper than keeping a map of which page
 * reads which collection — a map that would silently go stale.
 *
 * **Why the refresh is sent a second time, as its own request.**
 * `revalidatePath` does not refresh anything when it is called: it stamps the
 * time and queues the refresh, which Next applies when the request finishes.
 * Payload runs this hook inside the database transaction, *before* the change
 * is committed. A page rebuilt in that moment — by any visit, or by a browser
 * prefetching the homepage from a product page — reads the old data, finishes
 * after the stamp, and is kept as current: the edit never shows. (The e2e
 * reviews check caught this: an approved review stayed off the homepage
 * until the next edit.) Calling `revalidatePath` again from `after()` does not
 * help — by then Next has already applied that request's queue.
 *
 * So once the response has been sent, and the change is certainly committed,
 * the server asks itself to refresh with a small request of its own
 * (POST /api/storefront/refresh, signed with a key derived from
 * PAYLOAD_SECRET). That request's queue is applied as it finishes. It asks
 * twice — at once, and again two seconds later: a rebuild that began before
 * the save can still be running at the first, and finish after it. Measured:
 * with the first alone the e2e reviews check passed 2 runs in 5.
 */

export type StorefrontRefresh = { layout?: boolean; tags?: string[] }

/** Long enough for a page rebuild begun before the save to finish, so the last refresh comes after it. */
const SETTLE_MS = 2000

/** The cache tags a refresh may clear — the two globals the storefront reads through a cache. */
const TAGS = new Set(['global_pageText', 'global_siteSettings'])

const refreshKey = () =>
  createHmac('sha256', process.env.PAYLOAD_SECRET || '')
    .update('plumpose storefront refresh')
    .digest('hex')

const apply = ({ layout, tags = [] }: StorefrontRefresh) => {
  for (const tag of tags) if (TAGS.has(tag)) revalidateTag(tag, { expire: 0 })
  if (layout) revalidatePath('/', 'layout')
}

/** This server's own address, as the request reached it — not NEXT_PUBLIC_SERVER_URL, which may name another. */
const originOf = (req: PayloadRequest): string => {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (!host) return getServerSideURL()
  const proto =
    req.headers.get('x-forwarded-proto')?.split(',')[0] ||
    (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * Refreshes the storefront for a change: at once, and again after the change
 * has committed, as a request of its own (see the note above). Returns false
 * outside a Next request (seed script, Local API from a CLI), where there is
 * no cache to clear.
 */
export const refreshStorefront = (req: PayloadRequest, what: StorefrontRefresh): boolean => {
  if (req.context?.disableRevalidate) return false
  try {
    apply(what)
  } catch {
    return false
  }
  const origin = originOf(req)
  const ask = async () => {
    const res = await fetch(`${origin}/api/storefront/refresh`, {
      body: JSON.stringify(what),
      headers: { 'Content-Type': 'application/json', 'X-Storefront-Refresh': refreshKey() },
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    }).catch((error: unknown) => error)
    if (!(res instanceof Response) || !res.ok) {
      req.payload.logger.warn(
        { err: res instanceof Response ? res.status : res },
        'Storefront refresh after the save failed.',
      )
    }
  }
  try {
    after(async () => {
      // Straight after the commit, and again a moment later for a rebuild that was already under way.
      await ask()
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
      await ask()
    })
  } catch {
    // No response to wait for (the Local API inside a server component): the refresh above stands.
  }
  return true
}

/** POST /api/storefront/refresh — the server's own after-commit refresh. Refused without the key. */
export const storefrontRefreshEndpoint: Endpoint = {
  handler: async (req) => {
    const given = req.headers.get('x-storefront-refresh') ?? ''
    const key = refreshKey()
    if (
      !process.env.PAYLOAD_SECRET ||
      given.length !== key.length ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(key))
    ) {
      return new Response(null, { status: 403 })
    }
    const body = ((await req.json?.().catch(() => null)) ?? {}) as StorefrontRefresh
    apply({
      layout: body.layout === true,
      tags: Array.isArray(body.tags) ? body.tags.filter((t) => TAGS.has(t)) : [],
    })
    return new Response(null, { status: 204 })
  },
  method: 'post',
  path: '/storefront/refresh',
}

const refresh = (req: PayloadRequest, slug: string) => {
  if (refreshStorefront(req, { layout: true })) {
    req.payload.logger.info(`storefront marked for refresh (${slug} changed)`)
  }
}

const afterChange: CollectionAfterChangeHook = ({ collection, doc, req }) => {
  refresh(req, collection.slug)
  return doc
}

const afterDelete: CollectionAfterDeleteHook = ({ collection, doc, req }) => {
  refresh(req, collection.slug)
  return doc
}

/** Adds the storefront refresh to a collection's hooks, keeping any it already has. */
export const withStorefrontRefresh = (
  hooks: CollectionConfig['hooks'] = {},
): CollectionConfig['hooks'] => ({
  ...hooks,
  afterChange: [...(hooks.afterChange ?? []), afterChange],
  afterDelete: [...(hooks.afterDelete ?? []), afterDelete],
})
