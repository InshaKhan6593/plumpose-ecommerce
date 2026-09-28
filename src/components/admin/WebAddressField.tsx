'use client'

import type { TextFieldClientProps } from 'payload'

import { SlugField, useFormFields } from '@payloadcms/ui'
import React from 'react'

import { webSlug } from '@/utilities/webSlug'

type Props = TextFieldClientProps & { useAsSlug?: string }

/**
 * Payload's slug box, plus the two things it leaves out. It shows no
 * description, and it stays empty until the first save (the address is made
 * then, see `webAddress()`), so a new piece looked as if its web address had
 * been forgotten. While the box is empty this shows the address the title
 * will give.
 */
export const WebAddressField: React.FC<Props> = (props) => {
  const { field, path, useAsSlug = 'title' } = props
  const title = useFormFields(([fields]) => fields[useAsSlug]?.value)
  const value = useFormFields(([fields]) => fields[path ?? field.name]?.value)

  const preview = !value && typeof title === 'string' ? webSlug(title) : ''
  const description =
    typeof field.admin?.description === 'string' ? field.admin.description : undefined

  return (
    <div>
      <SlugField {...props} useAsSlug={useAsSlug} />
      {preview ? (
        // One block of text: the admin's description style is a flex row.
        <div className="field-description" style={{ display: 'block', marginTop: 6 }}>
          Will be <strong style={{ wordBreak: 'break-all' }}>{preview}</strong> — made from the
          title when you save.
        </div>
      ) : description ? (
        <div className="field-description" style={{ display: 'block', marginTop: 6 }}>
          {description}
        </div>
      ) : null}
    </div>
  )
}
