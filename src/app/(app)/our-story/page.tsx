import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { ButtonLink, ClosingBand, Prose, SplitBand, TextLink } from '@/components/editorial'
import { StoryOpener } from '@/components/editorial/StoryOpener'
import { Media } from '@/components/Media'
import { getPageText } from '@/content/getPageText'
import { Reveal, RevealImage } from '@/motion/Reveal'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { loadPageMedia } from '@/utilities/pageMedia'

export const metadata: Metadata = {
  description:
    'The story behind plumpose and the Al Shaheen Nights print: silk nightwear inspired by the whale sharks of Qatar, hand-finished to order in Doha.',
  title: 'Our story',
}

/**
 * Our Story (docs/SCREEN-PROMPTS 11), built as an editorial page:
 *
 *   1. opener — the café film opens from a card to the full screen (StoryOpener)
 *   2. the house — who makes it, beside her portrait
 *   3. behind the print — her own text from the old site, beside the corridor film
 *   4. the silk — her three "why it lasts" pillars, each with a photograph
 *   5. the atelier — hand embroidery, with live figures from Site settings
 *   6. closing line and the way to the piece
 *
 * The homepage's "Read the story" link lands on §3; the old site's "The Silk"
 * page is §4 (#the-silk). Copy provenance is marked in src/content/pages.ts.
 */
