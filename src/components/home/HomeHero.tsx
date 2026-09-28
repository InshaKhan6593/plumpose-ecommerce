'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { gsap, LINE_HIDDEN, prefersReducedMotion, ScrollTrigger, splitLines } from '@/motion/gsap'
import { afterPageLoad } from '@/utilities/afterPageLoad'

import { HOME } from './content'

/**
 * The homepage hero — after the client's reference recording
 * (brand-assets/reference/client-reference-animation.mov).
 *
 * One cinematic frame, not a collage: the café film full-screen, the header
 * over it in white, the headline in mixed upright and italic. (A framed close-up
 * of the print used to sit on the right; removed at her request, 27 Sep 2026.)
 *
 * The page wraps this in a sticky layer, so the next section slides up over it
 * like a curtain (see src/app/(app)/page.tsx). As it is covered the film leans
 * in and dims.
 *
 * Only one film loads — landscape on desktop, the same café shot in its full
 * portrait frame on a phone — and only after the page itself has loaded; none
 * under reduced motion, where the poster stands in.
 */

/**
 * `webm` is optional: the café films ship as H.264 only (scripts/encode-videos.sh).
 * `once`: play through a single time and rest on the last frame, for a film
 * whose end does not meet its start.
 */
type Film = { mp4: string; once?: boolean; poster: string; webm?: string }

/**
 * Where the crop anchors when the screen's shape differs from the film's. Her
 * face sits in the upper third of the frame, so on very wide or very tall
 * screens the crop keeps the top and gives up the bottom.
 */
const FOCUS = '50% 28%'

