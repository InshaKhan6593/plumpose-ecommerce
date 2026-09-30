import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import {
  PageHeading,
  PageShell,
  Prose,
  SectionLabel,
  SplitBand,
  TextLink,
} from '@/components/editorial'
import { getPageText } from '@/content/getPageText'
// The code's copy, under anything a stale cache is missing (see below).
import { SHIPPING_PAGE as DEFAULTS } from '@/content/pages'
import { formatQar } from '@/lib/pricing/money'
import { rateCard } from '@/lib/pricing/shipping'
import { Reveal } from '@/motion/Reveal'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

export const metadata: Metadata = {
  alternates: { canonical: '/shipping-returns' },
  description:
    'Delivery across Qatar, the GCC and worldwide, with orders prepared in 2–4 business days; our returns and exchanges policy, and gift wrapping.',
  title: 'Shipping & returns: Qatar and worldwide',
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
  const { SHIPPING_PAGE: stored } = await getPageText()
  /*
   * Page text is cached in Next's data cache, which survives deploys: a copy
   * cached before a section existed lacks it, and reading it crashed the page
   * (500) until the cache was cleared. So each section falls back to the code.
   */
  const SHIPPING_PAGE = {
    ...DEFAULTS,
    ...stored,
    customs: stored.customs ?? DEFAULTS.customs,
    deliveryInfo: stored.deliveryInfo ?? DEFAULTS.deliveryInfo,
    preparation: stored.preparation ?? DEFAULTS.preparation,
    returns: { ...DEFAULTS.returns, ...stored.returns },
  }
  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()

  const [cities, zones] = await Promise.all([
    payload.find({
      collection: 'shippingCities',
      depth: 0,
      limit: 100,
      pagination: false,
      sort: 'name',
    }),
    payload.find({ collection: 'shippingZones', depth: 0, limit: 100, pagination: false }),
  ])

  const card = rateCard({ cities: cities.docs, countries: [], zones: zones.docs }, settings)

  // Qatar: cities grouped by fee, cheapest first — "Doha, Al Rayyan … QAR 20".
  const byFee = new Map<number, string[]>()
  for (const city of card.qatarCities)
    byFee.set(city.feeQar, [...(byFee.get(city.feeQar) ?? []), city.name])
  const qatarRows = [...byFee.entries()].sort(([a], [b]) => a - b)
  const intlRows = [...card.zones].sort((a, b) => a.feeQar - b.feeQar)

  const personalisedReturnable = Boolean(settings.personalisationReturnable)
  const returnDays = settings.returnWindowDays ?? 14
  const whatsappHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, '')}`
    : null

  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: 'Shipping & returns', path: '/shipping-returns' }]} />
      <PageShell className="pt-14 md:pt-20">
        <PageHeading intro={SHIPPING_PAGE.intro} title={SHIPPING_PAGE.heading} />

        {/* In-page contents */}
        <nav aria-label="On this page" className="mt-10 flex justify-center gap-8">
          {[
            ['#delivery', 'Delivery'],
            ['#returns', 'Returns'],
            ['#gifting', 'Gift wrapping'],
          ].map(([href, label]) => (
            <a
              className="caps text-[0.625rem] text-ink-soft transition-colors hover:text-ink"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Delivery */}
        <div className="mx-auto mt-16 max-w-4xl scroll-mt-32 md:mt-24" id="delivery">
          <Reveal as="section" className="mb-16 md:mb-20">
            <SectionLabel>{SHIPPING_PAGE.preparation.heading}</SectionLabel>
            <div className="mt-6 grid gap-6 text-[0.9375rem] leading-[1.8] text-ink-soft md:grid-cols-2 md:gap-12">
              {SHIPPING_PAGE.preparation.body.map((p) => (
                <p data-reveal key={p}>
                  {p}
                </p>
              ))}
            </div>
            {settings.personalisationLeadTime ? (
              <p className="mt-6 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                Pieces with hand embroidery take {settings.personalisationLeadTime} to
                prepare.
              </p>
            ) : null}
          </Reveal>

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
                      <td className="py-4 text-right text-[0.9375rem] whitespace-nowrap tabular-nums">
                        {formatQar(fee)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>

            {/* Every zone abroad switched off (Shipping zones → Active): say so, not an empty table. */}
            {!intlRows.length ? (
              <Reveal as="section">
                <SectionLabel>{SHIPPING_PAGE.delivery.intlHeading}</SectionLabel>
                <p className="mt-4 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                  We are delivering within Qatar only for now.
                  {settings.contactEmail ? (
                    <>
                      {' '}
                      For delivery abroad, email{' '}
                      <a
                        className="text-ink underline underline-offset-4"
                        href={`mailto:${settings.contactEmail}`}
                      >
                        {settings.contactEmail}
                      </a>{' '}
                      and we will help.
                    </>
                  ) : null}
                </p>
              </Reveal>
            ) : (
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
                      <td className="py-3 text-right text-[0.9375rem] whitespace-nowrap tabular-nums">
                        {formatQar(zone.feeQar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            )}
          </div>

          <Reveal className="mt-12 grid gap-6 text-[0.9375rem] leading-[1.8] text-ink-soft md:grid-cols-2 md:gap-12">
            <p data-reveal>{SHIPPING_PAGE.delivery.timing}</p>
            <div data-reveal>
              {card.freeShippingThresholdQar ? (
                <p className="text-ink">
                  Free delivery on orders over {formatQar(card.freeShippingThresholdQar)}.
                </p>
              ) : null}
              <p className={card.freeShippingThresholdQar ? 'mt-4' : undefined}>
                {SHIPPING_PAGE.delivery.currency}
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-14 md:mt-20 md:grid-cols-2 md:gap-12">
            <Reveal as="section">
              <SectionLabel>{SHIPPING_PAGE.customs.heading}</SectionLabel>
              <p className="mt-6 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                {SHIPPING_PAGE.customs.body}
              </p>
            </Reveal>
            <Reveal as="section">
              <SectionLabel>{SHIPPING_PAGE.deliveryInfo.heading}</SectionLabel>
              <p className="mt-6 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                {SHIPPING_PAGE.deliveryInfo.body}
              </p>
              {whatsappHref ? (
                <div className="mt-5" data-reveal>
                  <p className="text-[0.9375rem] leading-[1.8] text-ink-soft">
                    {SHIPPING_PAGE.deliveryInfo.contact}
                  </p>
                  <TextLink className="mt-3" href={whatsappHref}>
                    WhatsApp {settings.whatsappNumber}
                  </TextLink>
                </div>
              ) : null}
            </Reveal>
          </div>
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
              <p className="mt-6 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                {SHIPPING_PAGE.returns.notAccepted}
              </p>

              <h3 className="caps mt-12 text-[0.625rem]" data-reveal>
                {SHIPPING_PAGE.returns.requestHeading}
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-[1.8] text-ink-soft" data-reveal>
                {SHIPPING_PAGE.returns.requestBody.replaceAll('{days}', String(returnDays))}
              </p>

              {SHIPPING_PAGE.returns.more.map((block) => (
                <div data-reveal key={block.title}>
                  <h3 className="caps mt-10 text-[0.625rem]">{block.title}</h3>
                  {block.body.split(/\n\s*\n/).map((p) => (
                    <p className="mt-3 text-[0.9375rem] leading-[1.8] text-ink-soft" key={p}>
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            <div className="self-start" data-reveal>
              {!personalisedReturnable ? (
                <div className="border border-ink px-6 py-6">
                  <p className="caps text-[0.625rem]">{SHIPPING_PAGE.returns.exceptionLabel}</p>
                  <p className="mt-3 text-[0.9375rem] leading-[1.7] text-ink-soft">
                    {SHIPPING_PAGE.returns.exception}
                  </p>
                </div>
              ) : null}
              <p className="mt-6 text-[0.9375rem] leading-[1.7] text-ink-soft">
                {SHIPPING_PAGE.returns.contact}
              </p>
              <div className="mt-5 flex flex-wrap gap-6">
                {settings.contactEmail ? (
                  <TextLink href={`mailto:${settings.contactEmail}`}>
                    {settings.contactEmail}
                  </TextLink>
                ) : null}
                {whatsappHref ? <TextLink href={whatsappHref}>WhatsApp</TextLink> : null}
              </div>
            </div>
          </div>
        </Reveal>
      </PageShell>

      {/* Gift wrapping — words only; she asked for the photograph to go (28 Sep 2026). */}
      <SplitBand className="pt-24 md:pt-32" id="gifting">
        <Prose
          body={[SHIPPING_PAGE.gifting.body, SHIPPING_PAGE.gifting.note]}
          heading={SHIPPING_PAGE.gifting.heading}
          label="Gifting"
        />
      </SplitBand>
    </>
  )
}
