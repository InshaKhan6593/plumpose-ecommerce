/* eslint-disable no-restricted-exports */
import type { MetadataRoute } from 'next'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * /robots.txt. The site's own address (NEXT_PUBLIC_SERVER_URL, the live
 * domain) — not Vercel's per-deployment preview URL, which the template used
 * and which would have pointed search engines at a throwaway address. Private
 * pages are kept out: the admin, the API, checkout, accounts and orders.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getServerSideURL().replace(/\/$/, '')
  return {
    host: base,
    rules: [
      {
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/checkout',
          '/account',
          '/orders',
          '/order/',
          '/login',
          '/create-account',
          '/forgot-password',
          '/reset-password',
          '/logout',
          '/find-order',
          '/next/',
        ],
        userAgent: '*',
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
