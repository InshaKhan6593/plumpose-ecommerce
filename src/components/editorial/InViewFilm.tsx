'use client'

import React, { useEffect, useRef, useState } from 'react'

import { prefersReducedMotion } from '@/motion/gsap'
import { cn } from '@/utilities/cn'

/** `webm` is optional: the café films ship as H.264 only (scripts/encode-videos.sh). */
export type Film = { mp4: string; poster: string; webm?: string }

/**
 * A short film in place of a photograph, further down a page
 * (DESIGN-SPEC §5: "one in-view clip, starts on scroll, pauses when out of view").
 *
 * The poster is always there. The film's sources are only attached once the
 * frame comes within a screen of the viewport, so a visitor who never scrolls
 * this far never downloads it; it plays while visible and pauses otherwise.
 * Under reduced motion it stays the poster.
 *
 * Fills its parent (`absolute inset-0`), so it drops into the same frames as
 * <Media fill>, including RevealImage.
 */
export function InViewFilm({
  className,
  film,
  label,
  priority = false,
}: {
  className?: string
  film: Film
  label: string
  /** At the top of a page: the poster loads eagerly and at high priority (it is the largest paint). */
  priority?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [load, setLoad] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true)
          near.disconnect()
        }
      },
      { rootMargin: '100% 0px' },
    )
    near.observe(el)
    return () => near.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!load || !video) return
    const visible = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => undefined)
      else video.pause()
    })
    visible.observe(video)
    return () => visible.disconnect()
  }, [load])

  return (
    <div className="absolute inset-0" ref={ref}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={label}
        className={cn('absolute inset-0 h-full w-full object-cover', className)}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        src={film.poster}
      />
      {load ? (
        <video
          aria-hidden
          className={cn('absolute inset-0 h-full w-full object-cover', className)}
          loop
          muted
          playsInline
          poster={film.poster}
          preload="auto"
          ref={videoRef}
        >
          {film.webm ? <source src={film.webm} type="video/webm" /> : null}
          <source src={film.mp4} type="video/mp4" />
        </video>
      ) : null}
    </div>
  )
}
