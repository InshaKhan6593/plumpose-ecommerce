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

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { gsap, ScrollTrigger, SplitText }
