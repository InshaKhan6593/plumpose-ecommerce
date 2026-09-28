'use client'

import { useRowLabel } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

type Line = {
  personalisation?: { lettering?: null | string; placementName?: null | string; symbolName?: null | string; threadName?: null | string }[] | null
  product?: { id?: number; title?: string } | null | number
  quantity?: number
  variant?: { id?: number; title?: string } | null | number
}

const idOf = (value: Line['product']) => (typeof value === 'object' ? value?.id : value)
const titleOf = (value: Line['product']) => (typeof value === 'object' ? value?.title : undefined)

/**
 * An order line's heading: what to make, not "Item 01". The line holds only
 * the piece's and size's ids, so their names are read once from the API
 * (the size's title already reads "Piece — M").
 */
export const OrderItemLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<Line>()
  const [name, setName] = useState<string>(titleOf(data?.variant) ?? titleOf(data?.product) ?? '')

  const variantId = idOf(data?.variant)
  const productId = idOf(data?.product)

  useEffect(() => {
    if (name || (!variantId && !productId)) return
    const url = variantId
      ? `/api/variants/${variantId}?depth=0&select[title]=true`
      : `/api/products/${productId}?depth=0&select[title]=true`
    let live = true
    fetch(url, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => live && doc?.title && setName(doc.title))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [name, productId, variantId])

  const embroidery = (data?.personalisation ?? [])
    .map((p) => [p.placementName, p.lettering || p.symbolName, p.threadName].filter(Boolean).join(', '))
    .filter(Boolean)

  return (
    <span>
      {name || `Item ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`}
      {data?.quantity ? ` × ${data.quantity}` : ''}
      {embroidery.length ? ` · Embroidery: ${embroidery.join('; ')}` : ''}
    </span>
  )
}
