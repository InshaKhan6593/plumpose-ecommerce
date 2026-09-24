'use client'

import React, { useLayoutEffect, useRef } from 'react'

import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { gsap, LINE_HIDDEN, prefersReducedMotion, splitLines } from '@/motion/gsap'
import { RevealImage } from '@/motion/Reveal'
import { cn } from '@/utilities/cn'

import { HOME } from './content'

/**
 * The section that slides up over the hero (the curtain) — after the
 * reference's "Private Atelier for those who appreciate subtle refinement".
 *
 * The headline holds the centre of the screen (sticky) while small thumbnails
 * drift past just outside it, each at its own speed, so nearer ones seem to
 * move faster. The words are hers — the opening of her product description.
 *
 * **The thumbnails never touch the words.** The headline is held to the
 * middle 54% of the screen and each thumbnail's inner edge is at least 2vw
 * outside that. The first version scattered photographs across the section
 * with some in front of the text, and in the client's recording they slid
 * straight over the headline; the second pushed six of them out to the page
 * edges, which read as margins rather than the reference's framing.
 *
 * Nothing arrives on a timer: each photograph's fade, settle and drift are all
 * scrubbed to the scroll, so it glides in with the hand on the wheel rather
 * than popping when it crosses a line.
 *
 * On a phone there are no margins to drift in, so the section is simply the
 * words and two photographs beneath them. Under reduced motion the photographs
 * sit where they are.
 */

type Float = {
  className: string
  image?: MediaType
  key: string
  side: 'left' | 'right'
  /** How far it travels against the scroll, in % of its own height. */
  speed: number
}

