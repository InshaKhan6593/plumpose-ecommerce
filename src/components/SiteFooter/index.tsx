import Link from 'next/link'
import React from 'react'

import { Wordmark } from '@/components/brand/Wordmark'
import { getCachedGlobal } from '@/utilities/getGlobals'

import { NewsletterForm } from './NewsletterForm'

/**
 * The storefront footer, as in the approved mockup (docs/mockups/04-…).
 * Contact details come from Site settings so she can change them herself; the
 * link structure is fixed in code, like the header.
 */
export async function SiteFooter() {
  const settings = await getCachedGlobal('siteSettings', 0)()

  const whatsappHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, '')}`
    : null
  const instagramHref =
    settings.instagramUrl ||
    (settings.instagramHandle
      ? `https://instagram.com/${settings.instagramHandle.replace(/^@/, '')}`
      : null)

  const columns: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
    {
      heading: 'Shop',
      links: [
        { href: '/shop', label: 'Pyjamas' },
        { href: '/shop#personalisation', label: 'Personalisation' },
        { href: '/shipping-returns#gifting', label: 'Gift wrapping' },
      ],
    },
    {
      heading: 'Help',
      links: [
        { href: '/shipping-returns', label: 'Delivery' },
        { href: '/shipping-returns#returns', label: 'Returns' },
        { href: '/faq', label: 'FAQ' },
        { href: '/find-order', label: 'Track order' },
      ],
    },
    {
      heading: 'About',
      links: [
        { href: '/our-story', label: 'Our story' },
        { href: '/made-for-you', label: 'Made for you' },
        { href: '/press', label: 'Press' },
        { href: '/spotted', label: 'Spotted' },
      ],
    },
    {
      heading: 'Contact',
      links: [
        ...(settings.contactEmail
          ? [{ href: `mailto:${settings.contactEmail}`, label: settings.contactEmail }]
          : []),
        ...(whatsappHref ? [{ href: whatsappHref, label: 'WhatsApp' }] : []),
        ...(instagramHref ? [{ href: instagramHref, label: 'Instagram' }] : []),
      ],
    },
  ]

  return (
    <footer className="mt-24 border-t border-line bg-background md:mt-32">
      <div className="mx-auto max-w-[90rem] px-6 pt-14 pb-10 md:px-14 md:pt-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)] md:gap-8">
          <div className="max-w-sm">
            <Link aria-label="plumpose — home" className="inline-block text-ink" href="/">
              <Wordmark className="h-9 w-auto md:h-11" />
            </Link>
            <p className="serif-italic mt-4 text-lg text-ink">Hand-finished in Doha</p>
            <NewsletterForm />
          </div>

          {columns.map((column) =>
            column.links.length ? (
              <div key={column.heading}>
                <h2 className="caps mb-5 text-[0.625rem] text-ink">{column.heading}</h2>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a
                        className="text-sm text-ink-soft transition-colors hover:text-ink"
                        href={link.href}
                        {...(link.href.startsWith('http')
                          ? { rel: 'noopener noreferrer', target: '_blank' }
                          : {})}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <p className="caps text-[0.5625rem] text-ink-soft">Qatar · QAR</p>
          <p className="caps text-[0.5625rem] text-ink-soft">
            All orders are charged in QAR · © {new Date().getFullYear()} plumpose
          </p>
        </div>
      </div>
    </footer>
  )
}
