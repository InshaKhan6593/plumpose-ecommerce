import type { Category, Media, Product } from '@/payload-types'

import configPromise from '@payload-config'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import type { EmbroideryOption, EmbroideryRules } from '@/components/product/embroidery'
import { ProductGallery } from '@/components/product/ProductGallery'
import { type ProductDetail, ProductInfo } from '@/components/product/ProductInfo'
import { deliveryRange } from '@/lib/pricing/deliveryRange'
import { formatQar, toMajor, toMinor } from '@/lib/pricing/money'
import { getCachedGlobal } from '@/utilities/getGlobals'

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
  const canIndex = product._status === 'published'

  const seoImage = metaImage || (gallery.length ? (gallery[0]?.image as Media) : undefined)

  return {
    description: product.meta?.description || '',
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
  const [details, embroideryDocs] = await Promise.all([
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
  ])

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
    ? embroideryDocs.docs.map(({ hex, key, name, note, svgPath, type }) => ({ hex, key, name, note, svgPath, type }))
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
   */
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    image: images[0]?.url,
    name: product.title,
    offers: {
      '@type': 'Offer',
      availability:
        hasStock || product.madeToOrder
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      price: toMajor(price).toFixed(2),
      priceCurrency: 'QAR',
    },
  }

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        type="application/ld+json"
      />

      <div className="mx-auto grid max-w-[90rem] gap-10 px-4 pt-8 md:px-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20 lg:pt-10">
        <ProductGallery images={images} />

        <div className="lg:sticky lg:top-24 lg:self-start lg:pt-6 lg:pr-10 xl:pr-20">
          <ProductInfo
            categoryTitle={category?.title ?? null}
            details={details}
            embroideryOptions={embroideryOptions}
            embroideryRules={embroideryRules}
            product={product}
          />
        </div>
      </div>

      {product.layout?.length ? <RenderBlocks blocks={product.layout} /> : null}
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

  // Material & care
  if (product.materialCare) {
    details.push({ rich: product.materialCare, title: 'Material & care' })
  } else {
    const lines = [
      product.fabric && `Fabric: ${product.fabric}`,
      product.composition && `Composition: ${product.composition}`,
      product.fabricWeight && `Weight: ${product.fabricWeight}`,
      product.trims && `Trims: ${product.trims}`,
      product.fitNote && `Fit: ${product.fitNote}`,
    ].filter((line): line is string => Boolean(line))
    if (lines.length) details.push({ lines, title: 'Material & care' })
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
      lines.push(`Free delivery on orders over ${formatQar(toMinor(settings.freeShippingThresholdQar))}.`)
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
