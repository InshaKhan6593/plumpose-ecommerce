import Link from 'next/link'
import React from 'react'

import type { Media as MediaType, Product } from '@/payload-types'

import { Media } from '@/components/Media'
import { Money } from '@/providers/Locale'
import { splitTitle } from '@/utilities/splitTitle'

/**
 * A product in the shop grid (docs/SCREEN-PROMPTS 05).
 *
 * Hover swaps to the second photograph (MOTION-SPEC D2): a 0.6s crossfade
 * with a slight settle in scale — on devices that can hover. On a phone the
 * first photograph simply stays. No badges, no ratings, no sale flags.
 */
export function ProductCard({ priority, product }: { priority?: boolean; product: Product }) {
  const images = (product.gallery ?? [])
    .map((item) => item.image)
    .filter((image): image is MediaType => Boolean(image) && typeof image === 'object')
  const [first, second] = images

  const variantPrices = (product.variants?.docs ?? [])
    .map((v) => (typeof v === 'object' ? v.priceInQAR : null))
    .filter((p): p is number => typeof p === 'number')
  const price = variantPrices.length ? Math.min(...variantPrices) : product.priceInQAR

  const { name, subtitle } = splitTitle(product.title)

  return (
    <Link className="group block" href={`/products/${product.slug}`}>
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-3">
        {first ? (
          <Media
            className="absolute inset-0 transition-transform duration-[900ms] ease-brand [@media(hover:hover)]:group-hover:scale-[1.03]"
            fill
            imgClassName="object-cover"
            priority={priority}
            resource={first}
            size="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          />
        ) : null}
        {second ? (
          <Media
            className="absolute inset-0 opacity-0 transition-opacity duration-[600ms] ease-brand [@media(hover:hover)]:group-hover:opacity-100"
            fill
            imgClassName="object-cover"
            resource={second}
            size="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          />
        ) : null}
      </div>

      <div className="mt-5">
        <h2 className="serif-display text-[1.75rem] leading-tight">{name}</h2>
        {subtitle ? <p className="serif-italic mt-1 text-base text-ink-soft">{subtitle}</p> : null}
        {typeof price === 'number' ? <p className="mt-3 text-sm tracking-[0.1em] tabular-nums"><Money minor={price} /></p> : null}
      </div>
    </Link>
  )
}
