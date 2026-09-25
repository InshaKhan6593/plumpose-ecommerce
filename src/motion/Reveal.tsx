'use client'

import React, { useLayoutEffect, useRef } from 'react'

import { gsap, LINE_HIDDEN, MOTION, prefersReducedMotion, splitLines } from './gsap'

/**
 * Runs `onReach` once, when `el`'s top crosses `line` (a fraction of the
 * viewport height from the top: 0.85 is 85% down the screen, 2 is a screen
 * below it) — or at once if the element is already above it, as after a jump
 * to an anchor or a restored scroll.
 *
 * Why not a ScrollTrigger: every trigger is measured when it is made and again
 * on every refresh, and every page used to make one per reveal on load —
 * including reveals a visitor may never scroll to. On a mid-range phone that
 * set-up was most of the half-second freeze after each page loaded. An
 * IntersectionObserver costs nothing until the element arrives, and the work
 * (splitting lines, building the timeline) happens only then.
 */
export function whenReached(el: Element, line: number, onReach: () => void): () => void {
  let done = false
  const io = new IntersectionObserver(
    ([entry]) => {
      if (done) return
      // Intersecting the viewport shrunk to `line`, or already scrolled past it.
      if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
        done = true
        io.disconnect()
        onReach()
      }
    },
    // Below 1 the viewport's bottom is pulled up to the line; above 1 it reaches further down the page.
    { rootMargin: `0px 0px ${Math.round((line - 1) * 100)}% 0px` },
  )
  io.observe(el)
  return () => {
    done = true
    io.disconnect()
  }
}

/** A frame before it opens. Mirrored by `[data-reveal-wait]` in globals.css. */
const CLOSED = 'inset(100% 0% 0% 0%)'

/** "top 85%" → 0.85, for the ScrollTrigger-style `start` strings the components take. */
const lineOf = (start: string, fallback: number) => {
  const pct = start.match(/top\s+(\d+)%/)
  if (pct) return Number(pct[1]) / 100
  if (/top\s+bottom/.test(start)) return 1
  return fallback
}

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

    /*
     * Until it arrives, `data-reveal-wait` keeps it hidden from CSS (globals.css)
     * — not a gsap.set here. GSAP's first write reads computed style, and doing
     * that for every group on the page as it mounted forced a whole-page style
     * recalculation in the middle of hydration.
     */
    let ctx: gsap.Context | undefined
    let cancelled = false

    // Nothing is split or built until the group reaches the line (MOTION.start, "top 85%").
    const stop = whenReached(root, lineOf(MOTION.start, 0.85), () => {
      // Split after the webfonts load, or the lines are measured in the fallback face.
      document.fonts.ready.then(() => {
        if (cancelled) return

        ctx = gsap.context(() => {
          const tl = gsap.timeline({ delay })

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
          // GSAP now holds the hidden state inline, so the CSS can let go.
          root.removeAttribute('data-reveal-wait')
        }, root)
      })
    })

    return () => {
      cancelled = true
      stop()
      ctx?.revert()
    }
  }, [delay])

  return (
    <Tag className={className} data-reveal-wait="" ref={ref}>
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

    const inner = el.firstElementChild
    const rest = parallax ? 1.08 : 1
    // Closed until it arrives: `data-reveal-wait` in globals.css, for the reason given in Reveal.
    const ctx = gsap.context(() => undefined, el)

    // The unveil plays when the frame reaches its line.
    const stopReveal = whenReached(el, lineOf(start, 0.9), () => {
      ctx.add(() => {
        gsap.fromTo(
          el,
          { clipPath: CLOSED, opacity: 1 },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.out' },
        )
        if (inner)
          gsap.fromTo(inner, { scale: 1.2 }, { duration: 1.8, ease: 'expo.out', scale: rest })
        el.removeAttribute('data-reveal-wait')
      })
    })

    /*
     * The drift is scrubbed, so it needs a ScrollTrigger — but only once the
     * frame is within a screen of the viewport, not for every photograph on
     * the page at load.
     */
    const stopDrift =
      inner && parallax
        ? whenReached(el, 2, () => {
            ctx.add(() => {
              gsap.fromTo(
                inner,
                { yPercent: -3 },
                {
                  ease: 'none',
                  scrollTrigger: { end: 'bottom top', scrub: 1, start: 'top bottom', trigger: el },
                  yPercent: 3,
                },
              )
            })
          })
        : () => undefined

    return () => {
      stopReveal()
      stopDrift()
      ctx.revert()
    }
  }, [parallax, start])

  return (
    <div className={className} data-reveal-image="" data-reveal-wait="" ref={ref}>
      {children}
    </div>
  )
}
