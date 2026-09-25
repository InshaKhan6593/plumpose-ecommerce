import type { GlobalAfterChangeHook, GlobalConfig } from 'payload'

// `.js`: the e2e suite loads this config as strict ESM, where `next/cache` alone does not resolve.
import { revalidatePath, revalidateTag } from 'next/cache.js'

import { adminOnly } from '@/access/adminOnly'
import { pageTextTabs } from '@/content/pageTextSchema'

/**
 * Most of these pages are prerendered and read the text through a cache tag,
 * so a save clears both: her words are live on the next page load.
 */
const refreshPages: GlobalAfterChangeHook = ({ doc, req }) => {
  if (!req.context?.disableRevalidate) {
    try {
      revalidateTag('global_pageText', { expire: 0 })
      revalidatePath('/', 'layout')
    } catch {
      // Outside a Next request (seed script, Local API) there is no cache to clear.
    }
  }
  return doc
}

/**
 * "Page text" — the words on the homepage and the content pages, hers to
 * change (REQUIREMENTS S1, A18). Every field starts filled with today's text;
 * one she empties goes back to it. The fields come from
 * src/content/pageTextSchema.ts.
 */
export const PageText: GlobalConfig = {
  slug: 'pageText',
  label: 'Page text',
  admin: {
    description: 'The words on the homepage and the other pages. Prices, fees and delivery times come from their own settings, not from here.',
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: adminOnly,
  },
  hooks: { afterChange: [refreshPages] },
  fields: [
    {
      type: 'tabs',
      tabs: pageTextTabs({
        home: [
          {
            name: 'featuredProduct',
            type: 'relationship',
            admin: { description: 'The piece the homepage shows and links to. Leave empty for the first piece in the shop.' },
            filterOptions: { _status: { equals: 'published' } },
            label: 'Featured piece',
            relationTo: 'products',
          },
        ],
      }),
    },
  ],
}
