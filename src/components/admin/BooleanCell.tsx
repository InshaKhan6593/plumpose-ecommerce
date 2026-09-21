'use client'

import React from 'react'

type Props = {
  cellData?: boolean | null
}

/**
 * Checkbox columns render the literal string "true" in a pill, which reads
 * like a debug value. A tick and a dash are legible at a glance.
 */
export const BooleanCell: React.FC<Props> = ({ cellData }) => (
  <span
    aria-label={cellData ? 'Yes' : 'No'}
    style={{
      color: cellData ? 'var(--theme-success-500, #4b6b54)' : 'var(--plumpose-ink-faint, #a9a299)',
      fontSize: '1rem',
      lineHeight: 1,
    }}
    title={cellData ? 'Yes' : 'No'}
  >
    {cellData ? '✓' : '—'}
  </span>
)

export default BooleanCell