export function HomeHero({
  copy = HOME.hero,
  ctaHref,
  films,
}: {
  /** Her words from Page text; the defaults in content.ts otherwise. */
  copy?: typeof HOME.hero
  ctaHref: string
  films: { desktop: Film; mobile: Film }
}) {
  const root = useRef<HTMLElement>(null)
  const [film, setFilm] = useState<'desktop' | 'mobile' | null>(null)

  // The poster is the first paint; the film joins once the page has loaded (see afterPageLoad).
  useEffect(() => {
    if (prefersReducedMotion()) return
    return afterPageLoad(() =>
      setFilm(window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile'),
    )
  }, [])

  useLayoutEffect(() => {
    const el = root.current
    if (!el || prefersReducedMotion()) return

    const filmLayer = el.querySelector<HTMLElement>('[data-hero-film]')
    const depth = el.querySelector<HTMLElement>('[data-hero-depth]')
    const dim = el.querySelector<HTMLElement>('[data-hero-dim]')
    const tagline = el.querySelector<HTMLElement>('[data-hero-tagline]')
    const words = Array.from(el.querySelectorAll<HTMLElement>('[data-hero-word]'))
    const copy = el.querySelector<HTMLElement>('[data-hero-copy]')

    gsap.set([tagline, ...words].filter(Boolean), { opacity: 0 })

    let ctx: gsap.Context | undefined
    let cancelled = false

    document.fonts.ready.then(() => {
      if (cancelled) return

      ctx = gsap.context(() => {
        // ---------- intro ----------
        const intro = gsap.timeline({ defaults: { ease: 'expo.out' } })
        // The film settles from a slow push-in, like a shot opening.
        intro.fromTo(
          filmLayer,
          { opacity: 0, scale: 1.18 },
          { duration: 2.6, opacity: 1, scale: 1 },
          0,
        )

        if (tagline) {
          gsap.set(tagline, { opacity: 1 })
          const split = splitLines(tagline)
          intro.from(split.lines, { duration: 1.5, stagger: 0.14, yPercent: LINE_HIDDEN }, 0.45)
        }
        intro.fromTo(
          words,
          { opacity: 0, y: 18 },
          { duration: 1.3, opacity: 1, stagger: 0.12, y: 0 },
          1,
        )

        // ---------- curtain: as the next section covers the hero ----------
        /*
         * The film sinks and leans in behind the frame, dims, and the words lift
         * away — while the next section rises over it. `scrub: 1` lets it trail
         * the scroll by a beat, so it glides instead of tracking the wheel 1:1.
         *
         * Only what is *inside* the frame moves. Scaling the section itself
         * (the first version) shrank it away from the screen edges and showed
         * a cream border around the film for the whole of the curtain.
         */
        const cover = { end: '+=100%', scrub: 1, start: 'top top', trigger: el }
        if (depth) {
          // Scaling to 1.1 leaves 5% spare above the frame, so a 5% sink never uncovers its top edge.
          gsap.fromTo(
            depth,
            { scale: 1, yPercent: 0 },
            { ease: 'none', immediateRender: false, scale: 1.1, scrollTrigger: cover, yPercent: 5 },
          )
        }
        if (dim)
          gsap.fromTo(dim, { opacity: 0 }, { ease: 'none', opacity: 0.7, scrollTrigger: cover })
        if (copy)
          gsap.to(copy, {
            ease: 'none',
            opacity: 0,
            scrollTrigger: { ...cover, end: '+=55%' },
            yPercent: -30,
          })
      }, el)

      ScrollTrigger.refresh()
    })

    return () => {
      cancelled = true
      ctx?.revert()
    }
  }, [])

  return (
    <section
      aria-label="Welcome"
      className="relative h-svh min-h-[36rem] overflow-hidden bg-ink text-white"
      ref={root}
    >
      {/* The film — the outer layer carries the curtain's depth, the inner the intro. */}
      <div className="absolute inset-0 will-change-transform" data-hero-depth>
        <div className="absolute inset-0" data-hero-film>
          {/*
            One poster for both screen sizes, so a phone downloads only its own:
            as two <img>s, each hidden by CSS, both were preloaded and the
            unused one competed with the largest paint.
          */}
          <picture>
            <source media="(min-width: 1024px)" srcSet={films.desktop.poster} />
            <img
              alt="The Al Shaheen Nights set, worn reading the paper beside a courtyard fountain"
              className="absolute inset-0 h-full w-full object-cover"
              fetchPriority="high"
              src={films.mobile.poster}
              style={{ objectPosition: FOCUS }}
            />
          </picture>
          <div className="absolute inset-0 hidden lg:block">
            <HeroFilm active={film === 'desktop'} film={films.desktop} />
          </div>
          <div className="absolute inset-0 lg:hidden">
            <HeroFilm active={film === 'mobile'} film={films.mobile} />
          </div>
        </div>
      </div>

      {/* Shade for legibility: header on top, words bottom-left. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-ink/45 via-transparent to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-tr from-ink/75 via-ink/15 to-transparent"
      />
      {/* Deepens as the next section slides over. */}
      <div aria-hidden className="absolute inset-0 bg-ink opacity-0" data-hero-dim />

      <div className="absolute inset-x-4 bottom-[9%] md:inset-x-7" data-hero-copy>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1
              className="text-[clamp(4.25rem,10vw,10.5rem)] leading-[0.9]"
              data-hero-tagline
              data-reveal-lines
            >
              <span className="serif-display block">{copy.tagline[0]}</span>
              {/* The space is for text readers (search, screen readers): "Wear your world", not "Wearyour". */}
              <span className="serif-italic block"> {copy.tagline[1]}</span>
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-7" data-hero-word data-reveal>
              <Link
                className="caps bg-white px-8 py-4 text-[0.625rem] text-ink transition-opacity hover:opacity-85"
                href={ctaHref}
              >
                {copy.cta}
              </Link>
              <Link
                className="caps border-b border-white/70 pb-1 text-[0.625rem]"
                href="/our-story"
              >
                Our story ↗
              </Link>
            </div>
          </div>

          <p
            className="hidden max-w-[17rem] text-sm leading-relaxed text-white/80 lg:block"
            data-hero-word
            data-reveal
          >
            {copy.intro}
          </p>
        </div>
      </div>
    </section>
  )
}

/**
 * The film, over the poster, once the screen size is known. Muted and inline
 * — the only way a film may autoplay on iOS — and paused whenever it is off
 * screen. A `once` film does not loop, and once it has ended it stays on its
 * last frame: coming back to the top does not start it again.
 */
function HeroFilm({ active, film }: { active: boolean; film: Film }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!video.ended) video.play().catch(() => undefined)
      } else video.pause()
    })
    io.observe(video)
    return () => io.disconnect()
  }, [active])

  return (
    <>
      {active ? (
        <video
          aria-hidden
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
          loop={!film.once}
          muted
          playsInline
          poster={film.poster}
          preload="auto"
          ref={ref}
          style={{ objectPosition: FOCUS }}
        >
          {film.webm ? <source src={film.webm} type="video/webm" /> : null}
          <source src={film.mp4} type="video/mp4" />
        </video>
      ) : null}
    </>
  )
}
