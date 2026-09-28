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
  /*
   * The keys (`pocket`, `text`, `gold`) are what the engine matches on; the
   * names beside them are what she reads. Keys are hidden in the admin.
   */
  {
    name: 'placement',
    type: 'text',
    admin: { description: 'Option key, e.g. `pocket`.', hidden: true },
    required: true,
  },
  {
    name: 'placementName',
    type: 'text',
    admin: { description: 'Where on the piece, as it was called when the order was placed.' },
    label: 'Placement',
  },
  {
    name: 'style',
    type: 'text',
    admin: { description: '`text`, `symbol` or `both`.', hidden: true },
    required: true,
  },
  {
    name: 'lettering',
    type: 'text',
    admin: { description: 'The letters to embroider. Empty for a symbol only.' },
    label: 'Letters',
  },
  { name: 'symbol', type: 'text', admin: { hidden: true } },
  { name: 'symbolName', type: 'text', label: 'Symbol' },
  { name: 'thread', type: 'text', admin: { hidden: true } },
  { name: 'threadName', type: 'text', label: 'Thread colour' },
  {
    name: 'feeQar',
    type: 'number',
    admin: {
      // Minor units, shown as QAR 160.00.
      components: { Field: '@/components/admin/ReadOnlyMoneyField#ReadOnlyMoneyField' },
      description: 'What this placement cost the customer.',
    },
    label: 'Fee',
  },
]

/** The array field as it hangs off one cart or order line. */
export const personalisationField: Field = {
  name: 'personalisation',
  type: 'array',
  admin: {
    components: { RowLabel: '@/components/admin/PlacementLabel#PlacementLabel' },
    description: 'The hand embroidery the customer chose for this piece.',
    initCollapsed: false,
  },
  fields: personalisationLineFields,
  label: 'Embroidery',
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
