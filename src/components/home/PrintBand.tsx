'use client'

import Link from 'next/link'
import React, { useLayoutEffect, useRef } from 'react'

import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { gsap, prefersReducedMotion } from '@/motion/gsap'
import { cn } from '@/utilities/cn'

import { HOME } from './content'

/**
 * "The Print" — the image expansion, after the reference's "Craft over volume"
 * (brand-assets/reference/client-reference-animation.mov).
 *
 * The section holds still for 1.7 screens of scrolling while a small card of
 * the print opens out to fill the screen. The scroll is the easing — Lenis
 * gives it the inertia.
 *
 * **The words are there from the start** — heading top-left, figures
 * bottom-right, in ink on paper — and as the card grows beneath them, each
 * letter turns white at the moment the picture reaches it. That is done with
 * two identical copies of the words in the same place: the ink one on the
 * paper, the white one inside the frame, where the frame's own clip-path
 * reveals it exactly as far as the picture has grown. (The first version hid
 * the words until the card was full, and lost the reference's signature move.)
 * Only the paragraph and link wait for the full frame.
 *
 * Without the script, or under reduced motion, it is simply the full image
 * with its words: the finished state, never a half-built one.
 */
export type PrintFact = { label: string; value: string }

export function PrintBand({ facts = [], href, image }: { facts?: PrintFact[]; href: string; image?: MediaType }) {
  const root = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el || !image || prefersReducedMotion()) return

    const frame = el.querySelector<HTMLElement>('[data-print-frame]')
    const picture = el.querySelector<HTMLElement>('[data-print-picture]')
    const more = el.querySelectorAll<HTMLElement>('[data-print-more]')

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      mm.add({ desktop: '(min-width: 1024px)', phone: '(max-width: 1023px)' }, (c) => {
        const { desktop } = c.conditions as { desktop: boolean }
        // The card's starting size: a small portrait card, as in the reference.
        const start = desktop ? 'inset(24% 41% 22% 41% round 0px)' : 'inset(26% 22% 22% 22% round 0px)'

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            end: '+=170%',
            pin: true,
            /*
             * Measured before every other trigger. This pin adds 1.7 screens
             * of spacing, and triggers further down the page (the steps,
             * the product band) were measuring their positions without it —
             * the steps played two screens early. Higher refreshes first.
             */
            refreshPriority: 1,
            // A beat of lag, so the card glides rather than tracking every wheel notch.
            scrub: 1,
            start: 'top top',
            trigger: el,
          },
        })

        tl.fromTo(frame, { clipPath: start }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1, ease: 'power1.inOut' }, 0)
          .fromTo(picture, { scale: 1.3 }, { duration: 1.3, scale: 1 }, 0)
          .fromTo(more, { opacity: 0, y: 24 }, { duration: 0.3, ease: 'power2.out', opacity: 1, stagger: 0.05, y: 0 }, 1)
          .to({}, { duration: 0.2 })
      })
    }, el)

    return () => ctx.revert()
  }, [image])

  if (!image) return null

  return (
    <section aria-label={HOME.print.label} className="relative h-svh overflow-hidden bg-background" ref={root}>
      {/* The words in ink, on the paper around the card. The frame covers them wherever the picture is. */}
      <Words aria-hidden facts={facts} tone="ink" />

      <div className="absolute inset-0 overflow-hidden" data-print-frame>
        <div className="absolute inset-0" data-print-picture>
          {/*
            A portrait photo in this landscape frame keeps the shark's head,
            which sits high in the shot; a landscape photo is simply centred.
          */}
          <Media
            className="absolute inset-0"
            fill
            imgClassName={(image.width ?? 0) > (image.height ?? 0) ? 'object-cover' : 'object-cover object-[50%_22%]'}
            resource={image}
            size="100vw"
          />
        </div>
        {/* Shade under the white words: top-left for the heading, bottom-right for the figures. */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-ink/65 via-ink/10 to-transparent" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-tl from-ink/55 via-transparent to-transparent" />

        {/* The same words in white, inside the frame — revealed letter by letter as it grows. */}
        <Words facts={facts} href={href} tone="white" />
      </div>
    </section>
  )
}

/**
 * The band's words, laid out identically for both tones so the two copies
 * register exactly. Only the white copy carries the paragraph and link, which
 * arrive once the frame is full.
 */
function Words({
  'aria-hidden': ariaHidden,
  facts,
  href,
  tone,
}: {
  'aria-hidden'?: boolean
  facts: PrintFact[]
  href?: string
  tone: 'ink' | 'white'
}) {
  const white = tone === 'white'

  return (
    <div aria-hidden={ariaHidden} className={cn('pointer-events-none absolute inset-0', white ? 'text-white' : 'text-ink')}>
      <div className="absolute top-[15%] left-6 max-w-xl md:left-14">
        <p className={cn('caps text-[0.625rem]', white ? 'text-white/80' : 'text-ink-soft')}>{HOME.print.label}</p>
        <h2 className="serif-display mt-4 text-[clamp(2.75rem,5.5vw,5rem)] leading-[1]">
          {HOME.print.heading.map((line) => (
            <span className="block" key={line}>
              {line}
            </span>
          ))}
        </h2>
        {white && href ? (
          <div className="pointer-events-auto">
            <p className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-white/85" data-print-more>
              {HOME.print.body}
            </p>
            <div data-print-more>
              <Link className="caps mt-7 inline-block border-b border-white pb-1 text-[0.625rem]" href={href}>
                {HOME.print.cta}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Figures, as the reference sets its own — from her settings, never invented. */}
      {facts.length ? (
        <dl className="absolute right-6 bottom-[12%] hidden gap-14 md:right-14 md:flex">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dd className="serif-display text-[clamp(2.5rem,4vw,3.75rem)] leading-none">{fact.value}</dd>
              <dt className={cn('caps mt-3 text-[0.5625rem]', white ? 'text-white/75' : 'text-ink-soft')}>{fact.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
