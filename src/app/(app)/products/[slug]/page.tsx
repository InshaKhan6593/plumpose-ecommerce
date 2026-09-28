import type { Category, Media, Product, Review, Variant } from '@/payload-types'

import configPromise from '@payload-config'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { FabricBlock } from '@/components/editorial/FabricBlock'
import type { EmbroideryOption, EmbroideryRules } from '@/components/product/embroidery'
import { ProductGallery } from '@/components/product/ProductGallery'
import { type ProductDetail, ProductInfo } from '@/components/product/ProductInfo'
import { ProductReviews } from '@/components/product/ProductReviews'
import { averageRating } from '@/components/product/Stars'
import { FABRIC } from '@/content/pages'
import { deliveryRange } from '@/lib/pricing/deliveryRange'
import { formatQar, toMajor, toMinor } from '@/lib/pricing/money'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { getServerSideURL } from '@/utilities/getURL'
import { loadPageMedia } from '@/utilities/pageMedia'
import { isPlaceholderSlug } from '@/utilities/placeholders'
import { clip, plainText } from '@/utilities/plainText'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const product = await queryProductBySlug(slug)

  if (!product) return notFound()

  const gallery = product.gallery?.filter((item) => typeof item.image === 'object') || []

  const metaImage = typeof product.meta?.image === 'object' ? product.meta?.image : undefined
  // The demo catalogue is never indexed, even while it is loaded (BUILD-LOG §24).
  const canIndex = product._status === 'published' && !isPlaceholderSlug(slug)

  const seoImage = metaImage || (gallery.length ? (gallery[0]?.image as Media) : undefined)

  return {
    alternates: { canonical: `/products/${slug}` },
    description: metaDescription(product),
    openGraph: seoImage?.url
      ? {
          images: [
            {
              alt: seoImage?.alt,
              height: seoImage.height!,
              url: seoImage?.url,
              width: seoImage.width!,
            },
          ],
        }
      : null,
    robots: {
      follow: canIndex,
      googleBot: {
        follow: canIndex,
        index: canIndex,
      },
      index: canIndex,
    },
    title: product.meta?.title || product.title,
  }
}

/**
 * The product page (docs/mockups/06-product-page.webp): the photo stack on
 * the left, everything needed to choose and buy on the right, sticky.
 */
