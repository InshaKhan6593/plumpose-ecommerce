import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import type { Media as MediaType, Press } from '@/payload-types'

import { ClosingBand, PageHeading, PageShell, TextLink } from '@/components/editorial'
import { Media } from '@/components/Media'
import { getPageText } from '@/content/getPageText'
import { Reveal } from '@/motion/Reveal'
import { getCachedGlobal } from '@/utilities/getGlobals'

export const metadata: Metadata = {
  description: 'plumpose in print and online, and press enquiries.',
  title: 'Press',
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

/**
 * Press (docs/SCREEN-PROMPTS 18): a list of her published press items,
 * newest first — a publication logo in a narrow column, then headline,
 * excerpt, date and link. Rules between entries, no cards.
 *
 * With nothing published it says so plainly and offers press enquiries
 * instead. **No publication is ever named here that she has not added
 * herself** — naming a magazine the brand has not appeared in would be false.
 */
export default async function PressPage() {
  const { PRESS_PAGE } = await getPageText()
  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()

  const { docs } = await payload.find({
    collection: 'press',
    depth: 1,
    limit: 100,
    overrideAccess: false,
    pagination: false,
    sort: '-date',
  })
  const items = docs as Press[]
  const pressHref = settings.contactEmail ? `mailto:${settings.contactEmail}?subject=Press%20enquiry` : '/contact?subject=Press'

  return (
    <>
      <PageShell className="pt-14 md:pt-20">
        <PageHeading intro={PRESS_PAGE.intro} title={PRESS_PAGE.heading} />

        {items.length ? (
          <ul className="mx-auto mt-16 max-w-5xl border-t border-line md:mt-24">
            {items.map((item) => {
              const logo = typeof item.logo === 'object' && item.logo ? (item.logo as MediaType) : null
              return (
                <Reveal as="li" className="grid gap-6 border-b border-line py-10 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-14 md:py-14" key={item.id}>
                  <div className="flex items-start" data-reveal>
                    {logo ? (
                      <div className="relative h-10 w-36 grayscale">
                        <Media className="absolute inset-0" fill imgClassName="object-contain object-left" resource={logo} size="144px" />
                      </div>
                    ) : (
                      <p className="caps text-[0.6875rem]">{item.publication}</p>
                    )}
                  </div>
                  <div>
                    <h2 className="serif-display text-[clamp(1.75rem,2.6vw,2.5rem)] leading-tight" data-reveal>
                      {item.headline}
                    </h2>
                    {item.excerpt ? (
                      <p className="mt-4 max-w-2xl text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                        {item.excerpt}
                      </p>
                    ) : null}
                    <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3" data-reveal>
                      <p className="caps text-[0.5625rem] text-ink-soft">
                        {logo ? `${item.publication} · ` : ''}
                        {dateFormat.format(new Date(item.date))}
                      </p>
                      {item.url ? <TextLink href={item.url}>Read the article</TextLink> : null}
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </ul>
        ) : null}
      </PageShell>

      <ClosingBand
        body={PRESS_PAGE.empty.body}
        className={items.length ? 'mt-24 md:mt-36' : 'mt-16 md:mt-24'}
        line={PRESS_PAGE.empty.heading}
      >
        <TextLink href={pressHref}>{PRESS_PAGE.empty.cta}</TextLink>
      </ClosingBand>
    </>
  )
}
