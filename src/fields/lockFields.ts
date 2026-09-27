import type { Field } from 'payload'

import { neverEditable } from '@/access/isAdminOrStaff'

/**
 * Makes the named fields read-only for everyone, wherever they sit in the tree.
 *
 * The plugin puts an order's `amount` and `currency` in an unnamed row and its
 * `items` inside a tabs field. A flat `.map()` over the top level found only
 * `status` and `transactions`, so the amount and the lines could still be
 * changed through the admin and the API. Walking tabs, rows and unnamed groups
 * reaches all of them, and keeps working if the plugin moves them again.
 */
export const lockFields = (fields: Field[], names: readonly string[]): Field[] =>
  fields.map((field) => {
    if ('name' in field && names.includes(field.name)) {
      return {
        ...field,
        access: { ...('access' in field ? field.access : {}), update: neverEditable },
        admin: { ...field.admin, readOnly: true },
      } as Field
    }

    if (field.type === 'tabs') {
      return {
        ...field,
        tabs: field.tabs.map((tab) => ({ ...tab, fields: lockFields(tab.fields, names) })),
      }
    }

    if (!('name' in field) && 'fields' in field && Array.isArray(field.fields)) {
      return { ...field, fields: lockFields(field.fields, names) } as Field
    }

    return field
  })
