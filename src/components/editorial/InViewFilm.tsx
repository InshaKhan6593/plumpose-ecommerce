'use client'

import { useEffect, useRef, useState } from 'react'

import { prefersReducedMotion } from '@/motion/gsap'
import { afterPageLoad } from '@/utilities/afterPageLoad'
import { cn } from '@/utilities/cn'

/**
 * `webm` is optional: the café films ship as H.264 only (scripts/encode-videos.sh).
 * `small` is a lighter encode of the same frame for phone screens — a third to
 * a quarter smaller, with no difference a phone can show.
 */
export type Film = { mp4: string; poster: string; small?: string; webm?: string }

const PHONE = '(max-width: 767px)'

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
  const [small, setSmall] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    let stopWaiting = () => {}
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          near.disconnect()
          // Near, but never before the page's own photographs have loaded.
          stopWaiting = afterPageLoad(() => {
            setSmall(Boolean(film.small) && window.matchMedia(PHONE).matches)
            setLoad(true)
          })
        }
      },
      { rootMargin: '100% 0px' },
    )
    near.observe(el)
    return () => {
      near.disconnect()
      stopWaiting()
    }
  }, [film.small])

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
          {small ? null : film.webm ? <source src={film.webm} type="video/webm" /> : null}
          <source src={small && film.small ? film.small : film.mp4} type="video/mp4" />
        </video>
      ) : null}
    </div>
  )
}
