/* eslint-disable no-restricted-exports */
import type { MetadataRoute } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * /sitemap.xml (REQUIREMENTS N3): every page a search engine should find —
 * the fixed pages, and every *published* product, Made for You commission and
 * extra page, with when it last changed. Drafts, orders, accounts and checkout
 * are never listed (robots.ts keeps crawlers out of those too).
 *
 * Rebuilt at most hourly, and whenever the storefront refreshes after an edit.
 */
export const revalidate = 3600

const FIXED = ['', '/shop', '/our-story', '/made-for-you', '/faq', '/shipping-returns', '/press', '/spotted', '/contact']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerSideURL().replace(/\/$/, '')
  const payload = await getPayload({ config: configPromise })

  const [products, projects, pages] = await Promise.all([
    payload.find({ collection: 'products', depth: 0, limit: 1000, overrideAccess: false, pagination: false, select: { slug: true, updatedAt: true }, where: { _status: { equals: 'published' } } }),
    payload.find({ collection: 'projects', depth: 0, limit: 1000, overrideAccess: false, pagination: false, select: { slug: true, updatedAt: true }, where: { published: { equals: true } } }),
    payload.find({ collection: 'pages', depth: 0, limit: 1000, overrideAccess: false, pagination: false, select: { slug: true, updatedAt: true }, where: { _status: { equals: 'published' } } }),
  ])

  const entry = (path: string, lastModified?: string, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    changeFrequency: 'weekly',
    lastModified: lastModified ? new Date(lastModified) : undefined,
    priority,
    url: `${base}${path}`,
  })

  return [
    ...FIXED.map((path) => entry(path, undefined, path === '' ? 1 : path === '/shop' ? 0.9 : 0.6)),
    ...products.docs.filter((p) => p.slug).map((p) => entry(`/products/${p.slug}`, p.updatedAt, 0.8)),
    ...projects.docs.filter((p) => p.slug).map((p) => entry(`/made-for-you/${p.slug}`, p.updatedAt, 0.5)),
    // The homepage is the "home" page in the template's Pages; it is already listed.
    ...pages.docs.filter((p) => p.slug && p.slug !== 'home').map((p) => entry(`/${p.slug}`, p.updatedAt, 0.4)),
  ]
}
