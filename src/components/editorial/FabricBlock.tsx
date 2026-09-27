import React from 'react'

import type { Media as MediaType } from '@/payload-types'

import { FABRIC } from '@/content/pages'

import { SplitBand, TextLink } from './index'

/**
 * The fabric, in her words (FABRIC in src/content/pages.ts): name, spec line,
 * an italic line, a paragraph, the points, then care in one line and — on the
 * product page — the way to the full guidance. After the fabric block she
 * pointed at on brahmaki.com (her notes, 28 Sep 2026).
 */
export function FabricBlock({
  className,
  id = 'fabric',
  image,
  link = true,
}: {
  className?: string
  id?: string
  image?: MediaType
  /** The "Full fabric & care guidance" link — off on /fabric-care itself. */
  link?: boolean
}) {
  return (
    <SplitBand className={className} id={id} image={image} reverse>
      <p className="caps text-[0.625rem] text-ink-soft" data-reveal>
        {FABRIC.label}
      </p>
      <h2 className="serif-display mt-5 text-[clamp(2.25rem,3.6vw,3.5rem)]" data-reveal-lines>
        {FABRIC.heading}
      </h2>
      <p className="serif-italic mt-6 text-xl" data-reveal>
        {FABRIC.lede}
      </p>
      <p className="mt-4 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
        {FABRIC.body}
      </p>
      <ul className="mt-6 flex flex-col gap-2" data-reveal>
        {FABRIC.points.map((point) => (
          <li className="flex gap-3 text-[0.9375rem] leading-[1.7] text-ink-soft" key={point}>
            <span aria-hidden className="mt-[0.7em] size-1 shrink-0 rounded-full bg-ink-soft" />
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-10 border-t border-line pt-8" data-reveal>
        <p className="caps text-[0.625rem] text-ink">{FABRIC.care.label}</p>
        <p className="serif-italic mt-3 text-lg">{FABRIC.care.intro}</p>
        <p className="mt-3 text-[0.9375rem] leading-[1.8] text-ink-soft">{FABRIC.care.line}</p>
        {link ? (
          <TextLink className="mt-6" href="/fabric-care">
            {FABRIC.care.link} →
          </TextLink>
        ) : null}
      </div>
    </SplitBand>
  )
}
