import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { mergePageText, type PageCopy } from './pageTextSchema'

/**
 * The storefront's words: hers from Page text over the defaults in
 * content.ts / pages.ts (REQUIREMENTS S1, A18). Cached under the global's tag,
 * which a save clears (globals/PageText.ts).
 */
export const getPageText = unstable_cache(
  async (): Promise<PageCopy & { featuredProductId: null | number }> => {
    const payload = await getPayload({ config: configPromise })
    const stored = (await payload.findGlobal({ depth: 0, slug: 'pageText' }).catch(() => null)) as null | Record<string, unknown>
    const featured = (stored?.home as { featuredProduct?: null | number | { id: number } } | undefined)?.featuredProduct
    return {
      ...mergePageText(stored),
      featuredProductId: typeof featured === 'object' && featured ? featured.id : (featured ?? null),
    }
  },
  ['pageText'],
  { tags: ['global_pageText'] },
)
