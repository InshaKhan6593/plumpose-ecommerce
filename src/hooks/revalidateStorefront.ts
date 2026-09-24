import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig } from 'payload'

// `.js`: the e2e suite loads the config as strict ESM, where `next/cache` alone does not resolve.
import { revalidatePath } from 'next/cache.js'

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
 */
const refresh = (context: Record<string, unknown>, logger: { info: (msg: string) => void }, slug: string) => {
  if (context.disableRevalidate) return
  try {
    revalidatePath('/', 'layout')
    logger.info(`storefront marked for refresh (${slug} changed)`)
  } catch {
    // Outside a Next request (seed script, Local API from a CLI) there is no cache to clear.
  }
}

const afterChange: CollectionAfterChangeHook = ({ collection, doc, req }) => {
  refresh(req.context, req.payload.logger, collection.slug)
  return doc
}

const afterDelete: CollectionAfterDeleteHook = ({ collection, doc, req }) => {
  refresh(req.context, req.payload.logger, collection.slug)
  return doc
}

/** Adds the storefront refresh to a collection's hooks, keeping any it already has. */
export const withStorefrontRefresh = (hooks: CollectionConfig['hooks'] = {}): CollectionConfig['hooks'] => ({
  ...hooks,
  afterChange: [...(hooks.afterChange ?? []), afterChange],
  afterDelete: [...(hooks.afterDelete ?? []), afterDelete],
})
