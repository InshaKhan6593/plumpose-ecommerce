import React from 'react'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * Breadcrumb structured data for a storefront page: Home, then each step to
 * this page. Search engines show it as the page's path in a result
 * ("plumpose.com › Made for you › …") instead of the bare address. Nothing is
 * drawn on the page. The product page builds its own (Home › Shop › piece).
 */
export function BreadcrumbJsonLd({ trail }: { trail: { name: string; path: string }[] }) {
  const base = getServerSideURL().replace(/\/$/, '')
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((step, i) => ({
      '@type': 'ListItem',
      item: `${base}${step.path === '/' ? '/' : step.path}`,
      name: step.name,
      position: i + 1,
    })),
  }
  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
      type="application/ld+json"
    />
  )
}
