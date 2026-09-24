'use client'

import React, { useLayoutEffect, useRef } from 'react'

import { gsap, LINE_HIDDEN, prefersReducedMotion, splitLines } from '@/motion/gsap'
import { cn } from '@/utilities/cn'

import { type Film, InViewFilm } from './InViewFilm'

/**
 * The Our Story opener — MOTION-SPEC §3B, "Our Story — opener: video, poster
 * first": the image expansion, with a film instead of a still.
 *
 * The film is the café clip the homepage does not use (EK3A2414, the pillow),
 * so the two pages never show the same footage. It is a portrait clip, and a
 * landscape crop of it is nothing but her face — so on desktop it keeps its
 * shape: the page opens on a small card of the film in the right half, which
 * opens to fill that half as you scroll, while her words hold the left.
 *
 * On a phone the film is the whole screen once open. There the words sit on
 * the paper above the card and turn white exactly where the growing film
 * reaches them — the homepage Print band's two-copies trick (PrintBand.tsx):
 * an ink copy on the paper, a white copy inside the frame, revealed by the
 * frame's own clip-path.
 *
 * Under reduced motion there is no pin and no film: the poster, fully open.
 */
export function StoryOpener({
  film,
  heading,
  label,
  lede,
}: {
  film: Film
  heading: ReadonlyArray<string>
  label: string
  lede: string
}) {
  const root = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el || prefersReducedMotion()) return

    const frame = el.querySelector<HTMLElement>('[data-opener-frame]')
    const picture = el.querySelector<HTMLElement>('[data-opener-picture]')
    const more = el.querySelectorAll<HTMLElement>('[data-opener-more]')
    const headings = Array.from(el.querySelectorAll<HTMLElement>('[data-opener-heading]'))
    const intro = el.querySelectorAll<HTMLElement>('[data-opener-intro]')
    const hint = el.querySelector<HTMLElement>('[data-opener-hint]')

    gsap.set(intro, { opacity: 0 })

    let ctx: gsap.Context | undefined
    let cancelled = false

    document.fonts.ready.then(() => {
      if (cancelled) return
      ctx = gsap.context(() => {
        // Intro, once. Both copies of the heading rise together, so they stay registered.
        headings.forEach((h) => {
          const split = splitLines(h)
          gsap.from(split.lines, { delay: 0.25, duration: 1.4, ease: 'expo.out', stagger: 0.12, yPercent: LINE_HIDDEN })
        })
        gsap.fromTo(intro, { opacity: 0, y: 20 }, { delay: 0.9, duration: 1.2, opacity: 1, stagger: 0.1, y: 0 })

        const mm = gsap.matchMedia()
        mm.add({ desktop: '(min-width: 1024px)', phone: '(max-width: 1023px)' }, (c) => {
          const { desktop } = c.conditions as { desktop: boolean }
          // Desktop: a card inside the right half. Phone: a card under the words.
          const card = desktop ? 'inset(12% 22% 20% 22% round 0px)' : 'inset(40% 16% 7% 16% round 0px)'
          const closed = desktop ? 'inset(80% 22% 20% 22% round 0px)' : 'inset(93% 16% 7% 16% round 0px)'

          // The card arrives: it opens upward from its own bottom edge.
          gsap.fromTo(frame, { clipPath: closed }, { clipPath: card, duration: 1.6, ease: 'expo.out' })

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: { end: '+=120%', pin: true, refreshPriority: 1, scrub: 1, start: 'top top', trigger: el },
          })
          tl.fromTo(frame, { clipPath: card }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1, ease: 'power1.inOut', immediateRender: false }, 0)
            /*
             * On a phone the card sits low, under the words, where the film
             * shows only her chest. The picture starts lowered so her face is
             * in the card, and rises back as the card opens — always behind
             * the frame's top edge, so no gap ever shows.
             */
            .fromTo(picture, { scale: 1.2, yPercent: desktop ? 0 : 26 }, { duration: 1.2, scale: 1, yPercent: 0 }, 0)
            .to(hint, { duration: 0.15, opacity: 0 }, 0)
          if (!desktop) {
            tl.fromTo(more, { opacity: 0, y: 20 }, { duration: 0.25, ease: 'power2.out', opacity: 1, stagger: 0.05, y: 0 }, 0.95)
          }
          tl.to({}, { duration: 0.2 })
        })
      }, el)
    })

    return () => {
      cancelled = true
      ctx?.revert()
    }
  }, [])

  return (
    <section aria-label={label} className="relative h-svh min-h-[34rem] overflow-hidden bg-background" ref={root}>
      {/* The words in ink. Desktop: the left half, always visible. Phone: above the card, until the film covers them. */}
      <div className="pointer-events-none absolute inset-x-4 top-[13%] md:inset-x-7 lg:top-auto lg:right-auto lg:bottom-[14%] lg:w-[46%]">
        <p className="caps text-[0.625rem] text-ink-soft">{label}</p>
        <h1 className="serif-display mt-4 text-[clamp(2.75rem,5vw,5.5rem)] leading-[0.95]" data-opener-heading>
          <Lines heading={heading} />
        </h1>
        <p className="mt-8 hidden max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft lg:block" data-opener-intro>
          {lede}
        </p>
      </div>

      {/*
        The film. Desktop: the right half, starting under the header — once the
        section pins at the top of the screen the sticky header sits over it,
        and would cover her face. Phone: the whole screen.
      */}
      <div className="absolute inset-0 overflow-hidden bg-ink lg:top-24 lg:left-1/2" data-opener-frame>
        <div className="absolute inset-0" data-opener-picture>
          <InViewFilm
            className="object-[50%_8%]"
            film={film}
            label="Resting on a café sofa in the Al Shaheen Nights silk set"
            priority
          />
        </div>

        {/* Phone only: the white copy of the words, revealed as the film grows under them. */}
        <div aria-hidden className="lg:hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/10 to-ink/40" />
          <div className="absolute inset-x-4 top-[13%] text-white md:inset-x-7">
            <p className="caps text-[0.625rem] text-white/80">{label}</p>
            <p className="serif-display mt-4 text-[clamp(2.75rem,5vw,5.5rem)] leading-[0.95]" data-opener-heading>
              <Lines heading={heading} />
            </p>
          </div>
          <p className="absolute inset-x-4 bottom-[10%] max-w-xs text-[0.9375rem] leading-relaxed text-white/90 md:inset-x-7" data-opener-more>
            {lede}
          </p>
        </div>
      </div>

      <p
        aria-hidden
        className="caps pointer-events-none absolute bottom-6 left-4 hidden text-[0.5625rem] text-ink-soft md:left-7 lg:block"
        data-opener-hint
      >
        Scroll
      </p>
    </section>
  )
}

function Lines({ heading }: { heading: ReadonlyArray<string> }) {
  return (
    <>
      {heading.map((line, n) => (
        <span className={cn('block', n === heading.length - 1 && 'serif-italic')} key={line}>
          {line}
        </span>
      ))}
    </>
  )
}
