'use client'

import { Button, toast, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { useAdminConfirm } from './useAdminConfirm'

/**
 * "Resend confirmation" on the order screen (A6).
 *
 * For the customer who says the email never arrived. Asks first, because it
 * sends a real email to a real customer, then refreshes so the "Confirmation
 * emailed" date beneath it updates.
 */
export const ResendConfirmation: React.FC = () => {
  const { id } = useDocumentInfo()
  const email = useFormFields(([fields]) => fields.customerEmail?.value) as string | undefined
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const { ask, modal } = useAdminConfirm('resend-confirmation')

  if (!id) return null

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/orders/${id}/resend-confirmation`, {
        credentials: 'include',
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as { message?: string }

      if (res.ok) {
        toast.success(body.message || 'Confirmation sent.')
        router.refresh()
      } else {
        toast.error(body.message || 'The email could not be sent.')
      }
    } catch {
      toast.error('The email could not be sent. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ marginBottom: 'var(--base)' }}>
      <Button
        buttonStyle="secondary"
        disabled={sending}
        margin={false}
        onClick={() =>
          ask({
            body: `The order confirmation email goes to ${email || 'the customer'} again — the same email they received when they paid.`,
            confirmingLabel: 'Sending…',
            confirmLabel: 'Send it again',
            heading: 'Resend the confirmation?',
            onConfirm: send,
          })
        }
        size="medium"
      >
        {sending ? 'Sending…' : 'Resend confirmation'}
      </Button>
      {modal}
    </div>
  )
}

export default ResendConfirmation
