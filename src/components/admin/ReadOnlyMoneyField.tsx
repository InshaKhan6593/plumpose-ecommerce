'use client'

import type { NumberFieldClientProps } from 'payload'

import { FieldDescription, FieldLabel, useField } from '@payloadcms/ui'
import React from 'react'

import { formatQar } from '@/lib/pricing/money'

/**
 * An order's money breakdown, read only. The figures are minor units, so
 * Payload's number box showed the piece as "139900" and delivery as "2000";
 * this shows QAR 1,399.00 and QAR 20.00, as the email and the customer did.
 */
export const ReadOnlyMoneyField: React.FC<NumberFieldClientProps> = ({ field, path }) => {
  const fieldPath = path ?? field.name
  const { value } = useField<number>({ path: fieldPath })
  const description = field.admin?.description

  return (
    <div className="field-type number read-only" style={{ marginBottom: 'var(--spacing-field)' }}>
      <FieldLabel label={field.label} path={fieldPath} />
      <div
        style={{
          border: '1px solid var(--theme-elevation-150)',
          fontVariantNumeric: 'tabular-nums',
          padding: '10px 15px',
        }}
      >
        {typeof value === 'number' ? formatQar(value) : '—'}
      </div>
      {description ? <FieldDescription description={description} path={fieldPath} /> : null}
    </div>
  )
}
