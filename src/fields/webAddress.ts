import type { RowField, TextField } from 'payload'

import { slugField } from 'payload'

import { webSlug } from '@/utilities/webSlug'

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
          const slug = sub as TextField
          slug.label = 'Web address'
          slug.admin = {
            ...slug.admin,
            // Payload's box, plus its description and a live preview while empty.
            components: {
              ...slug.admin?.components,
              Field: {
                clientProps: { useAsSlug },
                path: '@/components/admin/WebAddressField#WebAddressField',
              },
            },
            description:
              'Made from the title. Only change it before publishing — editing it later breaks existing links.',
          }
          /*
           * Payload makes the address in a beforeChange hook, which runs after
           * validation. A piece published straight from "Create new" (products
           * no longer autosave a draft first) failed "Web address is required"
           * before it could be made. Fill it from the title before validating.
           */
          slug.hooks = {
            ...slug.hooks,
            beforeValidate: [
              ...(slug.hooks?.beforeValidate ?? []),
              ({ data, value }) =>
                value || (typeof data?.[useAsSlug] === 'string' ? webSlug(data[useAsSlug]) : value),
            ],
          }
        }
      }

      return field
    },
    // Payload's slugify doubled hyphens around a dash and dropped accented letters.
    slugify: ({ valueToSlugify }) =>
      typeof valueToSlugify === 'string' ? webSlug(valueToSlugify) : valueToSlugify,
    useAsSlug,
  })
