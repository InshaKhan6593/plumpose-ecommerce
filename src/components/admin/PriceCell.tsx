'use client'

import React from 'react'

type Props = {
  cellData?: null | number
}

/**
 * The ecommerce plugin stores money in minor units, so a price of
 * QAR 1,399.00 is the integer 139900. Rendered raw in a list column that
 * reads as "139900", which is unusable for the client.
 */
export const PriceCell: React.FC<Props> = ({ cellData }) => {
  if (cellData === null || cellData === undefined) return <span>—</span>

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {`QAR ${(cellData / 100).toLocaleString('en-GB', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })}`}
    </span>
  )
}

export default PriceCell
