import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import type { Category, Media, Product } from '@/payload-types'

import { HOME_MEDIA, type HomeMediaKey, TEST_MEDIA } from '@/components/home/content'
import { HomeHero } from '@/components/home/HomeHero'
import { ProductBand, ReviewsBand, SpottedBand } from '@/components/home/HomeSections'
import { MadeSteps, type Step } from '@/components/home/MadeSteps'
import { Philosophy } from '@/components/home/Philosophy'
import { type PrintFact, PrintBand } from '@/components/home/PrintBand'
import { deliveryRange } from '@/lib/pricing/deliveryRange'
import { formatQar } from '@/lib/pricing/money'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { getPageText } from '@/content/getPageText'

export const metadata: Metadata = {
  description:
    'Silk sleepwear with a hand-drawn whale-shark print, hand-finished to order in Doha. Personalised with hand embroidery.',
  title: 'plumpose — silk nightwear, hand-finished to order',
}

/**
 * The homepage, after the client's reference recording
 * (brand-assets/reference/client-reference-animation.mov) — five moves:
 *
 *   1. hero — the film full-screen, the header over it, a framed detail
 *   2. curtain — the next section slides up over the hero
 *   3. philosophy — her words hold the centre while photographs drift past
 *   4. The Print — a card that opens to fill the screen, with her facts
 *   5. made for you — a pinned sequence, 01 → 04
 *
 * then the piece itself, and reviews / Spotted once there are approved ones.
 * Every figure on the page comes from the database.
 */
export default async function HomePage() {
  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()
  const { featuredProductId, HOME: copy } = await getPageText()

  const [media, products, reviews, spotted, threads, range] = await Promise.all([
    payload.find({
      collection: 'media',
      depth: 0,
      limit: 30,
      pagination: false,
      where: { filename: { in: [...Object.values(HOME_MEDIA), ...Object.values(TEST_MEDIA)] } },
    }),
    // The piece she features (Page text → Homepage), else the first in the shop.
    payload.find({
      collection: 'products',
      depth: 1,
      limit: 1,
      populate: { variants: { priceInQAR: true } },
      sort: ['_order', 'createdAt'],
      where: {
        and: [
          { _status: { equals: 'published' } },
          ...(featuredProductId ? [{ id: { equals: featuredProductId } }] : []),
        ],
      },
    }),
    // Featured first (she ticks "Feature on the homepage"), then the newest.
    payload.find({
      collection: 'reviews',
      depth: 0,
      limit: 3,
      overrideAccess: false,
      sort: ['-featured', '-createdAt'],
      where: { status: { equals: 'approved' } },
    }),
    payload.find({
      collection: 'spotted',
      depth: 1,
      limit: 4,
      sort: '-createdAt',
      where: { status: { equals: 'approved' } },
    }),
    payload.count({
      collection: 'personalisationOptions',
      where: { and: [{ type: { equals: 'thread' } }, { active: { not_equals: false } }] },
    }),
    deliveryRange(payload, settings),
  ])

  const byFile = new Map(media.docs.map((doc) => [doc.filename, doc as Media]))
  /** Test shots win while TEST_SHOTS=on (docs/TEST-SHOTS.md); the real photograph otherwise. */
  const testing = process.env.TEST_SHOTS === 'on'
  const image = (key: HomeMediaKey) =>
    (testing && TEST_MEDIA[key] ? byFile.get(TEST_MEDIA[key]) : undefined) ??
    byFile.get(HOME_MEDIA[key])

  // Her featured piece; if it has since been unpublished, the first in the shop, so the band never disappears.
  const product = (products.docs[0] ??
    (featuredProductId
      ? (
          await payload.find({
            collection: 'products',
            depth: 1,
            limit: 1,
            populate: { variants: { priceInQAR: true } },
            sort: ['_order', 'createdAt'],
            where: { _status: { equals: 'published' } },
          })
        ).docs[0]
      : undefined)) as Product | undefined
  const productHref = product ? `/products/${product.slug}` : '/shop'
  const variantPrices = (product?.variants?.docs ?? [])
    .map((v) => (typeof v === 'object' ? v.priceInQAR : null))
    .filter((p): p is number => typeof p === 'number')
  const priceMinor = variantPrices.length ? Math.min(...variantPrices) : (product?.priceInQAR ?? 0)
  const category = product?.categories?.find(
    (c): c is Category => typeof c === 'object' && c !== null,
  )

  // ---- facts, all from her settings and tables ----
  const leadTime = settings.personalisationLeadTime ?? null // e.g. "4–10 working days"
  const leadMatch = leadTime?.match(/^\s*([\d–-]+)\s*(.*)$/)
  const facts: PrintFact[] = [
    ...(leadMatch
      ? [{ label: `${leadMatch[2] || 'days'} to hand-finish`, value: leadMatch[1] }]
      : []),
    ...(threads.totalDocs
      ? [{ label: 'Embroidery thread colours', value: String(threads.totalDocs) }]
      : []),
  ]

  const fee = settings.personalisationFeeQar
  const steps: Step[] = [
    {
      body: 'S, M or L — cut in the signature plumpose silhouette, with long trousers designed for a graceful drape.',
      image: image('window'),
      title: 'Choose your size',
    },
    {
      body: [
        'Initials or a symbol, stitched by hand',
        threads.totalDocs ? ` in one of ${threads.totalDocs} thread colours` : '',
        fee ? `. From QAR ${fee}.` : '.',
      ].join(''),
      image: image('piping'),
      title: 'Add hand embroidery',
    },
    {
      body: `Each piece is hand-finished to order in Doha${leadTime ? ` — embroidered pieces in ${leadTime}` : ''}.`,
      image: image('armchair'),
      title: 'Hand-finished in Doha',
    },
    {
      body: [
        range.qatarLow !== null ? `Across Qatar from ${formatQar(range.qatarLow)}` : 'Across Qatar',
        range.intlLow !== null ? `, and worldwide from ${formatQar(range.intlLow)}.` : '.',
      ].join(''),
      image: image('qatarBook'),
      title: 'Delivered to you',
    },
  ]

  return (
    <>
      {/*
        The curtain: the hero is pinned beneath, and the philosophy section
        slides up over it. The wrapper ends with that section, so the hero
        lets go once it is fully covered.
      */}
      <div className="relative">
        <div className="sticky top-0">
          <HomeHero
            copy={copy.hero}
            ctaHref={productHref}
            detail={image('print')}
            films={{
              desktop: { mp4: '/video/hero-wide.mp4', poster: '/video/hero-wide-poster.jpg' },
              mobile: { mp4: '/video/hero-mobile.mp4', poster: '/video/hero-mobile-poster.jpg' },
            }}
          />
        </div>
        <Philosophy
          copy={copy.philosophy}
          images={{
            corridor: image('corridor'),
            piping: image('piping'),
            print: image('print'),
            qatarBook: image('qatarBook'),
          }}
        />
      </div>

      <PrintBand copy={copy.print} facts={facts} href="/our-story" image={image('print')} />

      <MadeSteps copy={copy.steps} steps={steps} />

      {product ? (
        <ProductBand
          categoryTitle={category?.title ?? null}
          href={productHref}
          image={image('window')}
          priceMinor={priceMinor}
          wasMinor={product.compareAtPriceInQAR}
          title={product.title}
        />
      ) : null}

      <ReviewsBand reviews={reviews.docs.map(({ body, id, name }) => ({ body, id, name }))} />

      <SpottedBand
        handle={settings.instagramHandle ?? null}
        instagramUrl={settings.instagramUrl ?? null}
        items={spotted.docs}
      />
    </>
  )
}
