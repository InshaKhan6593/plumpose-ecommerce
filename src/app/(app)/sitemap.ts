/* eslint-disable no-restricted-exports */
import type { MetadataRoute } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'
import { isPlaceholderSlug } from '@/utilities/placeholders'

/**
 * /sitemap.xml (REQUIREMENTS N3): every page a search engine should find —
 * the fixed pages, and every *published* product, Made for You commission and
 * extra page, with when it last changed (a fixed page: the newest change to
 * what it shows). Drafts, orders, accounts and checkout
 * are never listed (robots.ts keeps crawlers out of those too), nor is the
 * demo catalogue or a sample project (`isPlaceholderSlug`).
 *
 * Rebuilt at most hourly, and whenever the storefront refreshes after an edit.
 */
export const revalidate = 3600

const FIXED = [
  '',
  '/shop',
  '/our-story',
  '/made-for-you',
  '/faq',
  '/shipping-returns',
  '/fabric-care',
  '/size-guide',
  '/terms',
  '/privacy',
  '/press',
  '/spotted',
  '/contact',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerSideURL().replace(/\/$/, '')
  const payload = await getPayload({ config: configPromise })

  /** When a collection's newest public record changed — for the pages that show it. */
  const newest = async (
    collection: 'faqs' | 'press' | 'shippingCities' | 'shippingZones' | 'spotted',
  ) =>
    (
      await payload
        .find({
          collection,
          depth: 0,
          limit: 1,
          overrideAccess: false,
          select: { updatedAt: true },
          sort: '-updatedAt',
        })
        .catch(() => ({ docs: [] as { updatedAt?: string }[] }))
    ).docs[0]?.updatedAt

  const [products, projects, pages, settings, pageText, faqs, press, spotted, cities, zones] =
    await Promise.all([
      payload.find({
        collection: 'products',
        depth: 0,
        limit: 1000,
        overrideAccess: false,
        pagination: false,
        select: { slug: true, updatedAt: true },
        where: { _status: { equals: 'published' } },
      }),
      payload.find({
        collection: 'projects',
        depth: 0,
        limit: 1000,
        overrideAccess: false,
        pagination: false,
        select: { slug: true, updatedAt: true },
        where: { published: { equals: true } },
      }),
      payload.find({
        collection: 'pages',
        depth: 0,
        limit: 1000,
        overrideAccess: false,
        pagination: false,
        select: { slug: true, updatedAt: true },
        where: { _status: { equals: 'published' } },
      }),
      payload.findGlobal({ depth: 0, slug: 'siteSettings' }).catch(() => null),
      payload.findGlobal({ depth: 0, slug: 'pageText' }).catch(() => null),
      newest('faqs'),
      newest('press'),
      newest('spotted'),
      newest('shippingCities'),
      newest('shippingZones'),
    ])

  const entry = (
    path: string,
    lastModified?: string,
    priority = 0.6,
  ): MetadataRoute.Sitemap[number] => ({
    changeFrequency: 'weekly',
    lastModified: lastModified ? new Date(lastModified) : undefined,
    priority,
    url: `${base}${path}`,
  })

  /** The latest of several dates (ISO strings), or undefined when none is known. */
  const latest = (...dates: (null | string | undefined)[]) =>
    dates
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1)

  const newestProduct = latest(...products.docs.map((p) => p.updatedAt))
  const newestProject = latest(...projects.docs.map((p) => p.updatedAt))
  const words = pageText?.updatedAt // null until Page text is first saved (the defaults are in the code)
  const setup = settings?.updatedAt

  /*
   * A fixed page's date is the newest change to what it shows. Pages whose
   * words live only in the code (care, size guide, terms, privacy) carry no
   * date rather than a made-up one — a deploy is not a change to them.
   */
  const fixedDate: Record<string, string | undefined> = {
    '': latest(words, setup, newestProduct),
    '/contact': latest(setup),
    // Not the settings date: a change to the returns days re-dates the FAQs it rewrites.
    '/faq': latest(faqs),
    '/made-for-you': latest(words, newestProject),
    '/our-story': latest(words),
    '/press': latest(press),
    '/shipping-returns': latest(words, setup, cities, zones),
    '/shop': latest(newestProduct),
    '/spotted': latest(spotted),
  }

  return [
    ...FIXED.map((path) =>
      entry(path, fixedDate[path], path === '' ? 1 : path === '/shop' ? 0.9 : 0.6),
    ),
    ...products.docs
      .filter((p) => p.slug && !isPlaceholderSlug(p.slug))
      .map((p) => entry(`/products/${p.slug}`, p.updatedAt, 0.8)),
    ...projects.docs
      .filter((p) => p.slug && !isPlaceholderSlug(p.slug))
      .map((p) => entry(`/made-for-you/${p.slug}`, p.updatedAt, 0.5)),
    // The homepage is the "home" page in the template's Pages; it is already listed.
    ...pages.docs
      .filter((p) => p.slug && p.slug !== 'home')
      .map((p) => entry(`/${p.slug}`, p.updatedAt, 0.4)),
  ]
}
