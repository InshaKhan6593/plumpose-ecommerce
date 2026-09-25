'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

/**
 * "Refresh exchange rates" above the Currencies list (REQUIREMENTS A14).
 * Hand-set prices are never changed — only the rate each is checked against.
 */
export const RefreshRatesButton: React.FC = () => {
  const router = useRouter()
  const [state, setState] = useState<{ busy: boolean; message: string }>({ busy: false, message: '' })

  const refresh = async () => {
    setState({ busy: true, message: '' })
    try {
      const res = await fetch('/api/currencies/refresh-rates', { credentials: 'include', method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { error?: string; ratesFrom?: string; updated?: number }
      if (!res.ok) return setState({ busy: false, message: body.error ?? 'That did not work. Please try again.' })
      const when = body.ratesFrom ? new Date(body.ratesFrom).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Qatar' }) : ''
      setState({ busy: false, message: `${body.updated} rates updated${when ? `, as of ${when} (Doha)` : ''}.` })
      router.refresh()
    } catch {
      setState({ busy: false, message: 'The rate service could not be reached. Please try again later.' })
    }
  }

  return (
    <div style={{ alignItems: 'baseline', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', margin: '0 0 1rem' }}>
      <button className="btn btn--style-secondary btn--size-small" disabled={state.busy} onClick={refresh} type="button">
        {state.busy ? 'Refreshing…' : 'Refresh exchange rates'}
      </button>
      <span style={{ color: 'var(--theme-elevation-500)', fontSize: '0.8125rem' }}>
        {state.message ||
          'Your hand-set prices stay as they are. "Difference" shows how far each is from today’s rate. Rates by Exchange Rate API.'}
      </span>
    </div>
  )
}

export default RefreshRatesButton
