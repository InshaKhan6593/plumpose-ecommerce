import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { ButtonLink, ClosingBand, PageHeading, PageShell, SectionLabel } from '@/components/editorial'
import { FabricBlock } from '@/components/editorial/FabricBlock'
import { CARE_PAGE } from '@/content/pages'
import { Reveal } from '@/motion/Reveal'
import { loadPageMedia } from '@/utilities/pageMedia'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

export const metadata: Metadata = {
  alternates: { canonical: '/fabric-care' },
  description:
    'Our 22 momme silk, and how to care for it: wash cool and gently, dry flat away from the sun, iron low, and store it to breathe.',
  title: 'Fabric & care: caring for your silk',
}

/**
 * Fabric & care — where the product page's "Full fabric & care guidance"
 * leads (her notes, 28 Sep 2026). The fabric in her words, then her care
 * instructions as numbered steps, after the page she pointed at on
 * brahmaki.com. The steps' arrangement is a placeholder until she sends her
 * full text (CARE_PAGE in src/content/pages.ts).
 */
export default async function FabricCarePage() {
  const payload = await getPayload({ config: configPromise })
  const pick = await loadPageMedia(payload)

  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: 'Wash & care', path: '/fabric-care' }]} />
      <PageShell className="pt-16 md:pt-24">
        <PageHeading intro={CARE_PAGE.intro} label={CARE_PAGE.label} title={CARE_PAGE.heading} />
      </PageShell>

      <FabricBlock className="pt-16 md:pt-24" image={pick('print')} link={false} />

      <PageShell className="pt-24 md:pt-36">
        <ol className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:gap-x-16 md:gap-y-14 lg:grid-cols-3">
          {CARE_PAGE.steps.map((step, n) => (
            <Reveal as="li" className="border-t border-line pt-6" key={step.title}>
              <p className="caps text-[0.5625rem] text-ink-soft tabular-nums" data-reveal>
                {String(n + 1).padStart(2, '0')}
              </p>
              <h2 className="serif-display mt-3 text-[1.75rem]" data-reveal>
                {step.title}
              </h2>
              {step.body.map((p) => (
                <p className="mt-3 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal key={p}>
                  {p}
                </p>
              ))}
            </Reveal>
          ))}
        </ol>

        <div className="mx-auto mt-20 grid max-w-5xl gap-14 md:mt-28 md:grid-cols-2 md:gap-16">
          {[CARE_PAGE.why, CARE_PAGE.store].map((block) => (
            <Reveal as="section" key={block.heading}>
              <SectionLabel>{block.heading}</SectionLabel>
              {block.body.map((p) => (
                <p className="mt-5 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal key={p}>
                  {p}
                </p>
              ))}
            </Reveal>
          ))}
        </div>
      </PageShell>

      <ClosingBand className="mt-24 md:mt-36" line={CARE_PAGE.closing}>
        <ButtonLink href="/shop">Shop the silk</ButtonLink>
      </ClosingBand>
    </>
  )
}
