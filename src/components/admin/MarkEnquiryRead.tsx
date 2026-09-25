'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import { useEffect, useRef } from 'react'

/**
 * Opening a new enquiry marks it read, as an inbox does (REQUIREMENTS A16).
 * It saves just the status, straight away, without leaving the form "unsaved";
 * she can set it back to New, or on to Replied or Archived, herself.
 */
export const MarkEnquiryRead = () => {
  const { id } = useDocumentInfo()
  const { setValue, value } = useField<string>({ path: 'status' })
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !id || value !== 'new') return
    done.current = true
    fetch(`/api/form-submissions/${id}`, {
      body: JSON.stringify({ status: 'read' }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    })
      .then((res) => {
        if (res.ok) setValue('read', true)
      })
      .catch(() => undefined)
  }, [id, setValue, value])

  return null
}

export default MarkEnquiryRead
