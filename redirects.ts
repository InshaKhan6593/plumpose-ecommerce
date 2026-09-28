import type { NextConfig } from 'next'

export const redirects: NextConfig['redirects'] = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header' as const,
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  /*
   * The test address, since plumpose.com went live (28 Sep 2026): one copy of
   * the site for Google, not two. Only that exact host — a preview deploy's own
   * address (plumpose-<hash>-….vercel.app) still serves itself. `/api/` stays:
   * SkipCash's sandbox may still post its webhooks there, and a webhook
   * sender need not follow a redirect.
   */
  const testAddressRedirect = {
    destination: 'https://plumpose.com/:path',
    has: [{ type: 'host' as const, value: 'plumpose.vercel.app' }],
    permanent: true,
    source: '/:path((?!api/).*)',
  }

  return [testAddressRedirect, internetExplorerRedirect]
}
