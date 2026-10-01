'use client'

import { ConfirmationModal, useModal } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

type Question = {
  body: React.ReactNode
  cancelLabel?: string
  confirmLabel: string
  confirmingLabel?: string
  heading: string
  onCancel?: () => void
  onConfirm: () => Promise<void> | void
}

/**
 * The admin's own "Are you sure?" pop-up, in place of the browser's
 * `window.confirm` box (grey, with the site's address as its title, which
 * read as an error to her).
 *
 *   const { ask, modal } = useAdminConfirm('courier-confirm')
 *   ask({ heading: 'Cancel the booking?', body: '…', confirmLabel: 'Cancel booking', onConfirm })
 *   return <>{…}{modal}</>
 *
 * The slug must be unique on the screen.
 */
export const useAdminConfirm = (slug: string) => {
  const { openModal } = useModal()
  const [question, setQuestion] = useState<null | Question>(null)

  const ask = useCallback(
    (next: Question) => {
      setQuestion(next)
      openModal(slug)
    },
    [openModal, slug],
  )

  const modal = (
    <ConfirmationModal
      body={question?.body ?? null}
      cancelLabel={question?.cancelLabel ?? 'Go back'}
      confirmingLabel={question?.confirmingLabel}
      confirmLabel={question?.confirmLabel}
      heading={question?.heading ?? ''}
      modalSlug={slug}
      onCancel={question?.onCancel}
      onConfirm={async () => {
        await question?.onConfirm()
      }}
    />
  )

  return { ask, modal }
}
