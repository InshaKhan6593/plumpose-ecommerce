import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import type { Media as MediaType, Project } from '@/payload-types'

import { ButtonLink, ClosingBand, TextLink } from '@/components/editorial'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'
import { CATEGORY_LABELS } from '@/content/pages'
import { getPageText } from '@/content/getPageText'
import { Reveal, RevealImage } from '@/motion/Reveal'
import { cn } from '@/utilities/cn'

type Args = { params: Promise<{ slug: string }> }

/** Published projects only — `overrideAccess: false` applies the collection's own read rule. */
const findProject = cache(async (slug: string) => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'projects',
    depth: 1,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: { slug: { equals: slug } },
  })
  return (docs[0] as Project | undefined) ?? null
})

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const project = await findProject((await params).slug)
  if (!project) return {}
  return { description: project.summary ?? undefined, title: `${project.title} — Made for you` }
}

/**
 * A Made for You project (docs/SCREEN-PROMPTS 12, detail): the cover full
 * width, the title and summary, her description, an asymmetric gallery — one
 * tall photograph beside two — and the way to begin a commission of one's own.
 */
export default async function ProjectPage({ params }: Args) {
  const { MADE_FOR_YOU } = await getPageText()
  const project = await findProject((await params).slug)
  if (!project) notFound()

  const cover = typeof project.coverImage === 'object' ? (project.coverImage as MediaType) : null
  const gallery = (project.gallery ?? [])
    .map((row) => (typeof row.image === 'object' ? (row.image as MediaType) : null))
    .filter((m): m is MediaType => Boolean(m))

  return (
    <>
      {cover ? (
        <RevealImage className="relative mx-4 aspect-[4/5] overflow-hidden bg-paper-3 md:mx-7 md:aspect-[21/9]" start="top bottom">
          <Media className="absolute inset-0" fill imgClassName="object-cover object-[50%_30%]" priority resource={cover} size="100vw" />
        </RevealImage>
      ) : null}

      <Reveal className="mx-auto max-w-3xl px-4 pt-14 text-center md:pt-20">
        <p className="caps text-[0.625rem] text-ink-soft" data-reveal>
          {CATEGORY_LABELS[project.category]}
          {project.brandName ? ` · ${project.brandName}` : ''}
        </p>
        <h1 className="serif-display mt-5 text-[clamp(2.75rem,5.5vw,5rem)]" data-reveal-lines>
          {project.title}
        </h1>
        {project.summary ? (
          <p className="serif-italic mt-5 text-lg text-ink-soft md:text-xl" data-reveal>
            {project.summary}
          </p>
        ) : null}
      </Reveal>

      {project.description ? (
        <Reveal className="mx-auto mt-14 max-w-4xl px-4 md:mt-20">
          <div className="text-[0.9375rem] leading-[1.85] text-ink-soft md:columns-2 md:gap-14" data-reveal>
            <RichText className="[&_p]:mb-5 [&_p]:break-inside-avoid-column" data={project.description} enableGutter={false} enableProse={false} />
          </div>
        </Reveal>
      ) : null}

      {gallery.length ? (
        <div className="mx-auto mt-20 grid max-w-[90rem] gap-4 px-4 md:mt-28 md:grid-cols-2 md:gap-6 md:px-7">
          {gallery.map((image, n) => (
            <RevealImage
              className={cn(
                'relative overflow-hidden bg-paper-3',
                // One tall photograph, then pairs: the first spans two rows beside the next two.
                n === 0 && gallery.length > 2 ? 'aspect-[4/5] md:row-span-2 md:aspect-auto' : 'aspect-[4/5] md:aspect-square',
              )}
              key={image.id}
            >
              <Media className="absolute inset-0" fill imgClassName="object-cover" resource={image} size="(min-width: 768px) 45vw, 100vw" />
            </RevealImage>
          ))}
        </div>
      ) : null}

      <ClosingBand body={MADE_FOR_YOU.enquiry.body} className="mt-24 md:mt-36" line={MADE_FOR_YOU.enquiry.heading}>
        <div className="flex flex-wrap items-center justify-center gap-8">
          <ButtonLink href="/contact?subject=Made+for+you">{MADE_FOR_YOU.enquiry.cta}</ButtonLink>
          <TextLink href="/made-for-you">All commissions</TextLink>
        </div>
      </ClosingBand>
    </>
  )
}
