'use client'

import Link from 'next/link'
import React, { useLayoutEffect, useRef } from 'react'

import type { Media as MediaType } from '@/payload-types'

import { Media } from '@/components/Media'
import { gsap, prefersReducedMotion } from '@/motion/gsap'

import { HOME } from './content'

/**
 * "The Print" — the image expansion (MOTION-SPEC §3B,
 * docs/mockups/02-home-the-print.webp).
 *
 * The section holds still for one and a half screens of scrolling while a
 * small editorial card of the print opens out to fill the screen; its caption
 * fades as it grows, and the story fades in over the full image at the end.
 * The scroll is the easing — Lenis gives it the inertia.
 *
 * Without the script, or under reduced motion, it is simply the full image
 * with its words: the finished state, never a half-built one.
 */
export type PrintFact = { label: string; value: string }

export function PrintBand({ facts = [], href, image }: { facts?: PrintFact[]; href: string; image?: MediaType }) {
  const root = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el || !image || prefersReducedMotion()) return

    const frame = el.querySelector<HTMLElement>('[data-print-frame]')
    const picture = el.querySelector<HTMLElement>('[data-print-picture]')
    const caption = el.querySelector<HTMLElement>('[data-print-caption]')
    const copy = el.querySelector<HTMLElement>('[data-print-copy]')
    const shade = el.querySelector<HTMLElement>('[data-print-shade]')
    const factEls = Array.from(el.querySelectorAll<HTMLElement>('[data-print-fact]'))

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      mm.add({ desktop: '(min-width: 1024px)', phone: '(max-width: 1023px)' }, (c) => {
        const { desktop } = c.conditions as { desktop: boolean }
        // The card's starting size: a portrait card, narrower on a wide screen.
        const start = desktop ? 'inset(20% 36% 20% 36% round 0px)' : 'inset(18% 18% 18% 18% round 0px)'

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            end: '+=150%',
            pin: true,
            /*
             * Measured before every other trigger. This pin adds a screen and a
             * half of spacing, and triggers further down the page (the steps,
             * the product band) were measuring their positions without it —
             * the steps played two screens early. Higher refreshes first.
             */
            refreshPriority: 1,
            scrub: true,
            start: 'top top',
            trigger: el,
          },
        })

        tl.fromTo(frame, { clipPath: start }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1 }, 0)
          .fromTo(picture, { scale: 1.25 }, { duration: 1, scale: 1 }, 0)
          .fromTo(caption, { opacity: 1 }, { duration: 0.3, opacity: 0 }, 0)
          .fromTo(shade, { opacity: 0 }, { duration: 0.3, opacity: 1 }, 0.7)
          .fromTo(copy, { opacity: 0, y: 30 }, { duration: 0.3, opacity: 1, y: 0 }, 0.7)
          .fromTo(factEls, { opacity: 0, y: 24 }, { duration: 0.25, opacity: 1, stagger: 0.06, y: 0 }, 0.78)
      })
    }, el)

    return () => ctx.revert()
  }, [image])

  if (!image) return null

  return (
    <section aria-label={HOME.print.label} className="relative h-svh overflow-hidden bg-background" ref={root}>
      <div className="absolute inset-0 overflow-hidden" data-print-frame>
        <div className="absolute inset-0" data-print-picture>
          {/*
            A portrait photo in this landscape frame keeps the shark's head,
            which sits high in the shot; a landscape photo is simply centred.
          */}
          <Media
            className="absolute inset-0"
            fill
            imgClassName={(image.width ?? 0) > (image.height ?? 0) ? 'object-cover' : 'object-cover object-[50%_22%]'}
            resource={image}
            size="100vw"
          />
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-tr from-ink/70 via-ink/20 to-transparent" data-print-shade />
      </div>

      {/* Beneath the small card at the start; fades as it grows. */}
      <p
        aria-hidden
        className="caps pointer-events-none absolute inset-x-0 bottom-[12%] text-center text-[0.625rem] text-ink opacity-0"
        data-print-caption
      >
        {HOME.print.label}
      </p>

      <div className="absolute bottom-[12%] left-6 max-w-xl text-white md:left-14" data-print-copy>
        <p className="caps text-[0.625rem]">{HOME.print.label}</p>
        <h2 className="serif-display mt-4 text-[clamp(2.75rem,5.5vw,5rem)] leading-[1]">
          {HOME.print.heading.map((line) => (
            <span className="block" key={line}>
              {line}
            </span>
          ))}
        </h2>
        <p className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-white/85">{HOME.print.body}</p>
        <Link className="caps mt-7 inline-block border-b border-white pb-1 text-[0.625rem]" href={href}>
          {HOME.print.cta}
        </Link>
      </div>

      {/* Facts, as the reference sets its figures — from her own settings, never invented. */}
      {facts.length ? (
        <dl className="absolute right-6 bottom-[12%] hidden gap-14 text-white md:flex md:right-14">
          {facts.map((fact) => (
            <div data-print-fact key={fact.label}>
              <dd className="serif-display text-[clamp(2.5rem,4vw,3.75rem)] leading-none">{fact.value}</dd>
              <dt className="caps mt-3 text-[0.5625rem] text-white/75">{fact.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}
