import Link from 'next/link'

import { Wordmark } from '@/components/brand/Wordmark'
import { LocaleButton } from '@/components/locale/LocalePicker'
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
        { href: '/contact', label: 'Contact us' },
      ],
    },
    {
      heading: 'About',
      links: [
        { href: '/our-story', label: 'Our story' },
        { href: '/our-story#the-silk', label: 'The silk' },
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

  /*
   * As in the mockup: a band one step deeper than the page, the brand and the
   * newsletter on the left, the four link columns grouped on the right — not
   * five columns spread across the full width, which left the links floating
   * apart and "Subscribe" pressed against the first column. Two-by-two on a
   * phone, so the lists do not stack into a screen and a half of links.
   */
  return (
    <footer className="mt-24 border-t border-line bg-paper-3 md:mt-32">
      <div className="mx-auto max-w-[90rem] px-6 pt-14 pb-8 md:px-14 md:pt-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div className="max-w-sm">
            <Link aria-label="plumpose — home" className="inline-block text-ink" href="/">
              <Wordmark className="h-9 w-auto md:h-11" />
            </Link>
            <p className="serif-italic mt-3 text-lg text-ink">Hand-finished in Doha</p>
            <NewsletterForm />
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {columns.map((column) =>
              column.links.length ? (
                <div className="min-w-0" key={column.heading}>
                  <h2 className="caps mb-4 text-[0.625rem] text-ink">{column.heading}</h2>
                  <ul className="flex flex-col gap-1">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <a
                          className="text-[0.8125rem] leading-5 break-words text-ink-soft transition-colors hover:text-ink"
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
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <LocaleButton
            className="caps self-start text-left text-[0.5625rem] text-ink-soft"
            variant="country"
          />
          <p className="caps text-[0.5625rem] text-ink-soft">
            All orders are charged in QAR · © {new Date().getFullYear()} plumpose
          </p>
        </div>
      </div>
    </footer>
  )
}
