import type { Field } from 'payload'

/**
 * Hand-embroidery, recorded against a single cart or order line.
 *
 * Personalisation is the piece's main differentiator (C20) and the one thing
 * the atelier cannot work without — yet until now an order had nowhere to
 * record what was actually ordered.
 *
 * **These are snapshots, not relationships.** A line stores the option key
 * *and* the name it was called at the time, plus the fee charged. If the
 * client later renames "Gold" or removes a placement, a two-year-old order
 * must still read the way it was placed and still reconcile to the amount the
 * customer paid. A relationship would either break or silently rewrite
 * history; ported from the legacy `normalisePersonalisation()` in
 * `netlify/lib/personalisation.mjs`, which returns exactly these pairs.
 */
export const personalisationLineFields: Field[] = [
  {
    name: 'placement',
    type: 'text',
    admin: { description: 'Option key, e.g. `pocket`.' },
    required: true,
  },
  {
    name: 'placementName',
    type: 'text',
    admin: { description: 'What it was called when the order was placed.' },
  },
  {
    name: 'style',
    type: 'text',
    admin: { description: '`text`, `symbol` or `both`.' },
    required: true,
  },
  {
    name: 'lettering',
    type: 'text',
    admin: { description: 'The letters to embroider. Empty for a symbol-only placement.' },
  },
  { name: 'symbol', type: 'text' },
  { name: 'symbolName', type: 'text' },
  { name: 'thread', type: 'text' },
  { name: 'threadName', type: 'text' },
  {
    name: 'feeQar',
    type: 'number',
    admin: {
      description: 'Fee charged for this placement, in minor units. Snapshot, never recalculated.',
    },
  },
]

/** The array field as it hangs off one cart or order line. */
export const personalisationField: Field = {
  name: 'personalisation',
  type: 'array',
  admin: {
    description:
      'Hand-embroidery on this piece. Written by the server from the personalisation options — never typed in by hand.',
    initCollapsed: true,
  },
  fields: personalisationLineFields,
  label: 'Personalisation',
  labels: { plural: 'Placements', singular: 'Placement' },
}

/**
 * Appends `extra` to the `fields` of the array field named `arrayName`,
 * wherever it sits in the tree.
 *
 * On Carts `items` is top level, but on Orders the plugin nests it inside a
 * `tabs` field, so a flat `.map()` over `defaultCollection.fields` silently
 * finds nothing and the personalisation quietly fails to appear. Walking the
 * tree handles both, and keeps working if the plugin moves it again.
 */
export const extendArrayField = (fields: Field[], arrayName: string, extra: Field[]): Field[] =>
  fields.map((field) => {
    if (field.type === 'array' && 'name' in field && field.name === arrayName) {
      return { ...field, fields: [...field.fields, ...extra] }
    }

    if (field.type === 'tabs') {
      return {
        ...field,
        tabs: field.tabs.map((tab) => ({
          ...tab,
          fields: extendArrayField(tab.fields, arrayName, extra),
        })),
      }
    }

    if ('fields' in field && Array.isArray(field.fields)) {
      return { ...field, fields: extendArrayField(field.fields, arrayName, extra) }
    }

    return field
  })
