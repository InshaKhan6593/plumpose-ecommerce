'use client'

import React from 'react'

type Props = {
  cellData?: null | string
}

/**
 * Thread colours are stored as hex. A column of "#BD9540" tells the client
 * nothing; a swatch beside it tells her everything.
 */
export const SwatchCell: React.FC<Props> = ({ cellData }) => {
  if (!cellData) return <span>—</span>

  return (
    <span style={{ alignItems: 'center', display: 'inline-flex', gap: '.5rem' }}>
      <span
        aria-hidden="true"
        style={{
          background: cellData,
          border: '1px solid rgba(27,24,21,.2)',
          borderRadius: '50%',
          display: 'inline-block',
          height: 14,
          width: 14,
        }}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{cellData}</span>
    </span>
  )
}

export default SwatchCell
