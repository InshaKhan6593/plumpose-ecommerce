'use client'

import { useRowLabel } from '@payloadcms/ui'
import React from 'react'

import { qbasZone, zoneLabel } from '@/data/qbasZones'

/** A row reads "Zone 94 · Shagra — QAR 50", not "Zone with a different price 01". */
export const CityZoneRowLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<{ feeQar?: null | number; zone?: null | number }>()
  const zone = qbasZone(data?.zone)
  if (!zone) return <span>New zone {String((rowNumber ?? 0) + 1).padStart(2, '0')}</span>

  const fee = typeof data?.feeQar === 'number' ? ` — QAR ${data.feeQar}` : ''
  return <span>{`${zoneLabel(zone)}${fee}`}</span>
}
