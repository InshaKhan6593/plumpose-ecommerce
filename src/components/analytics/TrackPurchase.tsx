'use client'

import { useEffect } from 'react'

import { sendGtag } from './GoogleAnalytics'

export type PurchaseItem = {
  item_id: string
  item_name: string
  item_variant?: string
  price?: number
  quantity: number
}

type Props = {
  /** Amounts in riyals (major units), as Analytics expects. */
  coupon?: string
  items: PurchaseItem[]
  shipping: number
  transactionId: string
  value: number
}

/**
 * Tells Analytics about a sale, on arrival at the order page straight from
 * payment (`placed=1`). Once per order in this browser — a reload of that page
 * must not count the sale twice; Analytics also drops a repeated
 * `transaction_id`. Always QAR: that is what SkipCash charged.
 */
export function TrackPurchase({ coupon, items, shipping, transactionId, value }: Props) {
  useEffect(() => {
    const key = `ga-purchase:${transactionId}`
    try {
      if (window.localStorage.getItem(key)) return
      window.localStorage.setItem(key, '1')
    } catch {
      /* storage unavailable — Analytics' own de-duplication still applies */
    }
    sendGtag('event', 'purchase', {
      currency: 'QAR',
      items,
      shipping,
      transaction_id: transactionId,
      value,
      ...(coupon ? { coupon } : {}),
    })
  }, [coupon, items, shipping, transactionId, value])

  return null
}
