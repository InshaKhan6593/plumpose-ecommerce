import type { Metadata } from 'next'

import configPromise from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import type { Media as MediaType, Project } from '@/payload-types'

import { ButtonLink, ClosingBand, PageHeading, PageShell } from '@/components/editorial'
import { type Film, InViewFilm } from '@/components/editorial/InViewFilm'
import { Media } from '@/components/Media'
import { CATEGORY_LABELS, MADE_FOR_YOU } from '@/content/pages'
import { Reveal, RevealImage } from '@/motion/Reveal'
import { cn } from '@/utilities/cn'
import { loadPageMedia } from '@/utilities/pageMedia'

export const metadata: Metadata = {
  description: 'Bridal sets, bespoke pieces, special embroidery and collaborations, made by hand in Doha.',
  title: 'Made for you',
}

type Props = { searchParams: Promise<{ category?: string }> }

/**
 * Made for You (REQUIREMENTS S11, docs/SCREEN-PROMPTS 12).
 *
 * Three parts:
 *   - what she makes to commission — the Projects collection's categories,
 *     each with a photograph, so the page says something true before a single
 *     project is published;
 *   - how a commission runs, 01–04;
 *   - her published projects, filterable by category, each opening its own
 *     page. Only shown once there are some — nothing is invented.
 */
