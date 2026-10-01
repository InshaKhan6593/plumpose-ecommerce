'use client'

import { Button, ReactSelect, toast, useDocumentInfo } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

import { QBAS_ZONES, zoneLabel } from '@/data/qbasZones'

import { useAdminConfirm } from './useAdminConfirm'

/**
 * "Courier" on the order's sidebar — QBAS, for orders delivered in Qatar.
 *
 * Check the zone (the customer's choice at checkout, locked behind "Change zone"), then
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

const OPTIONS = QBAS_ZONES.map((z) => ({ label: zoneLabel(z), value: String(z.id) }))

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
  // The customer's zone is locked behind "Change zone": a slip of the list would send the driver elsewhere.
  const [changingZone, setChangingZone] = useState(false)
  const { ask, modal } = useAdminConfirm('courier-confirm')

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
              onClick={() =>
                ask({
                  body: `QBAS booking ${view.barcode} will be cancelled and the driver will not collect the parcel. You can send the order to QBAS again afterwards.`,
                  cancelLabel: 'Keep the booking',
                  confirmingLabel: 'Cancelling…',
                  confirmLabel: 'Cancel booking',
                  heading: 'Cancel the QBAS booking?',
                  onConfirm: async () => {
                    await act('cancel')
                  },
                })
              }
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
          {view.zone && !changingZone ? (
            <>
              <p style={{ fontSize: 13, margin: '4px 0 0' }}>{view.zone.label}</p>
              <p style={{ ...small, marginTop: 2 }}>The customer chose this zone at checkout.</p>
              <div style={row}>
                <Button
                  buttonStyle="secondary"
                  disabled={Boolean(busy)}
                  margin={false}
                  onClick={() => setChangingZone(true)}
                  size="small"
                >
                  Change zone
                </Button>
              </div>
            </>
          ) : (
            <>
              <ReactSelect
                disabled={Boolean(busy)}
                // By what she reads, not the hidden QBAS id: "51" must not find 570451 (Lusail, zone 69).
                filterOption={(option, search) =>
                  option.label.toLowerCase().includes(search.trim().toLowerCase())
                }
                inputId="courier-zone"
                isClearable={false}
                isSearchable
                noOptionsMessage={() => 'No zone matches — try the number or the name.'}
                onChange={(option) => {
                  const picked = Array.isArray(option) ? option[0] : option
                  const next = OPTIONS.find((o) => o.value === picked?.value)
                  if (!next || next.value === String(view.zone?.id)) return
                  ask({
                    body: view.zone
                      ? `The customer chose ${view.zone.label} at checkout, and paid delivery for it. Only change it if you have checked the address with them — QBAS will deliver to ${next.label}.`
                      : `QBAS will deliver this order to ${next.label}.`,
                    confirmLabel: 'Change zone',
                    heading: view.zone
                      ? `Change the zone to ${next.label}?`
                      : `Set the zone to ${next.label}?`,
                    onConfirm: async () => {
                      await act('zone', { zoneId: Number(next.value) })
                    },
                  })
                }}
                options={OPTIONS}
                placeholder="Type a zone number or area…"
                value={OPTIONS.find((o) => o.value === String(view.zone?.id))}
              />
              {view.zone ? (
                <div style={row}>
                  <Button
                    buttonStyle="secondary"
                    disabled={Boolean(busy)}
                    margin={false}
                    onClick={() => setChangingZone(false)}
                    size="small"
                  >
                    Keep {view.zone.label}
                  </Button>
                </div>
              ) : null}
            </>
          )}
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
              onClick={() =>
                ask({
                  body: `A QBAS driver will come to your atelier to collect this parcel, for delivery to ${view.zone?.label}. Only send it when the piece is packed and ready.`,
                  confirmingLabel: 'Booking…',
                  confirmLabel: 'Send to QBAS',
                  heading: 'Book a QBAS pickup?',
                  onConfirm: async () => {
                    await act('book')
                  },
                })
              }
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
      {modal}
    </div>
  )
}

export default CourierPanel
