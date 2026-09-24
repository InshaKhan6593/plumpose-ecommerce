'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'

import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { gsap, prefersReducedMotion, ScrollTrigger } from '@/motion/gsap'
import { Reveal } from '@/motion/Reveal'

import { HOME } from './content'

export type Step = { body: string; image?: MediaType; title: string }

/**
 * "Made for you, by hand" — the pinned sequence, after the reference's
 * "Informed decisions supported by expert guidance" (01/04 → 04/04).
 *
 * The stage holds while four steps play through — and it is **scrubbed**: every
 * bit of scroll moves it. The next photograph sweeps in from left to right as the
 * wheel turns (and back if it turns back), the titles and words slide with it,
 * a hairline steps on with the counter, and every picture keeps a slow drift
 * the whole way. Each step then holds long enough to read. (The first version
 * switched at four thresholds with nothing moving in between and felt stuck;
 * the second changed almost continuously and the middle steps flashed past.)
 *
 * Every fact in a step comes from the database — sizes, thread colours, the
 * fee, the lead time, delivery prices. Under reduced motion there is no
 * pinning: the four steps simply stack.
 */

/** Scroll given to each step, in viewport heights. */
const PER_STEP = 110

export function MadeSteps({ steps }: { steps: Step[] }) {
  const root = useRef<HTMLElement>(null)
  const [pinned, setPinned] = useState(true)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    if (prefersReducedMotion()) {
      setPinned(false)
      return
    }
    const track = el.querySelector<HTMLElement>('[data-steps-track]')
    if (!track) return

    const frames = Array.from(el.querySelectorAll<HTMLElement>('[data-step-frame]'))
    const pictures = frames.map((f) => f.firstElementChild as HTMLElement)
    const titles = Array.from(el.querySelectorAll<HTMLElement>('[data-step-title]'))
    const bodies = Array.from(el.querySelectorAll<HTMLElement>('[data-step-body]'))
    const bar = el.querySelector<HTMLElement>('[data-step-bar]')
    const n = frames.length

    const ctx = gsap.context(() => {
      /*
       * Decode every photograph while the section is still a screen away. A
       * fully clipped image is never painted, so otherwise the browser decodes
       * it on the first frame of its wipe — measured as a run of 33ms frames
       * right as each change began.
       */
      ScrollTrigger.create({
        once: true,
        onEnter: () => el.querySelectorAll<HTMLImageElement>('[data-step-frame] img').forEach((img) => img.decode().catch(() => undefined)),
        start: 'top bottom+=100%',
        trigger: el,
      })

      // Starting state: step one showing, the rest waiting fully clipped from the right.
      frames.forEach((f, i) => gsap.set(f, { clipPath: i === 0 ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)' }))
      gsap.set(pictures, { scale: 1.1 })
      titles.forEach((t, i) => gsap.set(t, { opacity: i === 0 ? 1 : 0, x: i === 0 ? 0 : -28 }))
      bodies.forEach((b, i) => gsap.set(b, { opacity: i === 0 ? 1 : 0, x: i === 0 ? 0 : -20 }))

      /*
       * One timeline across the whole track, scrubbed with a lag so it glides.
       * Timeline units: one per step, and step i owns [i, i+1].
       *
       * Each change takes half a step, centred on the boundary, and the other
       * half holds the step still enough to read. (An earlier version spent 80%
       * of every step changing, and in the client's recording "Add hand
       * embroidery" flashed past.) The first and last steps hold longest.
       */
      const CHANGE = 0.5
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { end: 'bottom bottom', scrub: 1.2, start: 'top top', trigger: track },
      })

      // Life during the holds: every picture keeps a slow drift the whole way.
      pictures.forEach((p) => tl.fromTo(p, { yPercent: -3 }, { duration: n, yPercent: 3 }, 0))
      // The hairline advances a quarter per step, with the change, so it always agrees with "02 / 04".
      if (bar) gsap.set(bar, { scaleX: 1 / n })

      for (let i = 1; i < n; i++) {
        const at = i - CHANGE / 2
        /*
         * Left to right, as in the reference: the next photograph is uncovered
         * from its left edge while the picture inside glides in from the left
         * and settles from a closer zoom; the last one drifts right beneath it,
         * so the two travel together like one moving strip rather than a hard
         * edge crossing a still image. `power2.inOut` starts and lands softly.
         *
         * Why nothing shows at the edges: the incoming picture starts 10% left
         * at 118% scale and is nearly home before the clip reaches the right
         * edge; the outgoing one moves at most 8% right at 104%, and its
         * uncovered left strip is always inside the part already wiped over.
         */
        tl.fromTo(frames[i], { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: CHANGE, ease: 'power2.inOut' }, at)
        tl.fromTo(pictures[i], { scale: 1.18, xPercent: -10 }, { duration: CHANGE * 1.3, ease: 'power2.out', scale: 1.1, xPercent: 0 }, at)
        tl.to(pictures[i - 1], { duration: CHANGE, ease: 'power2.inOut', scale: 1.04, xPercent: 8 }, at)
        if (bar) tl.to(bar, { duration: CHANGE, ease: 'power2.inOut', scaleX: (i + 1) / n }, at)
        // Words move the same way: the old ones slip out to the right, the new ones arrive from the left.
        tl.to(titles[i - 1], { duration: CHANGE * 0.45, ease: 'sine.in', opacity: 0, x: 28 }, at)
        tl.fromTo(titles[i], { opacity: 0, x: -28 }, { duration: CHANGE * 0.5, ease: 'sine.out', opacity: 1, x: 0 }, i)
        tl.to(bodies[i - 1], { duration: CHANGE * 0.4, ease: 'sine.in', opacity: 0, x: 20 }, at + 0.03)
        tl.fromTo(bodies[i], { opacity: 0, x: -20 }, { duration: CHANGE * 0.5, ease: 'sine.out', opacity: 1, x: 0 }, i + 0.04)
      }
    }, el)

    return () => ctx.revert()
  }, [steps.length])

  const count = (n: number) => `${String(n + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`

  return (
    <section aria-label={HOME.steps.label} className="relative bg-background" ref={root}>
      <Reveal className="px-6 pt-24 pb-10 text-center md:pt-32">
        <p className="caps text-[0.625rem] text-ink-soft" data-reveal>
          {HOME.steps.label}
        </p>
        <h2 className="mt-6 text-[clamp(2.6rem,5vw,4.75rem)] leading-[1.05]" data-reveal-lines>
          <span className="serif-display">{HOME.steps.heading[0]} </span>
          <em className="serif-italic">{HOME.steps.heading[1]}</em>
        </h2>
      </Reveal>

      {pinned ? (
        <div data-steps-track style={{ height: `${steps.length * PER_STEP + 100}svh` }}>
          <div className="sticky top-0 flex h-svh items-center overflow-hidden">
            <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 items-center gap-8 px-6 lg:grid-cols-[1fr_minmax(0,26rem)_1fr] lg:gap-12 lg:px-7">
              {/* Title and counter */}
              <div className="relative order-2 h-24 overflow-hidden lg:order-1 lg:h-36">
                {steps.map((step, i) => (
                  <div className="absolute inset-0" data-step-title key={step.title}>
                    <h3 className="serif-italic text-[clamp(1.75rem,2.6vw,2.5rem)] leading-tight">{step.title}</h3>
                    <p className="caps mt-4 text-[0.5625rem] text-ink-soft tabular-nums">{count(i)}</p>
                  </div>
                ))}
              </div>

              {/* The photographs, each rising over the last */}
              <div className="order-1 mx-auto w-[min(70vw,24rem)] lg:order-2 lg:w-full">
                <div className="relative aspect-[4/5] overflow-hidden bg-paper-3">
                  {steps.map((step, i) =>
                    step.image ? (
                      <div className="absolute inset-0" data-step-frame key={step.title} style={{ zIndex: i }}>
                        <div className="absolute inset-0 will-change-transform">
                          {/*
                            Eager: photographs 2–4 sit fully clipped until their wipe,
                            and a lazy image the browser cannot see only started
                            loading as the wipe uncovered it — an empty frame, then a pop.
                          */}
                          <Media
                            className="absolute inset-0"
                            fill
                            imgClassName="object-cover"
                            loading="eager"
                            resource={step.image}
                            size="(min-width: 1024px) 26rem, 70vw"
                          />
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
                {/* Progress through the four steps */}
                <div aria-hidden className="mt-4 h-px bg-line">
                  <div className="h-full origin-left bg-ink" data-step-bar style={{ transform: 'scaleX(0)' }} />
                </div>
              </div>

              {/* The words */}
              <div className="relative order-3 h-24 overflow-hidden lg:h-32">
                {steps.map((step) => (
                  <p className="absolute inset-0 max-w-xs text-[0.9375rem] leading-relaxed text-ink-soft lg:ml-auto" data-step-body key={step.title}>
                    {step.body}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Reduced motion: the steps, simply stacked. */
        <ol className="mx-auto grid max-w-[90rem] gap-16 px-4 pb-24 md:grid-cols-2 md:px-7">
          {steps.map((step, i) => (
            <li className="flex flex-col gap-5" key={step.title}>
              {step.image ? (
                <div className="relative aspect-[4/5] overflow-hidden bg-paper-3">
                  <Media className="absolute inset-0" fill imgClassName="object-cover" resource={step.image} size="(min-width: 768px) 45vw, 90vw" />
                </div>
              ) : null}
              <p className="caps text-[0.5625rem] text-ink-soft">{count(i)}</p>
              <h3 className="serif-italic text-3xl">{step.title}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
