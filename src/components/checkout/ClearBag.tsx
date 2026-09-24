'use client'

import { useEcommerce } from '@payloadcms/plugin-ecommerce/client/react'
import { useEffect, useRef } from 'react'

import { CHECKOUT_DRAFT_KEY } from './CheckoutPage'

/**
 * On arrival from a successful payment: the browser forgets the bag that was
 * just paid for (the plugin has already marked it purchased) and the checkout
 * draft, so the header shows an empty bag and the next visit starts fresh.
 */
export function ClearBag() {
  const { clearSession } = useEcommerce()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    clearSession()
    try {
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
    } catch {
      /* storage unavailable — nothing to clear */
    }
  }, [clearSession])

  return null
}
