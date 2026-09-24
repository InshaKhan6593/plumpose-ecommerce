'use client'

import React, { useLayoutEffect, useRef } from 'react'

import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { gsap, prefersReducedMotion, SplitText } from '@/motion/gsap'
import { cn } from '@/utilities/cn'

import { HOME } from './content'

/**
 * The section that slides up over the hero (the curtain) — after the
 * reference's "Private Atelier for those who appreciate subtle refinement".
 *
 * The headline holds the centre of the screen (sticky) while small photographs
 * drift past it, each at its own speed: some pass in front of the words, some
 * behind. The words are hers — the opening of her product description.
 *
 * Positions are percentages of the section; `speed` is how far a photograph
 * travels against the scroll, so faster ones seem nearer. Under reduced motion
 * the photographs simply sit where they are.
 */

type Float = {
  className: string
  front: boolean
  image?: MediaType
  key: string
  speed: number
}

export function Philosophy({
  images,
}: {
  images: { armchair?: MediaType; corridor?: MediaType; piping?: MediaType; print?: MediaType; qatarBook?: MediaType; window?: MediaType }
}) {
  const root = useRef<HTMLElement>(null)

  const floats: Float[] = [
    { className: 'left-[6%] top-[16%] w-[34vw] md:w-[11vw]', front: false, image: images.corridor, key: 'corridor', speed: 40 },
    { className: 'right-[5%] top-[22%] w-[40vw] md:right-[9%] md:w-[14vw]', front: true, image: images.print, key: 'print', speed: 95 },
    { className: 'left-[16%] top-[50%] hidden md:block md:w-[10vw]', front: true, image: images.piping, key: 'piping', speed: 70 },
    { className: 'right-[8%] top-[60%] w-[30vw] md:right-[20%] md:w-[12vw]', front: false, image: images.qatarBook, key: 'book', speed: 55 },
    { className: 'left-[10%] top-[78%] w-[32vw] md:left-[40%] md:w-[10vw]', front: true, image: images.window, key: 'window', speed: 110 },
    { className: 'right-[6%] top-[84%] hidden md:block md:w-[9vw]', front: false, image: images.armchair, key: 'armchair', speed: 60 },
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
          const split = SplitText.create(headline, { mask: 'lines', type: 'lines' })
          gsap.fromTo(split.lines, { yPercent: 110 }, { ease: 'none', scrollTrigger: arrive, stagger: 0.12, yPercent: 0 })
        }

        el.querySelectorAll<HTMLElement>('[data-float]').forEach((float) => {
          const speed = Number(float.dataset.speed)
          const fromLeft = float.dataset.side === 'left'

          // Depth: each drifts against the scroll at its own speed.
          gsap.fromTo(
            float,
            { yPercent: speed },
            { ease: 'none', scrollTrigger: { end: 'bottom top', scrub: 1, start: 'top bottom', trigger: el }, yPercent: -speed },
          )

          // Arrival: after the words, from its own side, on the luxury curve.
          gsap.fromTo(
            float.firstElementChild,
            { opacity: 0, scale: 0.94, x: fromLeft ? -40 : 40 },
            {
              delay: 0.15,
              duration: 1.8,
              ease: 'expo.out',
              opacity: 1,
              scale: 1,
              scrollTrigger: { once: true, start: 'top 92%', trigger: float },
              x: 0,
            },
          )
        })
      }, el)
    })

    return () => {
      cancelled = true
      ctx?.revert()
    }
  }, [])

  return (
    <section aria-label={HOME.philosophy.label} className="relative z-10 h-[220svh] bg-background" ref={root}>
      {/* The words hold the centre while the photographs pass. */}
      <div className="sticky top-0 z-10 flex h-svh items-center justify-center px-6">
        <div className="max-w-[62rem] text-center">
          <p className="caps text-[0.625rem] text-ink-soft" data-philosophy-label data-reveal>
            {HOME.philosophy.label}
          </p>
          <h2 className="mt-7 text-[clamp(2.4rem,5.2vw,5rem)] leading-[1.08] text-ink" data-philosophy-headline data-reveal-lines>
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

      {floats.map((float) =>
        float.image ? (
          <div
            // On a phone every photograph passes behind the words — at that width one in front hides the line.
            className={cn('absolute z-0', float.front && 'md:z-20', float.className)}
            data-float
            data-side={float.className.includes('left-') ? 'left' : 'right'}
            data-speed={float.speed}
            key={float.key}
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-paper-3">
              <Media className="absolute inset-0" fill imgClassName="object-cover" resource={float.image} size="(min-width: 768px) 14vw, 40vw" />
            </div>
          </div>
        ) : null,
      )}
    </section>
  )
}
