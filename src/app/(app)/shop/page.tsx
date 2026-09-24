import type { Metadata } from 'next'
import type { Where } from 'payload'

import configPromise from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import type { Category, Media as MediaType, Product } from '@/payload-types'

import { Media } from '@/components/Media'
import { ProductCard } from '@/components/shop/ProductCard'
import { Reveal, RevealImage } from '@/motion/Reveal'
import { cn } from '@/utilities/cn'
import { getCachedGlobal } from '@/utilities/getGlobals'

export const metadata: Metadata = {
  description: 'Silk sleepwear, hand-finished to order in Doha.',
  title: 'Shop',
}

/**
 * The only sorts offered. The template passed `?sort=` straight to the
 * database, so any field name in the URL became a sort; now it must be one of
 * these three or it is ignored.
 */
const SORTS = {
  newest: { label: 'Newest', sort: '-createdAt' },
  'price-asc': { label: 'Price, low to high', sort: 'priceInQAR' },
  'price-desc': { label: 'Price, high to low', sort: '-priceInQAR' },
} as const
type SortKey = keyof typeof SORTS

type Props = { searchParams: Promise<{ collection?: string; q?: string; sort?: string }> }

/**
 * The shop (docs/SCREEN-PROMPTS 05): a heading, a filter row of the real
 * collections, and the grid — each piece on warm paper, the second photograph
 * on hover. While the catalogue is small, an editorial tile for the hand
 * embroidery sits beside it, so one piece reads as curated rather than sparse.
 */
export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 80)
  const sortKey = (params.sort && params.sort in SORTS ? params.sort : null) as null | SortKey
  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()

  const categories = (
    await payload.find({ collection: 'categories', depth: 0, limit: 50, pagination: false, sort: 'title' })
  ).docs as Category[]
  const active = categories.find((c) => c.slug === params.collection) ?? null

  const where: Where = {
    and: [
      { _status: { equals: 'published' } },
      ...(active ? [{ categories: { contains: active.id } }] : []),
      /*
       * Plain-text fields only. The template also searched `description`, but
       * that is rich text stored as JSON, and Postgres cannot `ilike` JSON —
       * every search failed with "operator does not exist: jsonb ~~* unknown".
       */
      ...(q
        ? [
            {
              or: [
                { title: { like: q } },
                { fabric: { like: q } },
                { colour: { like: q } },
                { composition: { like: q } },
              ],
            },
          ]
        : []),
    ],
  }

  const [products, tileImage] = await Promise.all([
    payload.find({
      collection: 'products',
      depth: 1,
      draft: false,
      limit: 48,
      overrideAccess: false,
      populate: { variants: { inventory: true, priceInQAR: true } },
      sort: sortKey ? SORTS[sortKey].sort : ['_order', 'createdAt'],
      where,
    }),
    payload.find({ collection: 'media', depth: 0, limit: 1, where: { filename: { equals: 'brand-05-armchair.jpg' } } }),
  ])

  const docs = products.docs as Product[]
  const embroideryHost = docs.find((p) => p.personalisationEnabled)
  const showTile = !q && Boolean(embroideryHost) && Boolean(settings.personalisationFeeQar)
  const tile = tileImage.docs[0] as MediaType | undefined

  /** Builds a shop URL that keeps the other filters. */
  const href = (next: { collection?: null | string; sort?: null | string }) => {
    const query = new URLSearchParams()
    const collection = next.collection === undefined ? active?.slug : next.collection
    const sort = next.sort === undefined ? sortKey : next.sort
    if (collection) query.set('collection', collection)
    if (sort) query.set('sort', sort)
    if (q) query.set('q', q)
    const s = query.toString()
    return s ? `/shop?${s}` : '/shop'
  }

  return (
    <div className="mx-auto max-w-[90rem] px-4 pt-14 md:px-7 md:pt-20">
      <Reveal className="text-center">
        <h1 className="serif-display text-[clamp(3rem,6vw,5.5rem)]" data-reveal-lines>
          {q ? `“${q}”` : (active?.title ?? 'The collection')}
        </h1>
        <p className="serif-italic mt-4 text-lg text-ink-soft md:text-xl" data-reveal>
          {q
            ? `${docs.length} ${docs.length === 1 ? 'piece' : 'pieces'} found`
            : 'Silk, hand-finished to order in Doha'}
        </p>
      </Reveal>

      {/* Filter row: collections left; search and sort right. */}
      <div className="mt-12 flex flex-col gap-5 border-y border-line py-4 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Collections" className="flex flex-wrap gap-x-7 gap-y-2">
          {[{ slug: null, title: 'All' }, ...categories].map((c) => {
            const selected = (c.slug ?? null) === (active?.slug ?? null)
            return (
              <Link
                aria-current={selected ? 'page' : undefined}
                className={cn('caps text-[0.625rem]', selected ? 'text-ink underline underline-offset-[6px]' : 'text-ink-soft hover:text-ink')}
                href={href({ collection: c.slug ?? null })}
                key={c.slug ?? 'all'}
              >
                {c.title}
              </Link>
            )
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          <form action="/shop" className="flex items-center gap-2 border-b border-line focus-within:border-ink" role="search">
            <label className="sr-only" htmlFor="shop-search">
              Search the shop
            </label>
            <input
              className="caps w-36 border-0 bg-transparent px-0 py-1 text-[0.625rem] placeholder:text-ink-soft focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
              defaultValue={q}
              id="shop-search"
              name="q"
              placeholder="Search"
              type="search"
            />
          </form>
          <nav aria-label="Sort" className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.keys(SORTS) as SortKey[]).map((key) => (
              <Link
                aria-current={sortKey === key ? 'true' : undefined}
                className={cn('caps text-[0.625rem]', sortKey === key ? 'text-ink underline underline-offset-[6px]' : 'text-ink-soft hover:text-ink')}
                href={href({ sort: sortKey === key ? null : key })}
                key={key}
              >
                {SORTS[key].label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {docs.length ? (
        <Reveal className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
          {docs.map((product, index) => (
            <React.Fragment key={product.id}>
              <div data-reveal>
                <ProductCard priority={index < 3} product={product} />
              </div>

              {/* After the first piece: the embroidery, as an editorial tile. */}
              {index === 0 && showTile && embroideryHost ? (
                <Link className="group relative block" data-reveal href={`/products/${embroideryHost.slug}#personalisation`}>
                  <RevealImage className="relative aspect-[4/5] overflow-hidden bg-paper-3">
                    {tile ? (
                      <Media
                        className="absolute inset-0 transition-transform duration-[900ms] ease-brand [@media(hover:hover)]:group-hover:scale-[1.03]"
                        fill
                        imgClassName="object-cover"
                        resource={tile}
                        size="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                      />
                    ) : null}
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/5 to-transparent" />
                    <div className="absolute inset-x-6 bottom-7 text-white">
                      <p className="caps text-[0.625rem]">Hand embroidery</p>
                      <p className="serif-display mt-3 text-[2rem] leading-[1.05]">Your initials, stitched by hand</p>
                      <p className="mt-3 text-sm text-white/85">From QAR {settings.personalisationFeeQar} · on any piece</p>
                    </div>
                  </RevealImage>
                </Link>
              ) : null}
            </React.Fragment>
          ))}
        </Reveal>
      ) : (
        <div className="mx-auto max-w-md py-24 text-center">
          <p className="serif-display text-3xl">Nothing matches that — yet.</p>
          <Link className="caps mt-8 inline-block border-b border-ink pb-1 text-[0.625rem]" href="/shop">
            See the whole collection
          </Link>
        </div>
      )}
    </div>
  )
}
