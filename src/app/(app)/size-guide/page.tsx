import type { Metadata } from 'next'

import React from 'react'

import { ButtonLink, ClosingBand, PageHeading, PageShell, SectionLabel } from '@/components/editorial'
import { SIZE_GUIDE } from '@/content/pages'
import { Reveal } from '@/motion/Reveal'

export const metadata: Metadata = {
  alternates: { canonical: '/size-guide' },
  description:
    'plumpose pyjama sizes XS to XL: chest, hem, sleeve, waist, hip and inside leg in centimetres, with UK, US, EU, Australian and Japanese sizes.',
  title: 'Size guide: silk pyjama measurements',
}

const cell = 'px-4 py-3.5 text-[0.9375rem] tabular-nums whitespace-nowrap'
const head = 'caps px-4 pb-3 text-[0.5625rem] font-normal text-ink-soft whitespace-nowrap'
/** The size column stays in view while a phone scrolls the rest of the table. */
const pinned = 'sticky left-0 bg-paper-2'

/**
 * Size guide — her size chart (SIZE_GUIDE in src/content/pages.ts), linked
 * from the size picker on every piece. On a phone each table scrolls sideways
 * inside its own frame, the size column held still; the page never does.
 */
export default function SizeGuidePage() {
  const { conversion, measurements } = SIZE_GUIDE

  return (
    <>
      <PageShell className="pt-16 md:pt-24">
        <PageHeading intro={SIZE_GUIDE.intro} label={SIZE_GUIDE.label} title={SIZE_GUIDE.heading} />

        <Reveal as="section" className="mx-auto mt-16 max-w-4xl md:mt-24">
          <SectionLabel>{measurements.heading}</SectionLabel>
          <p className="mt-4 text-[0.8125rem] text-ink-soft" data-reveal>
            {measurements.note}
          </p>
          <div className="mt-6 overflow-x-auto overscroll-x-contain" data-lenis-prevent data-reveal>
            <table className="w-full text-left">
              <caption className="sr-only">Garment measurements by size, in centimetres</caption>
              <thead>
                <tr className="border-b border-line">
                  <th className={`${head} ${pinned} pl-0`} scope="col">
                    Size
                  </th>
                  {measurements.columns.map((c) => (
                    <th className={head} key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {measurements.rows.map((row) => (
                  <tr className="border-b border-line" key={row.size}>
                    <th className={`${cell} ${pinned} pl-0 font-normal`} scope="row">
                      {row.size}
                    </th>
                    {row.values.map((v, i) => (
                      <td className={`${cell} text-ink-soft`} key={i}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal as="section" className="mx-auto mt-20 max-w-4xl md:mt-28">
          <SectionLabel>{conversion.heading}</SectionLabel>
          <div className="mt-6 overflow-x-auto overscroll-x-contain" data-lenis-prevent data-reveal>
            <table className="w-full text-left">
              <caption className="sr-only">plumpose sizes in other countries’ sizing</caption>
              <thead>
                <tr className="border-b border-line">
                  <th className={`${head} ${pinned} pl-0`} scope="col">
                    <span className="sr-only">Country</span>
                  </th>
                  {conversion.sizes.map((s) => (
                    <th className={head} key={s} scope="col">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conversion.rows.map((row) => (
                  <tr className="border-b border-line" key={row.region}>
                    <th className={`${cell} ${pinned} pl-0 font-normal`} scope="row">
                      {row.region}
                    </th>
                    {row.values.map((v, i) => (
                      <td className={`${cell} text-ink-soft`} key={i}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </PageShell>

      <ClosingBand className="mt-24 md:mt-36" line="Between sizes? Size up for extra comfort.">
        <ButtonLink href="/shop">Back to the shop</ButtonLink>
      </ClosingBand>
    </>
  )
}
