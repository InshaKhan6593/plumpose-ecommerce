'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { useEffect } from 'react'

import { analyticsUrl } from '@/utilities/analyticsUrl'

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? ''

/**
 * Google Analytics 4, on the storefront only (the admin has its own layout).
 * Rendered by the root layout when `NEXT_PUBLIC_GA_ID` is set — on Vercel,
 * Production only — so development, tests and preview deploys send nothing.
 *
 * Page views are sent here, not by Google's own history listener, so that every
 * address goes through `analyticsUrl()` first and no order or reset token in a
 * query reaches Google. The stream's Enhanced measurement → Page views →
 * "Page changes based on browser history events" **must be off**: Google's
 * listener counts each navigation a second time and sends the raw previous
 * address as the referrer — an order token included (BUILD-LOG §63).
 */
export function GoogleAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    const location = analyticsUrl(window.location.href)
    // Once per address: React runs effects twice in development.
    if (location === lastPageView) return
    // Within the site the referrer is the previous page, cleaned the same way;
    // the browser's own stays at the page the visit began from.
    const referrer = lastPageView || analyticsUrl(document.referrer)
    lastPageView = location
    // `set`, not only the page view's own fields: Google's automatic events
    // (engagement, scrolls, outbound clicks) otherwise read the address from
    // the browser, token and all — checked in §63.
    sendGtag('set', {
      page_location: location,
      page_referrer: referrer,
      page_title: document.title,
    })
    sendGtag('event', 'page_view')
  }, [pathname])

  if (!GA_ID) return null
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
      strategy="afterInteractive"
    />
  )
}

let configured = false
let lastPageView = ''

/**
 * A gtag call, queued on `dataLayer` for gtag.js to read when it arrives. The
 * first call sets the tag up (`js`, the cleaned address, then `config` without
 * its automatic page view), so nothing can be queued ahead of it. A no-op when
 * Analytics is off.
 */
export function sendGtag(...args: unknown[]): void {
  if (typeof window === 'undefined' || !GA_ID) return
  if (!configured) {
    configured = true
    gtag('js', new Date())
    // Before anything is sent: an event can come ahead of the first page view
    // (the purchase, from deeper in the page), and must not carry the token.
    gtag('set', {
      page_location: analyticsUrl(window.location.href),
      page_referrer: analyticsUrl(document.referrer),
    })
    gtag('config', GA_ID, {
      send_page_view: false,
      // Local runs show in Admin → DebugView as developer traffic, not as visitors.
      ...(process.env.NODE_ENV !== 'production' ? { debug_mode: true } : {}),
    })
  }
  gtag(...args)
}

/** Google's own `gtag()`: gtag.js reads each entry as an `arguments` object. */
function gtag(..._args: unknown[]): void {
  window.dataLayer = window.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}
