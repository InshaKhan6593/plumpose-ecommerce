'use client'

import type { SaveButtonClientProps } from 'payload'

import { SaveButton, useDocumentDrawerContext, useDocumentInfo, useModal } from '@payloadcms/ui'
import React, { useEffect, useRef } from 'react'

/**
 * A size's Save button. Opened from its piece (in a drawer), saving an
 * existing size left the window open over the list, so it looked as if
 * nothing had happened; this closes it once the save has gone through.
 * On the size's own page (no drawer) it is Payload's Save button, unchanged.
 */
export const SizeSaveButton: React.FC<SaveButtonClientProps> = (props) => {
  const { drawerSlug } = useDocumentDrawerContext()
  const { closeModal } = useModal()
  const { id, savedDocumentData } = useDocumentInfo()

  const updatedAt = savedDocumentData?.updatedAt
  const openedAt = useRef(updatedAt)

  useEffect(() => {
    if (!drawerSlug || !id || !updatedAt) return
    if (updatedAt !== openedAt.current) closeModal(drawerSlug)
  }, [closeModal, drawerSlug, id, updatedAt])

  return <SaveButton {...props} />
}
