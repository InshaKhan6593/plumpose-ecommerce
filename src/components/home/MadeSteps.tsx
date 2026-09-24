'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'

import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { gsap, prefersReducedMotion } from '@/motion/gsap'
import { Reveal } from '@/motion/Reveal'

import { HOME } from './content'

export type Step = { body: string; image?: MediaType; title: string }

/**
 * "Made for you, by hand" — the pinned sequence, after the reference's
 * "Informed decisions supported by expert guidance" (01/04 → 04/04).
 *
 * The stage holds while four steps play through — and it is **scrubbed**: every
 * bit of scroll moves it. The next photograph rises over the last as the wheel
 * turns (and sinks back if it turns back), the titles and words slide with it,
 * a hairline fills with progress, and every picture keeps a slow zoom and drift
 * the whole way. The first version switched steps at four thresholds with
 * nothing moving in between, and the page felt stuck.
 *
 * Every fact in a step comes from the database — sizes, thread colours, the
 * fee, the lead time, delivery prices. Under reduced motion there is no
 * pinning: the four steps simply stack.
 */

/** Scroll given to each step, in viewport heights. */
const PER_STEP = 75

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
      // Starting state: step one showing, the rest waiting below.
      frames.forEach((f, i) => gsap.set(f, { clipPath: i === 0 ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)' }))
      gsap.set(pictures, { scale: 1.12 })
      titles.forEach((t, i) => gsap.set(t, { opacity: i === 0 ? 1 : 0, yPercent: i === 0 ? 0 : 100 }))
      bodies.forEach((b, i) => gsap.set(b, { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 30 }))

      /*
       * One timeline across the whole track, scrubbed with a one-beat lag so it
       * glides. Timeline units: one per step. Each change runs from half-way
       * through a step into the next, so there is always something turning.
       */
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { end: 'bottom bottom', scrub: 1, start: 'top top', trigger: track },
      })

      // Always moving: the hairline fills, every picture keeps a slow drift.
      if (bar) tl.fromTo(bar, { scaleX: 0 }, { duration: n, scaleX: 1 }, 0)
      pictures.forEach((p) => tl.fromTo(p, { yPercent: -3 }, { duration: n, yPercent: 3 }, 0))

      for (let i = 1; i < n; i++) {
        const at = i - 0.55
        // The next photograph rises over the last, settling from a closer zoom…
        tl.to(frames[i], { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power2.inOut' }, at)
        tl.fromTo(pictures[i], { scale: 1.3 }, { duration: 0.9, ease: 'power2.out', scale: 1.1 }, at)
        // …while the last eases back beneath it.
        tl.to(pictures[i - 1], { duration: 0.7, scale: 1.02 }, at)
        // Words: out upward, in from below, just behind the picture.
        tl.to(titles[i - 1], { duration: 0.35, opacity: 0, yPercent: -100 }, at)
        tl.fromTo(titles[i], { opacity: 0, yPercent: 100 }, { duration: 0.4, opacity: 1, yPercent: 0 }, at + 0.2)
        tl.to(bodies[i - 1], { duration: 0.3, opacity: 0, y: -20 }, at)
        tl.fromTo(bodies[i], { opacity: 0, y: 30 }, { duration: 0.4, opacity: 1, y: 0 }, at + 0.25)
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
                        <div className="absolute inset-0">
                          <Media className="absolute inset-0" fill imgClassName="object-cover" resource={step.image} size="(min-width: 1024px) 26rem, 70vw" />
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
