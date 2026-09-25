import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import type { Media as MediaType, Spotted } from '@/payload-types'

import { ClosingBand, PageHeading, PageShell, TextLink } from '@/components/editorial'
import { Media } from '@/components/Media'
import { SpottedForm } from '@/components/spotted/SpottedForm'
import { getPageText } from '@/content/getPageText'
import { Reveal, RevealImage } from '@/motion/Reveal'
import { cn } from '@/utilities/cn'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { loadPageMedia } from '@/utilities/pageMedia'

export const metadata: Metadata = {
  description: 'plumpose, as you wear it. Tag @plumpose to be featured.',
  title: 'Spotted',
}

/**
 * Spotted (REQUIREMENTS S15, docs/SCREEN-PROMPTS 11 of the old set): a dense
 * square grid of customer photographs, handle and caption on hover.
 * **Approved posts only** — the collection's own read rule, applied with
 * `overrideAccess: false`, so a pending or rejected post can never appear.
 *
 * Until the first one is approved, the page shows her own campaign
 * photographs, labelled as the campaign — never passed off as customers'.
 */
export default async function SpottedPage() {
  const { SPOTTED_PAGE } = await getPageText()
  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()

  const [{ docs }, pick] = await Promise.all([
    payload.find({ collection: 'spotted', depth: 1, limit: 120, overrideAccess: false, pagination: false, sort: '_order' }),
    loadPageMedia(payload),
  ])
  const posts = (docs as Spotted[]).filter((p) => typeof p.image === 'object' && p.image)
  const campaign = [pick('window'), pick('corridor'), pick('armchair'), pick('doorway')].filter((m): m is MediaType => Boolean(m))

  const handle = settings.instagramHandle ?? '@plumpose'
  const instagramHref =
    settings.instagramUrl || (settings.instagramHandle ? `https://instagram.com/${settings.instagramHandle.replace(/^@/, '')}` : null)

  return (
    <>
      <PageShell className="pt-14 md:pt-20">
        <PageHeading intro={SPOTTED_PAGE.intro} title={SPOTTED_PAGE.heading} />

        {posts.length ? (
          <ul className="mt-14 grid grid-cols-2 gap-2 md:mt-20 md:grid-cols-4">
            {posts.map((post) => {
              const Tag = post.postUrl ? 'a' : 'div'
              return (
                <li key={post.id}>
                  <Tag
                    className="group relative block aspect-square overflow-hidden bg-paper-3"
                    {...(post.postUrl ? { href: post.postUrl, rel: 'noopener noreferrer', target: '_blank' } : {})}
                  >
                    <Media className="absolute inset-0" fill imgClassName="object-cover" resource={post.image as MediaType} size="(min-width: 768px) 25vw, 50vw" />
                    <span className="absolute inset-0 flex flex-col items-center justify-center bg-ink/55 px-4 text-center text-white opacity-0 transition-opacity duration-500 ease-brand group-hover:opacity-100 group-focus-visible:opacity-100">
                      <span className="caps text-[0.625rem]">{post.instagramHandle}</span>
                      {post.caption ? <span className="mt-2 text-[0.8125rem] leading-snug text-white/85">{post.caption}</span> : null}
                    </span>
                  </Tag>
                </li>
              )
            })}
          </ul>
        ) : campaign.length ? (
          <section className="mt-14 md:mt-20">
            <p className="caps text-center text-[0.5625rem] text-ink-soft">{SPOTTED_PAGE.empty.label}</p>
            <ul className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
              {campaign.map((image, n) => (
                <li className={cn(n % 2 === 1 && 'mt-10 md:mt-16')} key={image.id}>
                  <RevealImage className="relative aspect-[3/4] overflow-hidden bg-paper-3">
                    <Media className="absolute inset-0" fill imgClassName="object-cover" resource={image} size="(min-width: 768px) 25vw, 50vw" />
                  </RevealImage>
                </li>
              ))}
            </ul>
            <Reveal className="mt-8 text-center">
              <p className="serif-italic text-lg text-ink-soft" data-reveal>
                {SPOTTED_PAGE.empty.body}
              </p>
            </Reveal>
          </section>
        ) : null}
        {/* Customers send their own (REQUIREMENTS S15); nothing shows until she approves it. */}
        <section aria-labelledby="spotted-send" className="mt-24 border-t border-line pt-14 md:mt-32">
          <Reveal className="mb-10 max-w-xl">
            <h2 className="serif-display text-[clamp(2rem,3.4vw,3rem)] leading-[1.05]" data-reveal id="spotted-send">
              {SPOTTED_PAGE.form.heading}
            </h2>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft" data-reveal>
              {SPOTTED_PAGE.form.body}
            </p>
          </Reveal>
          <SpottedForm />
        </section>
      </PageShell>

      <ClosingBand body={SPOTTED_PAGE.invite.body} className="mt-24 md:mt-36" line={SPOTTED_PAGE.invite.heading}>
        {instagramHref ? <TextLink href={instagramHref}>{`Tag ${handle}`}</TextLink> : null}
      </ClosingBand>
    </>
  )
}
