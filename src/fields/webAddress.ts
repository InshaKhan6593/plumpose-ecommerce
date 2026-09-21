import type { RowField } from 'payload'

import { slugField } from 'payload'

/**
 * "Slug" is developer vocabulary. To the client this is simply the web
 * address her page will live at, and it is generated from the title, so she
 * should almost never touch it.
 *
 * Wraps Payload's slugField and relabels it. The lock stays — changing a
 * slug after publishing breaks every existing link to the page, so making
 * it deliberately awkward is correct.
 */
export const webAddress = (useAsSlug = 'title'): RowField =>
  slugField({
    overrides: (field) => {
      // A RowField's admin has no description, so it goes on the text field.
      for (const sub of field.fields) {
        if ('name' in sub && sub.name === 'slug') {
          sub.label = 'Web address'
          sub.admin = {
            ...sub.admin,
            description:
              'Made from the title. Only change it before publishing — editing it later breaks existing links.',
          }
        }
      }

      return field
    },
    useAsSlug,
  })
