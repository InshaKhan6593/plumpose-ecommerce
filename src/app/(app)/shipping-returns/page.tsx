import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { PageHeading, PageShell, Prose, SectionLabel, SplitBand, TextLink } from '@/components/editorial'
import { SHIPPING_PAGE } from '@/content/pages'
import { formatQar } from '@/lib/pricing/money'
import { rateCard } from '@/lib/pricing/shipping'
import { Reveal } from '@/motion/Reveal'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { loadPageMedia } from '@/utilities/pageMedia'

export const metadata: Metadata = {
  description: 'Delivery across Qatar and worldwide, our 14-day returns policy, and gift wrapping.',
  title: 'Shipping & returns',
}

/**
 * Shipping & Returns (docs/SCREEN-PROMPTS 19).
 *
 * Every fee on this page comes from `rateCard()` — the same function the
 * checkout prices against — so the page can never quote a figure the checkout
 * would not charge, and when she edits a rate in the admin it changes here too.
 * Qatar cities that share a fee are listed together, as she thinks of them.
 *
 * Anchors the footer links to: #delivery, #returns, #gifting.
 */
export default async function ShippingReturnsPage() {
  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()

  const [cities, zones, pick] = await Promise.all([
    payload.find({ collection: 'shippingCities', depth: 0, limit: 100, pagination: false, sort: 'name' }),
    payload.find({ collection: 'shippingZones', depth: 0, limit: 100, pagination: false }),
    loadPageMedia(payload),
  ])

  const card = rateCard({ cities: cities.docs, countries: [], zones: zones.docs }, settings)

  // Qatar: cities grouped by fee, cheapest first — "Doha, Al Rayyan … QAR 20".
  const byFee = new Map<number, string[]>()
  for (const city of card.qatarCities) byFee.set(city.feeQar, [...(byFee.get(city.feeQar) ?? []), city.name])
  const qatarRows = [...byFee.entries()].sort(([a], [b]) => a - b)
  const intlRows = [...card.zones].sort((a, b) => a.feeQar - b.feeQar)

  const personalisedReturnable = Boolean(settings.personalisationReturnable)

  return (
    <>
      <PageShell className="pt-14 md:pt-20">
        <PageHeading intro={SHIPPING_PAGE.intro} title={SHIPPING_PAGE.heading} />

        {/* In-page contents */}
        <nav aria-label="On this page" className="mt-10 flex justify-center gap-8">
          {[
            ['#delivery', 'Delivery'],
            ['#returns', 'Returns'],
            ['#gifting', 'Gift wrapping'],
          ].map(([href, label]) => (
            <a className="caps text-[0.625rem] text-ink-soft transition-colors hover:text-ink" href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>

        {/* Delivery */}
        <div className="mx-auto mt-16 max-w-4xl scroll-mt-32 md:mt-24" id="delivery">
          <div className="grid gap-14 md:grid-cols-2 md:gap-12">
            <Reveal as="section">
              <SectionLabel>{SHIPPING_PAGE.delivery.qatarHeading}</SectionLabel>
              <p className="mt-4 text-[0.8125rem] text-ink-soft" data-reveal>
                {SHIPPING_PAGE.delivery.qatarNote}
              </p>
              <table className="mt-4 w-full text-left" data-reveal>
                <caption className="sr-only">Delivery within Qatar, by city</caption>
                <tbody>
                  {qatarRows.map(([fee, names]) => (
                    <tr className="border-b border-line align-top" key={fee}>
                      <th className="py-4 pr-6 text-[0.9375rem] font-normal" scope="row">
                        {names.join(', ')}
                      </th>
                      <td className="py-4 text-right text-[0.9375rem] whitespace-nowrap tabular-nums">{formatQar(fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>

            <Reveal as="section">
              <SectionLabel>{SHIPPING_PAGE.delivery.intlHeading}</SectionLabel>
              <p className="mt-4 text-[0.8125rem] text-ink-soft" data-reveal>
                {SHIPPING_PAGE.delivery.intlNote}
              </p>
              <table className="mt-4 w-full text-left" data-reveal>
                <caption className="sr-only">International delivery, by destination</caption>
                <tbody>
                  {intlRows.map((zone) => (
                    <tr className="border-b border-line" key={zone.key}>
                      <th className="py-3 pr-6 text-[0.9375rem] font-normal" scope="row">
                        {zone.name}
                      </th>
                      <td className="py-3 text-right text-[0.9375rem] whitespace-nowrap tabular-nums">{formatQar(zone.feeQar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>

          <Reveal className="mt-12 grid gap-6 text-[0.9375rem] leading-[1.8] text-ink-soft md:grid-cols-2 md:gap-12">
            <p data-reveal>{SHIPPING_PAGE.delivery.timing}</p>
            <div data-reveal>
              {card.freeShippingThresholdQar ? (
                <p className="text-ink">Free delivery on orders over {formatQar(card.freeShippingThresholdQar)}.</p>
              ) : null}
              <p className={card.freeShippingThresholdQar ? 'mt-4' : undefined}>{SHIPPING_PAGE.delivery.currency}</p>
            </div>
          </Reveal>
        </div>

        {/* Returns */}
        <Reveal as="section" className="mx-auto mt-24 max-w-4xl scroll-mt-32 md:mt-32">
          <SectionLabel id="returns">{SHIPPING_PAGE.returns.heading}</SectionLabel>
          <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-12">
            <div>
              <p className="text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                {SHIPPING_PAGE.returns.intro}
              </p>
              <ul className="mt-6 flex flex-col gap-3" data-reveal>
                {SHIPPING_PAGE.returns.terms.map((term) => (
                  <li className="flex gap-4 text-[0.9375rem] leading-[1.7]" key={term}>
                    <span aria-hidden className="mt-[0.8em] h-px w-3 shrink-0 bg-ink-soft" />
                    {term}
                  </li>
                ))}
              </ul>
            </div>

            <div className="self-start" data-reveal>
              {!personalisedReturnable ? (
                <div className="border border-ink px-6 py-6">
                  <p className="caps text-[0.625rem]">{SHIPPING_PAGE.returns.exceptionLabel}</p>
                  <p className="mt-3 text-[0.9375rem] leading-[1.7] text-ink-soft">{SHIPPING_PAGE.returns.exception}</p>
                </div>
              ) : null}
              <p className="mt-6 text-[0.9375rem] leading-[1.7] text-ink-soft">{SHIPPING_PAGE.returns.contact}</p>
              <div className="mt-5 flex flex-wrap gap-6">
                {settings.contactEmail ? <TextLink href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</TextLink> : null}
                {settings.instagramUrl ? <TextLink href={settings.instagramUrl}>Instagram</TextLink> : null}
              </div>
            </div>
          </div>
        </Reveal>
      </PageShell>

      {/* Gift wrapping */}
      <SplitBand className="pt-24 md:pt-32" id="gifting" image={pick('qatarBook', 'packaging')}>
        <Prose body={[SHIPPING_PAGE.gifting.body, SHIPPING_PAGE.gifting.note]} heading={SHIPPING_PAGE.gifting.heading} label="Gifting" />
      </SplitBand>
    </>
  )
}
