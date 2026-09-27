import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { ButtonLink, ClosingBand, PageHeading, PageShell } from '@/components/editorial'
import { FabricBlock } from '@/components/editorial/FabricBlock'
import { CARE_PAGE, FABRIC } from '@/content/pages'
import { Reveal } from '@/motion/Reveal'
import { loadPageMedia } from '@/utilities/pageMedia'

export const metadata: Metadata = {
  alternates: { canonical: '/fabric-care' },
  description:
    'Our 22 momme silk, and how to care for it: cold wash with a mild detergent, dry flat in the shade, iron on low heat.',
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
      <PageShell className="pt-16 md:pt-24">
        <PageHeading label={CARE_PAGE.label} title={CARE_PAGE.heading} />
      </PageShell>

      <FabricBlock className="pt-16 md:pt-24" image={pick('print')} link={false} />

      <PageShell className="pt-24 md:pt-36">
        <ol className="mx-auto grid max-w-5xl gap-12 md:grid-cols-3 md:gap-10">
          {CARE_PAGE.steps.map((step, n) => (
            <Reveal as="li" className="border-t border-line pt-6" key={step.title}>
              <p className="caps text-[0.5625rem] text-ink-soft tabular-nums" data-reveal>
                {String(n + 1).padStart(2, '0')}
              </p>
              <h2 className="serif-display mt-3 text-[1.75rem]" data-reveal>
                {step.title}
              </h2>
              <p className="mt-3 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                {step.body}
              </p>
            </Reveal>
          ))}
        </ol>
      </PageShell>

      <ClosingBand className="mt-24 md:mt-36" line={FABRIC.care.intro}>
        <ButtonLink href="/shop">Shop the silk</ButtonLink>
      </ClosingBand>
    </>
  )
}
