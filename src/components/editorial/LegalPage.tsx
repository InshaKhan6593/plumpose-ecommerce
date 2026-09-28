import React from 'react'

import { PageHeading, PageShell, TextLink } from '@/components/editorial'
import { Reveal } from '@/motion/Reveal'
import { getCachedGlobal } from '@/utilities/getGlobals'

type Section = { heading: string; body: ReadonlyArray<string | ReadonlyArray<string>> }

/**
 * Terms & Conditions and Privacy: a heading, when it was last updated, then
 * numbered sections — paragraphs, with a bulleted list wherever the section
 * holds one. The contact line at the end reads Site settings, so it follows
 * her contact email.
 */
export async function LegalPage({
  heading,
  intro,
  sections,
  updated,
}: {
  heading: string
  intro: string[]
  sections: Section[]
  updated: string
}) {
  const settings = await getCachedGlobal('siteSettings', 0)()

  return (
    <PageShell className="pt-16 pb-24 md:pt-24 md:pb-36">
      <PageHeading intro={`Last updated ${updated}`} title={heading} />

      <div className="mx-auto mt-16 max-w-2xl md:mt-24">
        {intro.map((p) => (
          <p className="mb-4 text-[0.9375rem] leading-[1.8] text-ink-soft" key={p}>
            {p}
          </p>
        ))}

        <ol className={intro.length ? 'mt-12' : undefined}>
          {sections.map((section, n) => (
            <Reveal as="li" className="border-t border-line pt-6 pb-10" key={section.heading}>
              <h2 className="caps flex gap-4 text-[0.6875rem]" data-reveal>
                <span className="text-ink-soft tabular-nums">{String(n + 1).padStart(2, '0')}</span>
                {section.heading}
              </h2>
              <div data-reveal>
                {section.body.map((part, i) =>
                  typeof part === 'string' ? (
                    <p className="mt-4 text-[0.9375rem] leading-[1.8] text-ink-soft" key={i}>
                      {part}
                    </p>
                  ) : (
                    <ul className="mt-4 flex flex-col gap-2" key={i}>
                      {part.map((item) => (
                        <li className="flex gap-4 text-[0.9375rem] leading-[1.7] text-ink-soft" key={item}>
                          <span aria-hidden className="mt-[0.8em] h-px w-3 shrink-0 bg-ink-soft" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </Reveal>
          ))}
        </ol>

        {settings.contactEmail ? (
          <div className="border-t border-line pt-8">
            <TextLink href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</TextLink>
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