export default async function ProductPage({ params }: Args) {
  const { slug } = await params
  const product = await queryProductBySlug(slug)

  if (!product) return notFound()

  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()

  // Independent reads, in parallel rather than one after another.
  const [details, embroideryDocs, reviewDocs, pick] = await Promise.all([
    productDetails({ payload, product, settings }),
    product.personalisationEnabled
      ? payload.find({
          collection: 'personalisationOptions',
          depth: 0,
          limit: 100,
          pagination: false,
          sort: ['_order', 'createdAt'],
          where: { active: { not_equals: false } },
        })
      : null,
    // Approved only: read without admin rights, so the collection's own access decides.
    payload.find({
      collection: 'reviews',
      depth: 0,
      limit: 100,
      overrideAccess: false,
      pagination: false,
      sort: '-createdAt',
      where: { and: [{ product: { equals: product.id } }, { status: { equals: 'approved' } }] },
    }),
    loadPageMedia(payload),
  ])
  const reviews = reviewDocs.docs as Review[]
  const average = averageRating(reviews.map((r) => r.rating))

  const images =
    product.gallery
      ?.map((item) => item.image)
      .filter((image): image is Media => Boolean(image) && typeof image === 'object') ?? []

  const category = product.categories?.find(
    (entry): entry is Category => typeof entry === 'object' && entry !== null,
  )

  /**
   * Embroidery options in the order she arranges them in the admin, then by
   * when they were added (the seeded ones carry no order yet). Only the fields
   * the drawer shows are sent — no internal notes, nothing priced.
   */
  const embroideryOptions: EmbroideryOption[] = embroideryDocs
    ? embroideryDocs.docs.map(({ hex, key, name, note, svgPath, type }) => ({
        hex,
        key,
        name,
        note,
        svgPath,
        type,
      }))
    : []

  const embroideryRules: EmbroideryRules | null = settings.personalisationFeeQar
    ? {
        feeQar: settings.personalisationFeeQar,
        leadTime: settings.personalisationLeadTime ?? null,
        maxChars: settings.personalisationMaxChars ?? 6,
        maxPlacements: settings.personalisationMaxPlacements ?? 2,
        returnable: Boolean(settings.personalisationReturnable),
      }
    : null

  const variants = (product.variants?.docs ?? []).filter(
    (variant) => typeof variant === 'object' && variant !== null,
  )
  const hasStock = product.enableVariants
    ? variants.some((variant) => typeof variant === 'object' && (variant.inventory ?? 0) > 0)
    : (product.inventory ?? 0) > 0
  const prices = variants
    .map((variant) => (typeof variant === 'object' ? variant.priceInQAR : null))
    .filter((price): price is number => typeof price === 'number')
  const price = prices.length ? Math.min(...prices) : (product.priceInQAR ?? 0)

  /**
   * Structured data for search engines. Money is stored in minor units, so it
   * is converted here — the template sent `139900` in `usd`, which Google would
   * read as a hundred and forty thousand dollars.
   *
   * A piece in sizes is a ProductGroup with one Product per size, each with its
   * own stock, so a search result can say which sizes are available. Delivery
   * fees vary by Qatari city, which Offer markup cannot express, so they are
   * left to Merchant Center's shipping settings rather than stated wrongly here.
   */
  const pageUrl = `${getServerSideURL()}/products/${product.slug}`
  // The full text for structured data; only the meta description is kept short.
  const description = product.meta?.description || plainText(product.description)
  const availability = (inStock: boolean) =>
    inStock || product.madeToOrder ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
  const offer = (priceMinor: number, inStock: boolean) => ({
    '@type': 'Offer',
    availability: availability(inStock),
    hasMerchantReturnPolicy: { ...RETURN_POLICY, merchantReturnDays: settings.returnWindowDays ?? 14 },
    price: toMajor(priceMinor).toFixed(2),
    priceCurrency: 'QAR',
    url: pageUrl,
  })
  const shared = {
    brand: { '@type': 'Brand', name: 'plumpose' },
    ...(description ? { description } : {}),
    // Absolute: Google refuses a relative image in structured data.
    image: images
      .map((image) => image.url)
      .filter((url): url is string => Boolean(url))
      .map((url) => new URL(url, getServerSideURL()).href),
    ...(product.colour ? { color: product.colour } : {}),
    ...(product.composition ? { material: product.composition } : {}),
    // Approved reviews only, so the stars a search result shows are real ones.
    ...(average !== null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: average,
            reviewCount: reviews.length,
          },
          review: reviews.slice(0, 5).map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.name },
            reviewBody: r.body,
            reviewRating: { '@type': 'Rating', ratingValue: r.rating },
          })),
        }
      : {}),
  }
  const sized = product.enableVariants
    ? variants.filter((variant): variant is Variant => typeof variant === 'object')
    : []
  const productJsonLd = sized.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ProductGroup',
        ...shared,
        hasVariant: sized.map((variant) => {
          const size = optionLabels(variant)
          return {
            '@type': 'Product',
            name: size ? `${product.title} — ${size}` : product.title,
            ...(size ? { size } : {}),
            offers: offer(variant.priceInQAR ?? price, (variant.inventory ?? 0) > 0),
          }
        }),
        name: product.title,
        productGroupID: product.slug,
        url: pageUrl,
        variesBy: 'https://schema.org/size',
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Product',
        ...shared,
        name: product.title,
        offers: offer(price, hasStock),
        url: pageUrl,
      }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', item: `${getServerSideURL()}/`, name: 'Home', position: 1 },
      { '@type': 'ListItem', item: `${getServerSideURL()}/shop`, name: 'Shop', position: 2 },
      { '@type': 'ListItem', item: pageUrl, name: product.title, position: 3 },
    ],
  }

  return (
    <>
      {[productJsonLd, breadcrumbJsonLd].map((data, i) => (
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
          key={i}
          type="application/ld+json"
        />
      ))}

      <div className="mx-auto grid max-w-[90rem] gap-10 px-4 pt-8 md:px-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20 lg:pt-10">
        <ProductGallery
          items={(product.gallery ?? [])
            .filter((item) => item.image && typeof item.image === 'object')
            .map((item) => ({
              image: item.image as Media,
              optionId: item.variantOption
                ? typeof item.variantOption === 'object'
                  ? item.variantOption.id
                  : item.variantOption
                : null,
            }))}
        />

        <div className="lg:sticky lg:top-24 lg:self-start lg:pt-6 lg:pr-10 xl:pr-20">
          <ProductInfo
            categoryTitle={category?.title ?? null}
            details={details}
            embroideryOptions={embroideryOptions}
            embroideryRules={embroideryRules}
            product={product}
            rating={average !== null ? { average, count: reviews.length } : null}
          />
        </div>
      </div>

      {/* The fabric, in her words, beside the print close-up (her notes, 28 Sep 2026). */}
      <FabricBlock className="pt-24 md:pt-36" image={pick('print')} />

      {product.layout?.length ? <RenderBlocks blocks={product.layout} /> : null}

      <ProductReviews productId={product.id} reviews={reviews} />
    </>
  )
}

