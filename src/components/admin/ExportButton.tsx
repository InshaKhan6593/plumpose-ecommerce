'use client'

import { useSearchParams } from 'next/navigation'
import React from 'react'

/**
 * "Download as a spreadsheet" above a list. It keeps the list's filter, so
 * what she has narrowed the list to is what she downloads.
 */
export const ExportButton: React.FC<{ kind: 'orders' | 'subscribers'; label: string }> = ({
  kind,
  label,
}) => {
  const params = useSearchParams()
  const where = new URLSearchParams()
  params.forEach((value, key) => {
    if (key.startsWith('where')) where.append(key, value)
  })
  const query = where.toString()
  const filtered = query.length > 0

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', margin: '0 0 1rem' }}>
      <a
        className="btn btn--style-secondary btn--size-small"
        download
        href={`/api/exports/${kind}${filtered ? `?${query}` : ''}`}
      >
        {label}
      </a>
      <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.8125rem' }}>
        {filtered
          ? 'Just the ones this list is filtered to.'
          : 'All of them. Filter the list first to download fewer.'}{' '}
        Opens in Excel or Numbers.
      </span>
    </div>
  )
}

export default ExportButton
