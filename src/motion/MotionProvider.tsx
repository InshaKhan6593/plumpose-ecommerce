'use client'

import Lenis from 'lenis'
import { usePathname } from 'next/navigation'
import React, { createContext, useContext, useEffect, useRef } from 'react'

import { gsap, prefersReducedMotion, ScrollTrigger } from './gsap'

/**
 * Smooth scrolling and the scroll clock every animation runs on.
 *
 * Lenis gives the inertial, "buttery" scroll of the reference sites; GSAP's
 * ticker drives it so ScrollTrigger and Lenis agree on every frame. Under
 * `prefers-reduced-motion` there is no Lenis at all — native scrolling, and
 * the reveal components skip their animation.
 *
 * It also adds `motion-ready` to <html>, which lifts the CSS failsafe in
 * globals.css. Children's layout effects run before this effect, so by then
 * every reveal has already set its own starting state.
 */

const LenisContext = createContext<{ current: Lenis | null }>({ current: null })

/** For drawers and modals: `lenis.current?.stop()` while open, `start()` on close. */
export const useLenis = () => useContext(LenisContext)

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.classList.add('motion-ready')

    if (prefersReducedMotion()) return

    const lenis = new Lenis({ autoRaf: false, duration: 1.15, smoothWheel: true })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  /**
   * A new page starts at the top, and its triggers measure the new layout.
   * Not on the first page: ScrollTrigger refreshes itself when the window
   * loads, and a second full re-measure there was pure start-up cost.
   */
  const firstPage = useRef(true)
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false
      return
    }
    lenisRef.current?.scrollTo(0, { immediate: true })
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 50)
    return () => window.clearTimeout(id)
  }, [pathname])

  return <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>
}
