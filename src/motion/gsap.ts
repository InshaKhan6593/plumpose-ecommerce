'use client'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

/**
 * The one place GSAP is configured. Import `gsap`, `ScrollTrigger` and
 * `SplitText` from here, never from 'gsap' directly, so the plugins are always
 * registered and the house easing is always the default.
 *
 * The motion language is written down in docs/MOTION-SPEC.md: slow, weighted,
 * eases out — silk settling, not snapping.
 */

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText)
  gsap.defaults({ duration: 1.1, ease: 'power3.out' })
}

export const MOTION = {
  /** Heading lines rising from their mask. */
  lineStagger: 0.08,
  /** Labels and paragraphs after a heading. */
  itemStagger: 0.1,
  /** Where an element's top must reach before it reveals. */
  start: 'top 85%',
} as const

/**
 * Split a heading into lines, each inside a mask it can rise out of. Always
 * use this rather than calling SplitText directly: the masks carry the
 * `split-line-mask` class, which globals.css extends below the line so
 * descenders (the y of "differently", the g of "gathering") are not cut off by
 * a tight line-height.
 */
export const splitLines = (el: HTMLElement) =>
  SplitText.create(el, { linesClass: 'split-line', mask: 'lines', type: 'lines' })

/**
 * Where a masked line starts, in % of its own height. It must clear the mask's
 * extended bottom edge as well as the line itself, or the tops of the letters
 * show before the reveal begins.
 */
export const LINE_HIDDEN = 130

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { gsap, ScrollTrigger, SplitText }
