import type { Metadata } from 'next'

import React from 'react'

import { LegalPage } from '@/components/editorial/LegalPage'
import { PRIVACY_PAGE } from '@/content/pages'

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  description: 'How plumpose looks after your personal information.',
  title: 'Privacy policy',
}

/** Privacy — hers (PRIVACY_PAGE in src/content/pages.ts); its opening sections are still to come. */
export default function PrivacyPage() {
  return <LegalPage {...PRIVACY_PAGE} />
}
