'use client'

import React, { useLayoutEffect, useRef } from 'react'

import { gsap, LINE_HIDDEN, MOTION, prefersReducedMotion, ScrollTrigger, splitLines } from './gsap'

/**
 * The house reveal — "staggered fade and slide" (MOTION-SPEC §3C).
 *
 * Wrap a group and mark what moves:
 *
 *   <Reveal>
 *     <h1 data-reveal-lines>Al Shaheen Nights</h1>   ← lines rise from a mask
 *     <p data-reveal>Silk Pyjama Set</p>             ← fade and rise, staggered
 *   </Reveal>
 *
 * Plays once, when the group's top reaches 85% of the viewport. Never replays
 * on scroll-up — replaying reads as cheap. Under reduced motion nothing
 * animates; the CSS failsafe simply lets the content show.
 */
export function Reveal({
  as: Tag = 'div',
  children,
  className,
  delay = 0,
}: {
  as?: React.ElementType
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion()) return

    const lineEls = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal-lines]'))
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))

    // Own the starting state before the CSS failsafe is lifted.
    gsap.set([...lineEls, ...items], { opacity: 0 })

    let ctx: gsap.Context | undefined
    let cancelled = false

    // Split after the webfonts load, or the lines are measured in the fallback face.
    document.fonts.ready.then(() => {
      if (cancelled) return

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ delay, paused: true })

        lineEls.forEach((el) => {
          const split = splitLines(el)
          gsap.set(el, { opacity: 1 })
          tl.from(split.lines, { stagger: MOTION.lineStagger, yPercent: LINE_HIDDEN }, 0)
        })

        if (items.length) {
          tl.fromTo(
            items,
            { opacity: 0, y: 40 },
            { opacity: 1, stagger: MOTION.itemStagger, y: 0 },
            lineEls.length ? 0.15 : 0,
          )
        }

        ScrollTrigger.create({ onEnter: () => tl.play(), once: true, start: MOTION.start, trigger: root })
      }, root)
    })

    return () => {
      cancelled = true
      ctx?.revert()
    }
  }, [delay])

  return (
    <Tag className={className} ref={ref}>
      {children}
    </Tag>
  )
}

/**
 * An image that unveils upward as it scrolls in — the frame opens from the
 * bottom while the picture settles from a slight zoom — and then keeps a
 * little depth: the picture drifts inside its frame more slowly than the page
 * scrolls. It rests at 108% of the frame, so the drift (±3%) can never show an
 * edge. `parallax={false}` for frames that must stay still.
 *
 * `start` is where the frame's top must reach before it opens. The default
 * waits until it is a little way up the screen; use `'top bottom'` where an
 * empty frame arriving from below would read as a gap in the page.
 */
export function RevealImage({
  children,
  className,
  parallax = true,
  start = 'top 90%',
}: {
  children: React.ReactNode
  className?: string
  parallax?: boolean
  start?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const inner = el.firstElementChild
      const rest = parallax ? 1.08 : 1
      const tl = gsap.timeline({ paused: true })
      tl.fromTo(
        el,
        { clipPath: 'inset(100% 0% 0% 0%)', opacity: 1 },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.out' },
      )
      if (inner) tl.fromTo(inner, { scale: 1.2 }, { duration: 1.8, ease: 'expo.out', scale: rest }, 0)

      ScrollTrigger.create({ onEnter: () => tl.play(), once: true, start, trigger: el })

      if (inner && parallax) {
        gsap.fromTo(
          inner,
          { yPercent: -3 },
          { ease: 'none', scrollTrigger: { end: 'bottom top', scrub: 1, start: 'top bottom', trigger: el }, yPercent: 3 },
        )
      }
    }, el)

    return () => ctx.revert()
  }, [parallax, start])

  return (
    <div className={className} data-reveal-image="" ref={ref}>
      {children}
    </div>
  )
}
