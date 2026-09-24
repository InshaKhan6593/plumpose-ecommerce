import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { PageHeading, PageShell } from '@/components/editorial'
import { ContactForm } from '@/components/editorial/ContactForm'
import { CONTACT_PAGE } from '@/content/pages'
import { Reveal } from '@/motion/Reveal'
import { getCachedGlobal } from '@/utilities/getGlobals'

export const metadata: Metadata = {
  description: 'Write to plumpose by email, Instagram or WhatsApp. We usually reply within a day.',
  title: 'Contact',
}

type Props = { searchParams: Promise<{ subject?: string }> }

/** The form-builder form this page submits to, created by the seed. */
const CONTACT_FORM_TITLE = 'Contact'

/**
 * Contact (REQUIREMENTS S12, docs/SCREEN-PROMPTS 14). Every channel comes
 * from Site settings, so she changes a number or handle herself; a channel she
 * has not filled in — the WhatsApp number today — is simply not shown.
 *
 * `?subject=` preselects the enquiry type, so "Enquire" on Made for You and
 * "Press enquiries" arrive already labelled.
 */
export default async function ContactPage({ searchParams }: Props) {
  const { subject } = await searchParams
  const payload = await getPayload({ config: configPromise })
  const settings = await getCachedGlobal('siteSettings', 0)()

  const { docs } = await payload.find({
    collection: 'forms',
    depth: 0,
    limit: 1,
    pagination: false,
    select: { title: true },
    where: { title: { equals: CONTACT_FORM_TITLE } },
  })
  const formId = docs[0]?.id

  const whatsappDigits = settings.whatsappNumber?.replace(/[^\d]/g, '')
  const instagramHref =
    settings.instagramUrl || (settings.instagramHandle ? `https://instagram.com/${settings.instagramHandle.replace(/^@/, '')}` : null)

  const channels = [
    settings.contactEmail ? { href: `mailto:${settings.contactEmail}`, label: 'Email', value: settings.contactEmail } : null,
    whatsappDigits ? { href: `https://wa.me/${whatsappDigits}`, label: 'WhatsApp', value: settings.whatsappNumber! } : null,
    instagramHref ? { href: instagramHref, label: 'Instagram', value: settings.instagramHandle ?? 'Instagram' } : null,
  ].filter((c): c is { href: string; label: string; value: string } => Boolean(c))

  return (
    <PageShell className="pt-14 md:pt-20">
      <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-28">
        <div>
          <PageHeading align="left" intro={CONTACT_PAGE.intro} title={CONTACT_PAGE.heading} />
          <Reveal as="ul" className="mt-12 flex flex-col gap-9">
            {channels.map((channel) => (
              <li data-reveal key={channel.label}>
                <p className="caps text-[0.5625rem] text-ink-soft">{channel.label}</p>
                <a
                  className="serif-display mt-2 inline-block text-[1.75rem] transition-opacity hover:opacity-60"
                  href={channel.href}
                  {...(channel.href.startsWith('http') ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                >
                  {channel.value}
                </a>
              </li>
            ))}
            <li data-reveal>
              <p className="caps text-[0.5625rem] text-ink-soft">The atelier</p>
              <p className="serif-display mt-2 text-[1.75rem]">Doha, Qatar</p>
            </li>
          </Reveal>
        </div>

        {formId ? (
          <Reveal className="lg:pt-6">
            <h2 className="caps border-b border-line pb-4 text-[0.6875rem]" data-reveal>
              {CONTACT_PAGE.formHeading}
            </h2>
            <div className="mt-10" data-reveal>
              <ContactForm formId={formId} initialSubject={subject} subjects={CONTACT_PAGE.subjects} thanks={CONTACT_PAGE.thanks} />
            </div>
          </Reveal>
        ) : null}
      </div>
    </PageShell>
  )
}
