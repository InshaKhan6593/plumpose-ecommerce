import type { Metadata } from 'next'

import React from 'react'

import { LegalPage } from '@/components/editorial/LegalPage'
import { PRIVACY_PAGE } from '@/content/pages'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  description:
    'How plumpose collects, uses and protects your personal information when you browse or order: payments, delivery, cookies and your choices.',
  title: 'Privacy policy',
}

/** Privacy — hers, in full (PRIVACY_PAGE in src/content/pages.ts). */
export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: 'Privacy policy', path: '/privacy' }]} />
      <LegalPage {...PRIVACY_PAGE} />
    </>
  )
}