export function Philosophy({
  images,
}: {
  images: { corridor?: MediaType; piping?: MediaType; print?: MediaType; qatarBook?: MediaType }
}) {
  const root = useRef<HTMLElement>(null)

  /*
   * Four small thumbnails, as in the reference — framing the words, not
   * filling the margins. Each is placed from the centre of the page: the
   * headline column is at most 54vw (27vw either side of centre), so an inner
   * edge at 29–31vw from centre sits just clear of the words at every width.
   * `top` is % of the section's height.
   */
  const floats: Float[] = [
    { className: 'right-[calc(50%+29vw)] top-[12%] w-[7.5vw]', image: images.corridor, key: 'corridor', side: 'left', speed: 40 },
    { className: 'right-[calc(50%+31vw)] top-[58%] w-[6vw]', image: images.piping, key: 'piping', side: 'left', speed: 80 },
    { className: 'left-[calc(50%+29vw)] top-[26%] w-[8.5vw]', image: images.print, key: 'print', side: 'right', speed: 70 },
    { className: 'left-[calc(50%+31vw)] top-[70%] w-[6.5vw]', image: images.qatarBook, key: 'book', side: 'right', speed: 50 },
  ]

  useLayoutEffect(() => {
    const el = root.current
    if (!el || prefersReducedMotion()) return

    const label = el.querySelector<HTMLElement>('[data-philosophy-label]')
    const headline = el.querySelector<HTMLElement>('[data-philosophy-headline]')
    gsap.set([label, headline].filter(Boolean), { opacity: 0 })

    let ctx: gsap.Context | undefined
    let cancelled = false

    document.fonts.ready.then(() => {
      if (cancelled) return

      ctx = gsap.context(() => {
        /*
         * The words arrive with the curtain, tied to the scroll: each line rises
         * from its mask as the section climbs from the bottom of the screen to
         * near the top — so they are always in step with the hand on the wheel,
         * never popping in on a timer.
         */
        const arrive = { end: 'top 25%', scrub: 1, start: 'top 95%', trigger: el }
        if (label) gsap.fromTo(label, { opacity: 0, y: 20 }, { ease: 'none', opacity: 1, scrollTrigger: arrive, y: 0 })
        if (headline) {
          gsap.set(headline, { opacity: 1 })
          const split = splitLines(headline)
          gsap.fromTo(split.lines, { yPercent: LINE_HIDDEN }, { ease: 'none', scrollTrigger: arrive, stagger: 0.12, yPercent: 0 })
        }

        const mm = gsap.matchMedia()
        mm.add('(min-width: 768px)', () => {
          el.querySelectorAll<HTMLElement>('[data-float]').forEach((anchor) => {
            const drift = anchor.firstElementChild as HTMLElement | null
            const picture = drift?.firstElementChild as HTMLElement | null
            if (!drift || !picture) return
            const speed = Number(anchor.dataset.speed)
            const fromLeft = anchor.dataset.side === 'left'

            // Depth: each drifts against the scroll at its own speed, across the whole section.
            gsap.fromTo(
              drift,
              { yPercent: speed },
              { ease: 'none', scrollTrigger: { end: 'bottom top', scrub: 1.2, start: 'top bottom', trigger: el }, yPercent: -speed },
            )

            /*
             * Arrival, scrubbed: it fades up and settles in from its own side as
             * it climbs the lower part of the screen. The anchor never moves, so
             * the trigger measures a true position whatever the drift is doing.
             */
            gsap.fromTo(
              picture,
              { opacity: 0, scale: 0.9, x: fromLeft ? -36 : 36 },
              {
                ease: 'power2.out',
                opacity: 1,
                scale: 1,
                scrollTrigger: { end: 'top 55%', scrub: 1.2, start: 'top 98%', trigger: anchor },
                x: 0,
              },
            )
          })
        })
      }, el)
    })

    return () => {
      cancelled = true
      ctx?.revert()
    }
  }, [])

  return (
    <section aria-label={HOME.philosophy.label} className="relative z-10 bg-background md:h-[220svh]" ref={root}>
      {/* The words hold the centre while the photographs pass. */}
      <div className="relative z-10 flex items-center justify-center px-6 pt-28 pb-14 md:sticky md:top-0 md:h-svh md:py-0">
        <div className="max-w-[62rem] text-center md:max-w-[54vw]">
          <p className="caps text-[0.625rem] text-ink-soft" data-philosophy-label data-reveal>
            {HOME.philosophy.label}
          </p>
          <h2 className="mt-7 text-[clamp(2.4rem,4.4vw,4.6rem)] leading-[1.08] text-balance text-ink" data-philosophy-headline data-reveal-lines>
            {HOME.philosophy.headline.map((part, i) =>
              part.italic ? (
                <em className="serif-italic" key={i}>
                  {part.text}
                </em>
              ) : (
                <span className="serif-display" key={i}>
                  {part.text}
                </span>
              ),
            )}
          </h2>
        </div>
      </div>

      {/* Desktop: the photographs drift through the margins, never over the words. */}
      {floats.map((float) =>
        float.image ? (
          <div
            aria-hidden
            className={cn('pointer-events-none absolute z-0 hidden md:block', float.className)}
            data-float
            data-side={float.side}
            data-speed={float.speed}
            key={float.key}
          >
            <div className="will-change-transform">
              <div className="relative aspect-[4/5] overflow-hidden bg-paper-3">
                <Media className="absolute inset-0" fill imgClassName="object-cover" resource={float.image} size="9vw" />
              </div>
            </div>
          </div>
        ) : null,
      )}

      {/* Phone: no margins to drift in — two photographs beneath the words. */}
      <div className="grid grid-cols-2 gap-3 px-6 pb-24 md:hidden">
        {[images.corridor, images.qatarBook].map((image, i) =>
          image ? (
            <RevealImage className={cn('relative aspect-[4/5] overflow-hidden bg-paper-3', i === 1 && 'mt-12')} key={image.id}>
              <div className="absolute inset-0">
                <Media className="absolute inset-0" fill imgClassName="object-cover" resource={image} size="45vw" />
              </div>
            </RevealImage>
          ) : null,
        )}
      </div>
    </section>
  )
}
