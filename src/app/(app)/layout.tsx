import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AdminBar } from '@/components/AdminBar'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { LocalePicker } from '@/components/locale/LocalePicker'
import { RewardWheel } from '@/components/spin/RewardWheel'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { getServerSideURL } from '@/utilities/getURL'
import { MotionProvider } from '@/motion/MotionProvider'
import { Providers } from '@/providers'
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

/*
 * `metadataBase` makes every relative URL in page metadata — canonicals and
 * share images — absolute on the site's own address, so it follows
 * NEXT_PUBLIC_SERVER_URL to plumpose.com at launch. The template brands every
 * page title; it does not apply to the homepage's own title, which is in this
 * same segment (node_modules/next/dist/docs, generate-metadata, `template`).
 */
export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  // For a page with no share image of its own; a product page sets its photo.
  openGraph: {
    images: [{ alt: 'plumpose', height: 1024, url: '/brand/plumpose-logo.png', width: 1024 }],
    siteName: 'plumpose',
    type: 'website',
  },
  title: {
    default: 'plumpose — silk pyjamas & nightwear, designed in Doha',
    template: '%s — plumpose',
  },
}

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
      className={[fraunces.variable, jost.variable, 'js-motion'].filter(Boolean).join(' ')}
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
