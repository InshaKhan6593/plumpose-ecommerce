import Link from 'next/link'
import React from 'react'

import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { type Film, InViewFilm } from '@/components/editorial/InViewFilm'
import { Reveal, RevealImage } from '@/motion/Reveal'
import { cn } from '@/utilities/cn'

/**
 * The building blocks the content pages share — Our Story, FAQ, Shipping &
 * Returns, Made for You, Press, Spotted, Contact — so they read as one site
 * with the homepage and the shop: the same heading scale, the same reveal,
 * the same paper bands. Motion is the house reveal (MOTION-SPEC §3C) only.
 */

/** A page's opening: small caps label, a serif heading that rises line by line, an italic line. */
export function PageHeading({
  align = 'center',
  className,
  intro,
  label,
  title,
}: {
  align?: 'center' | 'left'
  className?: string
  intro?: string
  label?: string
  title: string
}) {
  return (
    <Reveal
      className={cn(align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl', className)}
    >
      {label ? (
        <p className="caps text-[0.625rem] text-ink-soft" data-reveal>
          {label}
        </p>
      ) : null}
      <h1
        className={cn('serif-display text-[clamp(3rem,6vw,5.5rem)]', label && 'mt-5')}
        data-reveal-lines
      >
        {title}
      </h1>
      {intro ? (
        <p className="serif-italic mt-5 text-lg text-ink-soft md:text-xl" data-reveal>
          {intro}
        </p>
      ) : null}
    </Reveal>
  )
}

/** Page width and side gutters, as the shop and the homepage use. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('mx-auto max-w-[90rem] px-4 md:px-7', className)}>{children}</div>
}

/** A small caps label with a hairline under it — a section's heading inside a page. */
export function SectionLabel({
  children,
  className,
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <h2 className={cn('caps border-b border-line pb-4 text-[0.6875rem]', className)} id={id}>
      {children}
    </h2>
  )
}

/**
 * A photograph beside a block of words, the photograph unveiling as it scrolls
 * in. `reverse` puts the photograph on the right. On a phone the photograph
 * comes first. Pass `film` instead of `image` for a short in-view film in the
 * same frame (InViewFilm).
 */
export function SplitBand({
  children,
  className,
  film,
  id,
  image,
  imageClassName,
  imgClassName,
  reverse = false,
}: {
  children: React.ReactNode
  className?: string
  film?: Film & { label: string }
  id?: string
  image?: MediaType
  imageClassName?: string
  /** Classes for the picture itself, e.g. 'object-[50%_20%]' to keep a face in frame. */
  imgClassName?: string
  reverse?: boolean
}) {
  return (
    <section
      className={cn(
        'mx-auto grid max-w-[90rem] scroll-mt-28 items-center gap-10 px-4 md:px-7 lg:grid-cols-2 lg:gap-24',
        className,
      )}
      id={id}
    >
      {film || image ? (
        <RevealImage
          className={cn(
            'relative aspect-[4/5] overflow-hidden bg-paper-3',
            reverse && 'lg:order-2',
            imageClassName,
          )}
        >
          {film ? (
            <InViewFilm className={imgClassName} film={film} label={film.label} />
          ) : (
            <Media
              className="absolute inset-0"
              fill
              imgClassName={cn('object-cover', imgClassName)}
              resource={image}
              size="(min-width: 1024px) 45vw, 100vw"
            />
          )}
        </RevealImage>
      ) : null}
      <Reveal
        className={cn('lg:max-w-xl', reverse ? 'lg:order-1 lg:justify-self-end' : 'lg:pr-10')}
      >
        {children}
      </Reveal>
    </section>
  )
}

/** Label, heading and paragraphs, for the words side of a SplitBand. */
export function Prose({
  body,
  heading,
  label,
}: {
  body: ReadonlyArray<string> | string
  heading?: string
  label?: string
}) {
  const paragraphs = typeof body === 'string' ? [body] : body
  return (
    <>
      {label ? (
        <p className="caps text-[0.625rem] text-ink-soft" data-reveal>
          {label}
        </p>
      ) : null}
      {heading ? (
        <h2 className="serif-display mt-5 text-[clamp(2.25rem,3.6vw,3.5rem)]" data-reveal-lines>
          {heading}
        </h2>
      ) : null}
      {paragraphs.map((text) => (
        <p className="mt-6 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal key={text}>
          {text}
        </p>
      ))}
    </>
  )
}

/** An underlined small caps link — the house secondary action. */
export function TextLink({
  children,
  className,
  href,
}: {
  children: React.ReactNode
  className?: string
  href: string
}) {
  const external = /^(https?:|mailto:)/.test(href)
  const cls = cn(
    'caps inline-block border-b border-ink pb-1 text-[0.625rem] transition-opacity hover:opacity-60',
    className,
  )
  return external ? (
    <a
      className={cls}
      href={href}
      {...(href.startsWith('http') ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
    >
      {children}
    </a>
  ) : (
    <Link className={cls} href={href}>
      {children}
    </Link>
  )
}

/** The solid ink button. */
export function ButtonLink({
  children,
  className,
  href,
}: {
  children: React.ReactNode
  className?: string
  href: string
}) {
  return (
    <Link
      className={cn(
        'caps inline-flex h-12 items-center bg-ink px-12 text-[0.6875rem] text-white transition-colors hover:bg-ink/85',
        className,
      )}
      href={href}
    >
      {children}
    </Link>
  )
}

/** The quiet closing band, one step deeper than the page: one italic line and an action. */
export function ClosingBand({
  body,
  children,
  className,
  line,
}: {
  body?: string
  children?: React.ReactNode
  className?: string
  line: string
}) {
  return (
    <Reveal
      as="section"
      className={cn('mx-4 bg-paper-3 px-6 py-20 text-center md:mx-7 md:py-28', className)}
    >
      <p
        className="serif-italic mx-auto max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] leading-snug"
        data-reveal
      >
        {line}
      </p>
      {body ? (
        <p
          className="mx-auto mt-5 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft"
          data-reveal
        >
          {body}
        </p>
      ) : null}
      {children ? (
        <div className="mt-9" data-reveal>
          {children}
        </div>
      ) : null}
    </Reveal>
  )
}