export default async function MadeForYouPage({ searchParams }: Props) {
  const { category } = await searchParams
  const payload = await getPayload({ config: configPromise })

  const [pick, projects] = await Promise.all([
    loadPageMedia(payload),
    payload.find({
      collection: 'projects',
      depth: 1,
      limit: 60,
      overrideAccess: false,
      pagination: false,
      sort: '_order',
    }),
  ])

  const offerImages: Record<string, MediaType | undefined> = {
    bespoke: pick('armchair'),
    bridal: pick('window'),
    collaboration: pick('qatarBook', 'packaging'),
    // Until an embroidery close-up exists, the atelier shot's gold initial shows the stitching.
    embroidery: pick('piping', 'embroidery', 'atelier'),
  }

  /*
   * Bridal gets the portrait cut of the café breakfast film — "the morning of
   * the wedding". It spares the window photograph, which is already the shop
   * card, the product page and a homepage step.
   */
  const offerFilms: Record<string, (Film & { label: string }) | undefined> = {
    bridal: {
      label: 'A slow breakfast in a café, in the Al Shaheen Nights silk set',
      mp4: '/video/story-cafe.mp4',
      poster: '/video/story-cafe-poster.jpg',
      // The same clip and frame as the phone hero, so a phone downloads it once.
      small: '/video/hero-mobile.mp4',
    },
  }

  const all = projects.docs as Project[]
  const presentCategories = [...new Set(all.map((p) => p.category))]
  const activeCategory = presentCategories.includes(category as Project['category']) ? (category as Project['category']) : null
  const shown = activeCategory ? all.filter((p) => p.category === activeCategory) : all

  return (
    <>
      <PageShell className="pt-14 md:pt-20">
        <PageHeading intro={MADE_FOR_YOU.intro} title={MADE_FOR_YOU.heading} />

        {/* What she makes */}
        <ul className="mt-16 grid gap-x-6 gap-y-14 sm:grid-cols-2 md:mt-24 lg:grid-cols-4">
          {MADE_FOR_YOU.offers.map((offer, n) => {
            const image = offerImages[offer.key]
            const film = offerFilms[offer.key]
            return (
              // Staggered heights, as in the mockup, so four tiles do not read as a product grid.
              <li className={cn(n % 2 === 1 && 'lg:mt-16')} key={offer.key}>
                {film || image ? (
                  <RevealImage className="relative aspect-[3/4] overflow-hidden bg-paper-3">
                    {film ? (
                      <InViewFilm className="object-[50%_30%]" film={film} label={film.label} />
                    ) : (
                      <Media className="absolute inset-0" fill imgClassName="object-cover" resource={image} size="(min-width: 1024px) 23vw, (min-width: 640px) 48vw, 100vw" />
                    )}
                  </RevealImage>
                ) : null}
                <Reveal className="mt-6">
                  <p className="caps text-[0.5625rem] text-ink-soft tabular-nums" data-reveal>
                    {String(n + 1).padStart(2, '0')}
                  </p>
                  <h2 className="serif-display mt-3 text-[1.875rem]" data-reveal>
                    {offer.title}
                  </h2>
                  <p className="mt-3 text-[0.9375rem] leading-[1.75] text-ink-soft" data-reveal>
                    {offer.body}
                  </p>
                </Reveal>
              </li>
            )
          })}
        </ul>

        {/* How it works */}
        <Reveal as="section" className="mt-24 border-t border-line pt-10 md:mt-36">
          <h2 className="caps text-[0.6875rem]" data-reveal>
            {MADE_FOR_YOU.process.label}
          </h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {MADE_FOR_YOU.process.steps.map((step, n) => (
              <li data-reveal key={step.title}>
                <p className="serif-display text-[2.75rem] leading-none text-ink-faint tabular-nums">{String(n + 1).padStart(2, '0')}</p>
                <h3 className="serif-display mt-5 text-[1.5rem]">{step.title}</h3>
                <p className="mt-2 max-w-xs text-[0.9375rem] leading-[1.75] text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* Her projects — only once she has published some */}
        {all.length ? (
          <section className="mt-24 md:mt-36">
            <Reveal className="text-center">
              <h2 className="serif-display text-[clamp(2.5rem,4.5vw,4rem)]" data-reveal-lines>
                {MADE_FOR_YOU.projectsHeading}
              </h2>
            </Reveal>

            {presentCategories.length > 1 ? (
              <nav aria-label="Filter by category" className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3">
                {[null, ...presentCategories].map((key) => (
                  <Link
                    className={cn(
                      'caps pb-1 text-[0.625rem] transition-colors',
                      key === activeCategory ? 'border-b border-ink text-ink' : 'text-ink-soft hover:text-ink',
                    )}
                    href={key ? `/made-for-you?category=${key}#projects` : '/made-for-you#projects'}
                    key={key ?? 'all'}
                    scroll={false}
                  >
                    {key ? CATEGORY_LABELS[key] : 'All'}
                  </Link>
                ))}
              </nav>
            ) : null}

            <ul className="mt-12 grid scroll-mt-32 gap-x-6 gap-y-16 md:grid-cols-3" id="projects">
              {shown.map((project, n) => (
                <li className={cn(n % 3 === 1 && 'md:mt-20')} key={project.id}>
                  <Link className="group block" href={`/made-for-you/${project.slug}`}>
                    {typeof project.coverImage === 'object' && project.coverImage ? (
                      <RevealImage className="relative aspect-[4/5] overflow-hidden bg-paper-3">
                        {/* RevealImage drives the first child's transform, so the hover zoom sits one level in. */}
                        <div className="absolute inset-0">
                          <Media
                            className="absolute inset-0 transition-transform duration-700 ease-brand group-hover:scale-[1.03]"
                            fill
                            imgClassName="object-cover"
                            resource={project.coverImage}
                            size="(min-width: 768px) 31vw, 100vw"
                          />
                        </div>
                      </RevealImage>
                    ) : null}
                    <p className="caps mt-5 text-[0.5625rem] text-ink-soft">
                      {CATEGORY_LABELS[project.category]}
                      {project.brandName ? ` · ${project.brandName}` : ''}
                    </p>
                    <h3 className="serif-display mt-2 text-[1.75rem] leading-tight">{project.title}</h3>
                    {project.summary ? <p className="mt-2 text-[0.9375rem] leading-[1.7] text-ink-soft">{project.summary}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageShell>

      <ClosingBand body={MADE_FOR_YOU.enquiry.body} className="mt-24 md:mt-36" line={MADE_FOR_YOU.enquiry.heading}>
        <ButtonLink href="/contact?subject=Made+for+you">{MADE_FOR_YOU.enquiry.cta}</ButtonLink>
      </ClosingBand>
    </>
  )
}
