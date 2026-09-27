import type { Field } from 'payload'

/**
 * Maps every field, walking into unnamed groups and rows — which only lay
 * fields out, so their children behave as top-level fields. The plugin puts
 * prices in one, where a top-level map never reached them.
 */
export const mapFieldsDeep = <F extends Field>(fields: F[], fn: (field: F) => F): F[] =>
  fields.map((field) =>
    !('name' in field) && 'fields' in field && (field.type === 'group' || field.type === 'row')
      ? ({ ...field, fields: mapFieldsDeep(field.fields as F[], fn) } as F)
      : fn(field),
  )
