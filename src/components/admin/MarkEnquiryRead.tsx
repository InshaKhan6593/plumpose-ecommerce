'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import { useEffect, useRef } from 'react'

/**
 * Opening a new enquiry marks it read, as an inbox does (REQUIREMENTS A16).
 * It saves just the status, straight away, without leaving the form "unsaved";
 * she can set it back to New, or on to Replied or Archived, herself.
 */
export const MarkEnquiryRead = () => {
  const { data, id, setData } = useDocumentInfo()
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
      .then(async (res) => {
        if (!res.ok) return
        setValue('read', true)
        /*
         * The edit view remembers when it loaded the document and, on Save,
         * refuses as "Document modified… by another user" if it changed since.
         * This save is ours: hand the view its new time.
         */
        const { doc } = (await res.json()) as { doc?: { updatedAt?: string } }
        if (doc?.updatedAt) setData({ ...data, status: 'read', updatedAt: doc.updatedAt })
      })
      .catch(() => undefined)
  }, [data, id, setData, setValue, value])

  return null
}

export default MarkEnquiryRead
