import type { Metadata } from 'next'

import React from 'react'

import { LegalPage } from '@/components/editorial/LegalPage'
import { TERMS_PAGE } from '@/content/pages'

export const metadata: Metadata = {
  alternates: { canonical: '/terms' },
  description:
    'The terms for using plumpose.com and ordering: products, orders, prices in Qatari riyals, payment, shipping, returns and intellectual property.',
  title: 'Terms & conditions',
}

/** Terms & Conditions — hers (TERMS_PAGE in src/content/pages.ts). */
export default function TermsPage() {
  return <LegalPage {...TERMS_PAGE} />
}
