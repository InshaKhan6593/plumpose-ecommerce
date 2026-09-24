import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import type { Faq } from '@/payload-types'

import { ClosingBand, PageHeading, PageShell, TextLink } from '@/components/editorial'
import { RichText } from '@/components/RichText'
import { FAQ_PAGE } from '@/content/pages'
import { Reveal } from '@/motion/Reveal'

export const metadata: Metadata = {
  description: 'Orders, delivery, returns, hand embroidery and caring for your silk — the questions we are asked most.',
  title: 'FAQ',
}

/**
 * FAQ (docs/SCREEN-PROMPTS 13). The questions are hers, in the FAQs
 * collection — published ones only, in the order she drags them into. Grouped
 * by category, with the groups listed in a sticky column on desktop.
 *
 * Each answer is a native <details>: it opens without JavaScript, the
 * browser's find-in-page reaches closed answers, and screen readers announce
 * it as expandable. The page also carries FAQPage structured data.
 */
export default async function FaqPage() {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'faqs',
    depth: 0,
    limit: 200,
    overrideAccess: false,
    pagination: false,
    sort: '_order',
  })

  const groups = FAQ_PAGE.groups
    .map((group) => ({ ...group, items: (docs as Faq[]).filter((faq) => (faq.category ?? 'orders') === group.key) }))
    .filter((group) => group.items.length)

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (docs as Faq[]).map((faq) => ({
      '@type': 'Question',
      acceptedAnswer: { '@type': 'Answer', text: plainText(faq.answer) },
      name: faq.question,
    })),
  }

  return (
    <>
      <PageShell className="pt-14 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-24">
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <PageHeading align="left" intro={FAQ_PAGE.intro} title={FAQ_PAGE.heading} />
            {groups.length > 1 ? (
              <nav aria-label="Topics" className="mt-10 hidden lg:block">
                <ul className="flex flex-col gap-4 border-l border-line pl-5">
                  {groups.map((group) => (
                    <li key={group.key}>
                      <a className="caps text-[0.625rem] text-ink-soft transition-colors hover:text-ink" href={`#${group.key}`}>
                        {group.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </aside>

          <div className="flex flex-col gap-16">
            {groups.map((group) => (
              <Reveal as="section" className="scroll-mt-32" key={group.key}>
                <h2 className="caps text-[0.6875rem]" data-reveal id={group.key}>
                  {group.label}
                </h2>
                <ul className="mt-5 border-t border-line" data-reveal>
                  {group.items.map((faq) => (
                    <li className="border-b border-line" key={faq.id}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                          <span className="serif-display text-[1.375rem] leading-snug md:text-[1.625rem]">{faq.question}</span>
                          <span aria-hidden className="relative mt-3 size-3 shrink-0">
                            <span className="absolute top-1/2 left-0 h-px w-full bg-ink" />
                            <span className="absolute top-0 left-1/2 h-full w-px bg-ink transition-transform duration-300 ease-brand group-open:scale-y-0" />
                          </span>
                        </summary>
                        <div className="max-w-2xl pb-8 text-[0.9375rem] leading-[1.8] text-ink-soft">
                          <RichText className="[&_p]:mb-4 [&_p:last-child]:mb-0" data={faq.answer} enableGutter={false} enableProse={false} />
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </PageShell>

      <ClosingBand className="mt-24 md:mt-36" line="Still wondering?">
        <TextLink href="/contact">Write to us</TextLink>
      </ClosingBand>

      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
        type="application/ld+json"
      />
    </>
  )
}

/** The words of a rich-text answer, for structured data. */
function plainText(value: unknown): string {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { children?: unknown[]; root?: unknown; text?: string; type?: string }
    if (typeof n.text === 'string') out.push(n.text)
    if (n.root) walk(n.root)
    n.children?.forEach(walk)
    if (n.type === 'paragraph') out.push(' ')
  }
  walk(value)
  return out.join('').replace(/\s+/g, ' ').trim()
}
