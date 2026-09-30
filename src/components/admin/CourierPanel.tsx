'use client'

import { Button, toast, useDocumentInfo } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

import { QBAS_ZONES, zoneLabel } from '@/data/qbasZones'

/**
 * "Courier" on the order's sidebar — QBAS, for orders delivered in Qatar.
 *
 * Choose the zone (the customer's choice at checkout is already there), then
 * **Send to QBAS**: the pickup is booked, the tracking number fills in, and
 * the label can be printed. From then on QBAS's updates move the order along
 * by themselves (see @/delivery/qbas/apply); **Check now** asks straight away,
 * **Cancel booking** calls the driver off.
 *
 * Every action reloads the page afterwards: the server has just written the
 * tracking number or the fulfilment, and a form still holding the old values
 * would put them back on the next Save.
 */

type View = {
  barcode: null | string
  booked: boolean
  error: null | string
  events: Array<{ at: string; label: string; notes: string }>
  missing: string[]
  problems: string[]
  status: null | { code: string; label: string; stage: string }
  zone: null | { id: number; label: string }
}

const OPTIONS = QBAS_ZONES.map((z) => ({ id: z.id, label: zoneLabel(z) }))

const when = (iso: null | string | undefined) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
      })
    : ''

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  marginBottom: 'var(--base)',
  padding: 'calc(var(--base) * 0.75)',
}
const small: React.CSSProperties = { color: 'var(--theme-elevation-500)', fontSize: 12, lineHeight: 1.5 }
const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }

export const CourierPanel: React.FC = () => {
  const { id } = useDocumentInfo()
  const [view, setView] = useState<null | View>(null)
  const [busy, setBusy] = useState<null | string>(null)

  const load = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/orders/${id}/courier`, { credentials: 'include' })
    if (res.ok) setView((await res.json()) as View)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!id || !view) return null

  const act = async (
    action: 'book' | 'cancel' | 'check' | 'zone',
    body?: Record<string, unknown>,
  ): Promise<boolean> => {
    setBusy(action)
    try {
      const res = await fetch(`/api/orders/${id}/courier/${action}`, {
        body: JSON.stringify(body ?? {}),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const result = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        toast.error(result.message || 'QBAS could not be reached. Try again.')
        await load()
        return false
      }
      toast.success(result.message || 'Done.')
      window.setTimeout(() => window.location.reload(), 900)
      return true
    } catch {
      toast.error('Check your connection and try again.')
      return false
    } finally {
      setBusy(null)
    }
  }

  const printLabel = async () => {
    // Opened now, on the click: a window opened after the fetch would be blocked as a pop-up.
    const tab = window.open('', '_blank')
    setBusy('label')
    try {
      const res = await fetch(`/api/orders/${id}/courier/label`, {
        credentials: 'include',
        method: 'POST',
      })
      const result = (await res.json().catch(() => ({}))) as { message?: string; url?: string }
      if (res.ok && result.url) {
        if (tab) tab.location.href = result.url
        else window.location.href = result.url
      } else {
        tab?.close()
        toast.error(result.message || 'The label could not be fetched.')
      }
    } catch {
      tab?.close()
      toast.error('Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  const abroad = view.problems.find((p) => p.includes('within Qatar only'))
  if (abroad) {
    return (
      <div style={box}>
        <p className="field-label">Courier</p>
        <p style={small}>
          QBAS delivers within Qatar only. Ship this order yourself, type its tracking number
          above, then set Fulfilment to Shipped.
        </p>
      </div>
    )
  }

  const otherProblems = view.problems.filter((p) => p !== abroad)
  const canSend = !view.missing.length && !otherProblems.length && Boolean(view.zone) && !busy

  return (
    <div style={box}>
      <p className="field-label">Courier — QBAS</p>

      {view.booked ? (
        <>
          <p style={{ fontSize: 13, margin: '6px 0 0' }}>
            Tracking number <strong>{view.barcode}</strong>
          </p>
          <p style={{ ...small, marginTop: 4 }}>
            {view.status?.label}
            {view.events[0] ? ` · ${when(view.events[0].at)}` : ''}
          </p>
          <p style={{ ...small, marginTop: 4 }}>{view.zone?.label}</p>
          <div style={row}>
            <Button buttonStyle="primary" disabled={Boolean(busy)} margin={false} onClick={printLabel} size="small">
              {busy === 'label' ? 'Opening…' : 'Print label'}
            </Button>
            <Button
              buttonStyle="secondary"
              disabled={Boolean(busy)}
              margin={false}
              onClick={() => void act('check')}
              size="small"
            >
              {busy === 'check' ? 'Asking QBAS…' : 'Check now'}
            </Button>
          </div>
          <div style={row}>
            <Button
              buttonStyle="error"
              disabled={Boolean(busy)}
              margin={false}
              onClick={() => {
                if (
                  window.confirm(
                    `Cancel the QBAS booking ${view.barcode}? The driver will not collect it. You can send the order again afterwards.`,
                  )
                )
                  void act('cancel')
              }}
              size="small"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <label className="field-label" htmlFor="courier-zone" style={{ display: 'block', marginTop: 8 }}>
            Delivery zone
          </label>
          <select
            disabled={Boolean(busy)}
            id="courier-zone"
            onChange={(e) => void act('zone', { zoneId: Number(e.target.value) })}
            style={{
              background: 'var(--theme-input-bg)',
              border: '1px solid var(--theme-elevation-150)',
              color: 'var(--theme-text)',
              padding: '8px',
              width: '100%',
            }}
            value={view.zone?.id ?? ''}
          >
            <option disabled value="">
              Choose the zone…
            </option>
            {OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {!view.zone ? (
            <p style={{ ...small, marginTop: 6 }}>
              This order has no zone — ask the customer, or find it from the address.
            </p>
          ) : null}

          {view.missing.length ? (
            <p style={{ ...small, color: 'var(--theme-error-500)', marginTop: 8 }}>
              QBAS is not connected yet — missing {view.missing.join(', ')}.
            </p>
          ) : null}
          {otherProblems.map((p) => (
            <p key={p} style={{ ...small, color: 'var(--theme-error-500)', marginTop: 8 }}>
              {p}
            </p>
          ))}

          <div style={row}>
            <Button
              buttonStyle="primary"
              disabled={!canSend}
              margin={false}
              onClick={() => {
                if (
                  window.confirm(
                    `Book a QBAS pickup for this order, to ${view.zone?.label}? A driver will come to collect the parcel.`,
                  )
                )
                  void act('book')
              }}
              size="small"
            >
              {busy === 'book' ? 'Booking…' : view.barcode ? 'Send to QBAS again' : 'Send to QBAS'}
            </Button>
          </div>
          <p style={{ ...small, marginTop: 8 }}>
            Books the pickup from your atelier. The tracking number fills in, the label can be
            printed, and QBAS’s updates then move this order along — the customer sees each one.
          </p>
        </>
      )}

      {view.error ? (
        <p style={{ ...small, color: 'var(--theme-error-500)', marginTop: 10 }}>Last problem: {view.error}</p>
      ) : null}

      {view.events.length ? (
        <details style={{ marginTop: 12 }}>
          <summary style={{ ...small, cursor: 'pointer' }}>What QBAS has reported</summary>
          <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
            {view.events.map((e, i) => (
              <li key={`${e.at}-${i}`} style={{ ...small, marginBottom: 4 }}>
                <span style={{ color: 'var(--theme-text)' }}>{e.label}</span> · {when(e.at)}
                {e.notes ? ` — ${e.notes}` : ''}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  )
}

export default CourierPanel