export default async function OurStoryPage() {
  const { featuredProductId, OUR_STORY } = await getPageText()
  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()

  const [pick, products, threads] = await Promise.all([
    loadPageMedia(payload),
    // Her featured piece first (Page text → Homepage), then the first in the shop.
    payload.find({
      collection: 'products',
      depth: 0,
      limit: 1,
      select: { slug: true },
      sort: ['_order', 'createdAt'],
      where: { _status: { equals: 'published' } },
    }),
    payload.count({
      collection: 'personalisationOptions',
      where: { and: [{ type: { equals: 'thread' } }, { active: { not_equals: false } }] },
    }),
  ])

  const featured =
    (featuredProductId
      ? (
          await payload.find({
            collection: 'products',
            depth: 0,
            limit: 1,
            select: { slug: true },
            where: {
              and: [{ id: { equals: featuredProductId } }, { _status: { equals: 'published' } }],
            },
          })
        ).docs[0]
      : undefined) ?? products.docs[0]
  const productHref = featured?.slug ? `/products/${featured.slug}` : '/shop'
  const pillarImages = [pick('armchair'), pick('piping'), pick('print', 'printWide')]
  const sea = pick.only('sea')

  // The atelier's figures, all from her settings — never typed into the copy.
  const atelierFacts = [
    settings.personalisationFeeQar
      ? { label: 'Per placement', value: `QAR ${settings.personalisationFeeQar}` }
      : null,
    threads.totalDocs ? { label: 'Thread colours', value: String(threads.totalDocs) } : null,
    settings.personalisationLeadTime
      ? { label: 'To stitch by hand', value: settings.personalisationLeadTime }
      : null,
  ].filter((f): f is { label: string; value: string } => Boolean(f))

  return (
    <>
      <StoryOpener
        film={{
          mp4: '/video/story-pillow.mp4',
          poster: '/video/story-pillow-poster.jpg',
          small: '/video/story-pillow-small.mp4',
        }}
        heading={OUR_STORY.opener.heading}
        label={OUR_STORY.opener.label}
        lede={OUR_STORY.lede}
      />

      {/* The house */}
      <SplitBand
        className="pt-24 md:pt-36"
        image={pick('doorway', 'founder')}
        imgClassName="object-[50%_20%]"
      >
        <Prose
          body={OUR_STORY.founder.body}
          heading={OUR_STORY.founder.heading}
          label={OUR_STORY.founder.label}
        />
      </SplitBand>

      {/*
        Behind the print — her own words, beside the corridor film, which ends
        on a close-up of the print. It is the phone hero on the homepage, so
        desktop visitors see it only here; and the print macro still is
        already the homepage's Print band.
      */}
      <SplitBand
        className="pt-24 md:pt-36"
        film={{
          label:
            'Walking down a corridor in the Al Shaheen Nights set, then a close-up of the whale-shark print',
          mp4: '/video/story-walk.mp4',
          poster: '/video/story-walk-poster.jpg',
          webm: '/video/story-walk.webm',
        }}
        id="the-print"
        imgClassName="object-[50%_40%]"
        reverse
      >
        <Prose
          body={OUR_STORY.print.body}
          heading={OUR_STORY.print.heading}
          label={OUR_STORY.print.label}
        />
        <p className="serif-italic mt-8 text-2xl" data-reveal>
          {OUR_STORY.print.signoff}
        </p>
        <p className="caps mt-3 text-[0.5625rem] text-ink-soft" data-reveal>
          {OUR_STORY.print.signature}
        </p>
      </SplitBand>

      {/*
        The sea, wide — only when there is a photograph of it. It is a
        landscape shot with its subject at the edge (the dhow), so it gets a
        band of its own rather than a crop into the portrait frames.
      */}
      {sea ? (
        <section className="mx-auto max-w-[90rem] px-4 pt-24 md:px-7 md:pt-36">
          <RevealImage className="relative aspect-[4/3] overflow-hidden bg-paper-3 md:aspect-[21/9]">
            <Media
              className="absolute inset-0"
              fill
              imgClassName="object-cover object-[70%_50%]"
              resource={sea}
              size="100vw"
            />
          </RevealImage>
          <p className="caps mt-4 text-[0.5625rem] text-ink-soft">{OUR_STORY.print.seaCaption}</p>
        </section>
      ) : null}

      {/* The silk — three pillars, each with its photograph */}
      <section
        className="mx-auto max-w-[90rem] scroll-mt-28 px-4 pt-24 md:px-7 md:pt-36"
        id={OUR_STORY.silk.id}
      >
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="caps text-[0.625rem] text-ink-soft" data-reveal>
            {OUR_STORY.silk.label}
          </p>
          <h2 className="serif-display mt-5 text-[clamp(2.5rem,4.5vw,4.25rem)]" data-reveal-lines>
            {OUR_STORY.silk.heading}
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-12 md:mt-20 md:grid-cols-3 md:gap-6 lg:gap-10">
          {OUR_STORY.silk.pillars.map((pillar, n) => {
            const image = pillarImages[n]
            return (
              <li key={pillar.title}>
                {image ? (
                  <RevealImage className="relative aspect-[3/4] overflow-hidden bg-paper-3">
                    <Media
                      className="absolute inset-0"
                      fill
                      imgClassName="object-cover"
                      resource={image}
                      size="(min-width: 768px) 30vw, 100vw"
                    />
                  </RevealImage>
                ) : null}
                <Reveal className="mt-6">
                  <p className="caps text-[0.5625rem] text-ink-soft tabular-nums" data-reveal>
                    {String(n + 1).padStart(2, '0')}
                  </p>
                  <h3 className="serif-display mt-3 text-[1.75rem]" data-reveal>
                    {pillar.title}
                  </h3>
                  <p
                    className="mt-3 max-w-sm text-[0.9375rem] leading-[1.8] text-ink-soft"
                    data-reveal
                  >
                    {pillar.body}
                  </p>
                </Reveal>
              </li>
            )
          })}
        </ol>
      </section>

      {/* The atelier */}
      <SplitBand className="pt-24 md:pt-36" id="atelier" image={pick('qatarBook', 'atelier')}>
        <Prose
          body={OUR_STORY.atelier.body}
          heading={OUR_STORY.atelier.heading}
          label={OUR_STORY.atelier.label}
        />
        {atelierFacts.length ? (
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-line pt-8" data-reveal>
            {atelierFacts.map((fact) => (
              <div key={fact.label}>
                <dd className="serif-display text-[clamp(1.5rem,2.4vw,2.25rem)] leading-none">
                  {fact.value}
                </dd>
                <dt className="caps mt-3 text-[0.5625rem] text-ink-soft">{fact.label}</dt>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="mt-10" data-reveal>
          <TextLink href={`${productHref}#personalisation`}>{OUR_STORY.atelier.cta}</TextLink>
        </div>
      </SplitBand>

      <ClosingBand className="mt-24 md:mt-36" line={OUR_STORY.closing.line}>
        <ButtonLink href={productHref}>{OUR_STORY.closing.cta}</ButtonLink>
      </ClosingBand>
    </>
  )
}
