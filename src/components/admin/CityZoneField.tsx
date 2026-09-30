'use client'

import type { NumberFieldClientProps } from 'payload'

import { SelectInput, useField, useFormFields } from '@payloadcms/ui'
import React, { useMemo } from 'react'

import { cityKeyForZone, QBAS_ZONES, zoneLabel } from '@/data/qbasZones'

/**
 * The zone box in Qatar delivery → a city → "Zones with a different price".
 *
 * Lists only this city's QBAS zones ("Zone 94 · Shagra"), so she cannot pick
 * one that belongs elsewhere or type an id. The value stored is the QBAS id;
 * the server checks it again (`zoneFeeValidate` in the collection).
 */
export const CityZoneField: React.FC<NumberFieldClientProps> = (props) => {
  const { field, path: pathFromProps } = props
  const path = pathFromProps ?? field.name
  const { setValue, showError, value } = useField<number>({ path })
  const cityKey = useFormFields(([fields]) => fields.key?.value)

  const options = useMemo(
    () =>
      QBAS_ZONES.filter((z) => typeof cityKey === 'string' && cityKeyForZone(z) === cityKey).map(
        (z) => ({ label: zoneLabel(z), value: String(z.id) }),
      ),
    [cityKey],
  )

  if (!cityKey) {
    return (
      <div className="field-type">
        <div className="field-description" style={{ display: 'block' }}>
          Save the city first — its zones can be chosen after that.
        </div>
      </div>
    )
  }

  if (!options.length) {
    return (
      <div className="field-type">
        <div className="field-description" style={{ display: 'block' }}>
          No QBAS zones belong to this city, so there is nothing to choose here.
        </div>
      </div>
    )
  }

  return (
    <SelectInput
      description={
        typeof field.admin?.description === 'string' ? field.admin.description : undefined
      }
      label={field.label || 'Zone'}
      name={field.name}
      onChange={(option) => {
        const picked = Array.isArray(option) ? option[0] : option
        setValue(picked?.value ? Number(picked.value) : null)
      }}
      options={options}
      path={path}
      placeholder="Choose a zone"
      readOnly={props.readOnly}
      required={field.required}
      showError={showError}
      // A custom field gets no width from the row; fill what the fee box leaves.
      style={{ flex: '1 1 0%', minWidth: 220 }}
      value={typeof value === 'number' ? String(value) : undefined}
    />
  )
}