/**
 * The accordion rows under the buy button. Each is the client's own text when
 * she has written it; otherwise it is built from data that is actually true —
 * the fabric fields, the live delivery tables, the returns rule — and left out
 * entirely when there is nothing true to say. Nothing is invented.
 */
async function productDetails({
  payload,
  product,
  settings,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  product: Product
  settings: Awaited<ReturnType<ReturnType<typeof getCachedGlobal<'siteSettings'>>>>
}): Promise<ProductDetail[]> {
  const details: ProductDetail[] = []

  // Material & care — the fabric facts always, her care line (the same words
  // as the fabric section below the piece), then any care copy of her own for
  // this piece. Her copy used to replace the facts, so the page never said
  // what it is made of. The old dry-clean / 30°C text she struck out on
  // 28 Sep 2026 is cleared from the data by migration 20260927_205800.
  {
    const lines = [
      product.colour && `Colour: ${product.colour}`,
      // The descriptor is written to follow the name ("in 22-momme silk").
      product.fabric && `Fabric: ${product.fabric.replace(/^in\s+/i, '')}`,
      product.composition && `Composition: ${product.composition}`,
      product.fabricWeight && `Weight: ${product.fabricWeight}`,
      product.trims && `Trims: ${product.trims}`,
      product.fitNote && `Fit: ${product.fitNote}`,
      `Care: ${FABRIC.care.line}`,
    ].filter((line): line is string => Boolean(line))
    if (lines.length || product.materialCare) {
      details.push({
        lines: lines.length ? lines : undefined,
        rich: product.materialCare ?? undefined,
        title: 'Material & care',
      })
    }
  }

  // Delivery & returns
  if (product.deliveryReturns) {
    details.push({ rich: product.deliveryReturns, title: 'Delivery & returns' })
  } else {
    const range = await deliveryRange(payload, settings)
    const lines: string[] = []
    if (range.qatarLow !== null && range.qatarHigh !== null) {
      lines.push(
        range.qatarLow === range.qatarHigh
          ? `Delivery within Qatar: ${formatQar(range.qatarLow)}.`
          : `Delivery within Qatar: ${formatQar(range.qatarLow)} to ${formatQar(range.qatarHigh)}, depending on your city.`,
      )
    }
    if (range.intlLow !== null) {
      lines.push(`International delivery from ${formatQar(range.intlLow)}, calculated at checkout.`)
    }
    if (settings.freeShippingEnabled && settings.freeShippingThresholdQar) {
      lines.push(
        `Free delivery on orders over ${formatQar(toMinor(settings.freeShippingThresholdQar))}.`,
      )
    }
    if (product.personalisationEnabled && !settings.personalisationReturnable) {
      lines.push('Personalised pieces cannot be returned.')
    }
    if (lines.length) details.push({ lines, title: 'Delivery & returns' })
  }

  if (product.giftPackaging) {
    details.push({ rich: product.giftPackaging, title: 'Gift wrapping' })
  }

  return details
}

/**
 * The returns rule the Shipping & returns page states, return postage paid by
 * the customer (her old policy). The days are hers to set — Site settings →
 * Returns — and replace `merchantReturnDays` where this is used; 14 is only
 * the fallback. Personalised pieces are final sale, but the piece itself is
 * returnable, so this describes the offer as sold.
 */
const RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'QA',
  merchantReturnDays: 14,
  returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
  returnMethod: 'https://schema.org/ReturnByMail',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
}

/** A size's option names, e.g. "M" — the options are populated on the product query. */
function optionLabels(variant: Variant): string {
  return (variant.options ?? [])
    .map((option) => (typeof option === 'object' && option ? option.label : null))
    .filter((label): label is string => Boolean(label))
    .join(' / ')
}

/**
 * Her own search description when she has written one. Otherwise one built
 * from the piece's own facts — what it is, the fabric, the colour, where it is
 * designed — because the opening of her description ran past 160 characters and
 * a clipped version ended mid-phrase ("…an exclusive…").
 */
function metaDescription(product: Product): string {
  if (product.meta?.description) return product.meta.description
  const fabric = product.fabric ? ` ${product.fabric}` : ''
  const colour = product.colour ? `, ${product.colour}` : ''
  const embroidery = product.personalisationEnabled ? ', with optional hand embroidery' : ''
  const built = `${product.title}${fabric}${colour}. Designed in Doha, carefully hand-finished${embroidery}.`
  return clip(built)
}

/**
 * Wrapped in React's `cache` so the page and its metadata share one lookup per
 * request — it was running twice, each time three levels deep. Takes the slug
 * itself, not an object: `cache` matches arguments by identity.
 */
const queryProductBySlug = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'products',
    depth: 3,
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
    populate: {
      variants: {
        title: true,
        priceInQAR: true,
        inventory: true,
        options: true,
      },
    },
  })

  return result.docs?.[0] || null
})
