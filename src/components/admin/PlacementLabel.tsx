'use client'

import { useRowLabel } from '@payloadcms/ui'
import React from 'react'

type Placement = {
  lettering?: null | string
  placementName?: null | string
  symbolName?: null | string
  threadName?: null | string
}

/** One embroidery placement's heading — "Pocket: S.H in Gold", not "Placement 01". */
export const PlacementLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<Placement>()
  const what = [data?.lettering, data?.symbolName].filter(Boolean).join(' + ')
  const where = data?.placementName || `Placement ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`
  return (
    <span>
      {where}
      {what ? `: ${what}` : ''}
      {data?.threadName ? ` in ${data.threadName}` : ''}
    </span>
  )
}
