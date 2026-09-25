import Link from 'next/link'

import type { Media as MediaType, Spotted } from '@/payload-types'

import { Media } from '@/components/Media'
import { Money } from '@/providers/Locale'
import { WasPrice } from '@/components/product/WasPrice'
import { Reveal, RevealImage } from '@/motion/Reveal'
import { splitTitle } from '@/utilities/splitTitle'

/** Only what the band shows — never the reviewer's email. */
export type PublicReview = { body: string; id: number; name: string }

/**
 * The homepage below the fold (docs/mockups/03-… and 04-…).
 *
 * Reviews and Spotted draw only from **approved** entries and are left out
 * entirely while there are none — the mockup's quotes were invented, and a
 * site must not show testimonials nobody gave.
 */

export function ProductBand({
  categoryTitle,
  href,
  image,
  priceMinor,
  title,
  wasMinor,
}: {
  categoryTitle: null | string
  href: string
  image?: MediaType
  priceMinor: number
  title: string
  /** The sale's was-price, if any (REQUIREMENTS A3). */
  wasMinor?: null | number
}) {
  const { name, subtitle } = splitTitle(title)

  return (
    /*
     * Light padding both ends. Above: the pinned steps already end with space
     * under their centred photograph. Below: the footer brings its own margin.
     * With full padding either side, the page showed half a screen of blank
     * paper between sections, which read as a cut.
     */
    <section className="mx-auto grid max-w-[90rem] items-center gap-10 px-4 pt-10 pb-6 md:px-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-24 lg:pt-12 lg:pb-10">
      {image ? (
        // Opens as soon as it enters, so it arrives already unveiling rather than as an empty frame.
        <RevealImage
          className="relative aspect-[4/5] overflow-hidden bg-paper-3 lg:aspect-square"
          start="top bottom"
        >
          <Media
            className="absolute inset-0"
            fill
            imgClassName="object-cover"
            resource={image}
            size="(min-width: 1024px) 45vw, 100vw"
          />
        </RevealImage>
      ) : null}

      <Reveal className="lg:pr-16">
        {categoryTitle ? (
          <p className="caps text-[0.625rem] text-ink-soft" data-reveal>
            {categoryTitle}
          </p>
        ) : null}
        <h2 className="serif-display mt-5 text-[clamp(3rem,5vw,4.75rem)]" data-reveal-lines>
          {name}
        </h2>
        {subtitle ? (
          <p className="serif-italic mt-4 text-2xl" data-reveal>
            {subtitle}
          </p>
        ) : null}
        <p className="mt-7 text-base tracking-[0.12em] tabular-nums" data-reveal>
          <WasPrice price={priceMinor} was={wasMinor} />
          <Money minor={priceMinor} />
        </p>
        <div data-reveal>
          <Link
            className="caps mt-9 inline-flex h-12 items-center bg-ink px-12 text-[0.6875rem] text-white hover:bg-ink/85"
            href={href}
          >
            Discover
          </Link>
        </div>
      </Reveal>
    </section>
  )
}

export function ReviewsBand({ reviews }: { reviews: PublicReview[] }) {
  if (!reviews.length) return null

  return (
    <Reveal as="section" className="mx-auto max-w-[90rem] px-4 py-20 text-center md:px-7 lg:py-28">
      <h2 className="caps text-[0.6875rem]" data-reveal>
        In your words
      </h2>
      <ul className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
        {reviews.map((review) => (
          <li data-reveal key={review.id}>
            <blockquote className="serif-italic text-[1.75rem] leading-snug">
              “{review.body}”
            </blockquote>
            <p className="caps mt-5 text-[0.625rem] text-ink-soft">{review.name}</p>
          </li>
        ))}
      </ul>
    </Reveal>
  )
}

export function SpottedBand({
  handle,
  instagramUrl,
  items,
}: {
  handle: null | string
  instagramUrl: null | string
  items: Spotted[]
}) {
  const withImages = items.filter((item) => typeof item.image === 'object' && item.image)
  if (!withImages.length) return null

  return (
    <Reveal as="section" className="mx-auto max-w-[90rem] px-4 pb-8 md:px-7">
      <div className="text-center" data-reveal>
        <h2 className="caps text-[0.6875rem]">Spotted</h2>
        {handle ? (
          <a
            className="serif-italic mt-2 inline-block text-ink-soft"
            href={instagramUrl ?? '#'}
            rel="noopener noreferrer"
            target="_blank"
          >
            {handle}
          </a>
        ) : null}
      </div>
      <ul className="mt-10 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {withImages.slice(0, 4).map((item) => (
          <li
            className="relative aspect-square overflow-hidden bg-paper-3"
            data-reveal
            key={item.id}
          >
            <Media
              className="absolute inset-0"
              fill
              imgClassName="object-cover"
              resource={item.image as MediaType}
              size="(min-width: 768px) 25vw, 50vw"
            />
          </li>
        ))}
      </ul>
    </Reveal>
  )
}
