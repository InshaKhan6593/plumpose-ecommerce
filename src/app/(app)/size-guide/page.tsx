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

const cell = 'px-1.5 py-3.5 text-[0.8125rem] tabular-nums md:px-4 md:text-[0.9375rem]'
const head = 'caps px-2 pb-3 text-[0.5625rem] font-normal text-ink-soft md:px-4'
const label = 'py-3.5 pr-2 text-[0.875rem] font-normal leading-snug md:text-[0.9375rem]'

/**
 * Size guide — her size chart (SIZE_GUIDE in src/content/pages.ts), linked
 * from the size picker on every piece.
 *
 * **No table scrolls sideways.** On a phone the six-measurement chart was
 * wider than the screen and scrolled inside its own frame, which took any
 * slightly diagonal swipe that began on it — at its edge nothing moved, and
 * the page felt frozen. So on a phone the chart is turned: measurements down
 * the side, the five sizes across, which fits a 360 px screen. From `md` it
 * is laid out as her chart is, sizes down the side.
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

          {/* Phone: a row per measurement, a column per size. */}
          <table className="mt-6 w-full table-fixed text-left md:hidden" data-reveal>
            <caption className="sr-only">Garment measurements by size, in centimetres</caption>
            <colgroup>
              <col className="w-[30%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line">
                <th className={`${head} pl-0`} scope="col">
                  <span className="sr-only">Measurement</span>
                </th>
                {measurements.rows.map((row) => (
                  <th className={`${head} text-right`} key={row.size} scope="col">
                    {row.size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {measurements.columns.map((name, i) => (
                <tr className="border-b border-line" key={name}>
                  <th className={label} scope="row">
                    {name}
                  </th>
                  {measurements.rows.map((row) => (
                    <td className={`${cell} text-right text-ink-soft`} key={row.size}>
                      {row.values[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* From md: as her chart, a row per size. */}
          <table className="mt-6 hidden w-full text-left md:table" data-reveal>
            <caption className="sr-only">Garment measurements by size, in centimetres</caption>
            <thead>
              <tr className="border-b border-line">
                <th className={`${head} pl-0`} scope="col">
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
                  <th className={`${cell} pl-0 font-normal`} scope="row">
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
        </Reveal>

        <Reveal as="section" className="mx-auto mt-20 max-w-4xl md:mt-28">
          <SectionLabel>{conversion.heading}</SectionLabel>
          <table className="mt-6 w-full table-fixed text-left" data-reveal>
            <caption className="sr-only">plumpose sizes in other countries’ sizing</caption>
            <colgroup>
              <col className="w-[30%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line">
                <th className={`${head} pl-0`} scope="col">
                  <span className="sr-only">Country</span>
                </th>
                {conversion.sizes.map((s) => (
                  <th className={`${head} text-right md:text-left`} key={s} scope="col">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conversion.rows.map((row) => (
                <tr className="border-b border-line" key={row.region}>
                  <th className={label} scope="row">
                    {row.region}
                  </th>
                  {row.values.map((v, i) => (
                    <td className={`${cell} text-right text-ink-soft md:text-left`} key={i}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </PageShell>

      <ClosingBand className="mt-24 md:mt-36" line="Between sizes? Size up for extra comfort.">
        <ButtonLink href="/shop">Back to the shop</ButtonLink>
      </ClosingBand>
    </>
  )
}
