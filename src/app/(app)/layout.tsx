import type { ReactNode } from 'react'

import { AdminBar } from '@/components/AdminBar'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { LocalePicker } from '@/components/locale/LocalePicker'
import { RewardWheel } from '@/components/spin/RewardWheel'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { ensureStartsWith } from '@/utilities/ensureStartsWith'
import { MotionProvider } from '@/motion/MotionProvider'
import { Providers } from '@/providers'
import { GeistMono } from 'geist/font/mono'
import { Fraunces, Jost } from 'next/font/google'
import React from 'react'
import './globals.css'

/* plumpose house fonts — matches the existing site:
   Fraunces for display, Jost for body. */
// Fraunces is a variable font. When `axes` are requested, `weight` must be
// omitted — next/font exposes the full weight range instead.
const fraunces = Fraunces({
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-fraunces',
})

const jost = Jost({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-jost',
  weight: ['300', '400', '500'],
})

/* const { SITE_NAME, TWITTER_CREATOR, TWITTER_SITE } = process.env
const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'http://localhost:3000'
const twitterCreator = TWITTER_CREATOR ? ensureStartsWith(TWITTER_CREATOR, '@') : undefined
const twitterSite = TWITTER_SITE ? ensureStartsWith(TWITTER_SITE, 'https://') : undefined
 */
/* export const metadata = {
  metadataBase: new URL(baseUrl),
  robots: {
    follow: true,
    index: true,
  },
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  ...(twitterCreator &&
    twitterSite && {
      twitter: {
        card: 'summary_large_image',
        creator: twitterCreator,
        site: twitterSite,
      },
    }),
} */

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
     * `data-theme` and `js-motion` are rendered, not set by a script. The site
     * is light only, so there is nothing to decide at runtime; and a
     * before-paint <script> tripped React's "script tag while rendering"
     * warning whenever Next re-rendered this layout on the client (every 404).
     * If the motion script never loads, the CSS failsafe in globals.css still
     * shows everything after 2.5s.
     */
    <html
      className={[fraunces.variable, jost.variable, GeistMono.variable, 'js-motion']
        .filter(Boolean)
        .join(' ')}
      data-theme="light"
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers>
          <AdminBar />
          <LivePreviewListener />

          <MotionProvider>
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
            {/* First-visit reward wheel — decides for itself whether to appear. */}
            <RewardWheel />
            <LocalePicker />
          </MotionProvider>
        </Providers>
      </body>
    </html>
  )
}
