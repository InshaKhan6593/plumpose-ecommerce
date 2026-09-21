import type { Field } from 'payload'

/**
 * Several collections need a stable machine-readable identifier — shipping
 * zones, Qatar cities, personalisation options. The client should never have
 * to invent one, or even know it exists.
 *
 * This derives it from whichever field carries the human name, and hides it.
 * She types "Al Khor & Al Dhakhira"; the key becomes "al-khor-al-dhakhira".
 *
 * The key is only generated once, on create. Renaming a zone later must not
 * silently change its identifier, because seeded data and any code that
 * looks a zone up by key would stop matching.
 */
export const autoKey = (sourceField = 'name'): Field => ({
  name: 'key',
  type: 'text',
  admin: {
    description:
      'Used internally to link this record to the rest of the site. Generated automatically.',
    hidden: true,
    readOnly: true,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, value }) => {
        if (value) return value
        if (operation !== 'create') return value

        const source = data?.[sourceField]
        if (typeof source !== 'string' || !source.trim()) return value

        return source
          .toLowerCase()
          .replace(/&/g, ' ')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60)
      },
    ],
  },
  index: true,
  unique: true,
})
