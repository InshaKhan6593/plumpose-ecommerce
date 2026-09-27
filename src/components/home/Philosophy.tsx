'use client'

import { useLayoutEffect, useRef } from 'react'

import { gsap, LINE_HIDDEN, prefersReducedMotion, splitLines } from '@/motion/gsap'

import { HOME } from './content'

/**
 * The section that slides up over the hero (the curtain) — after the
 * reference's "Private Atelier for those who appreciate subtle refinement".
 * Her words, centred on one screen.
 *
 * It used to be 2.2 screens tall, with small photographs drifting past the
 * words at their own speeds. She asked for the photographs to go (27 Sep
 * 2026), and without them that height was only empty scrolling before The
 * Print, so the words now have one screen. The drift is in the history
 * (a1e877d and before) should she want photographs back.
 */
export function Philosophy({
  copy = HOME.philosophy,
}: {
  /** Her words from Page text; the defaults in content.ts otherwise. */
  copy?: { headline: ReadonlyArray<{ italic?: boolean; text: string }>; label: string }
}) {
  const root = useRef<HTMLElement>(null)

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
        if (label)
          gsap.fromTo(
            label,
            { opacity: 0, y: 20 },
            { ease: 'none', opacity: 1, scrollTrigger: arrive, y: 0 },
          )
        if (headline) {
          gsap.set(headline, { opacity: 1 })
          const split = splitLines(headline)
          gsap.fromTo(
            split.lines,
            { yPercent: LINE_HIDDEN },
            { ease: 'none', scrollTrigger: arrive, stagger: 0.12, yPercent: 0 },
          )
        }
      }, el)
    })

    return () => {
      cancelled = true
      ctx?.revert()
    }
  }, [])

  return (
    <section aria-label={copy.label} className="relative z-10 bg-background md:h-svh" ref={root}>
      <div className="flex items-center justify-center px-6 pt-28 pb-14 md:h-svh md:py-0">
        <div className="max-w-[62rem] text-center md:max-w-[54vw]">
          <p className="caps text-[0.625rem] text-ink-soft" data-philosophy-label data-reveal>
            {copy.label}
          </p>
          <h2
            className="mt-7 text-[clamp(2.4rem,4.4vw,4.6rem)] leading-[1.08] text-balance text-ink"
            data-philosophy-headline
            data-reveal-lines
          >
            {copy.headline.map((part, i) =>
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
    </section>
  )
}
