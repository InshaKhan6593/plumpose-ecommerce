import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

import { adminOnly } from '@/access/adminOnly'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'
import { isR2MediaEnabled } from '@/storage/r2'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  admin: {
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'updatedAt'],
    group: 'Content',
    listSearchableFields: ['filename', 'alt'],
    pagination: { defaultLimit: 24, limits: [12, 24, 48, 96] },
    useAsTitle: 'alt',
  },
  slug: 'media',
  // A photo's description, focal point or file shows on prerendered pages.
  hooks: withStorefrontRefresh(),
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  upload: {
    /**
     * Responsive sizes. The old site inlined full-resolution photography as
     * base64 inside index.html, so the whole gallery downloaded before
     * anything rendered and nothing could be cached. Generating these once at
     * upload time is what actually fixes that.
     *
     * `position: 'centre'` crops from the middle rather than the top, which
     * matters for full-length garment shots.
     */
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      { name: 'thumbnail', width: 300, height: 400, position: 'centre' },
      { name: 'square', width: 800, height: 800, position: 'centre' },
      { name: 'small', width: 600, height: undefined },
      { name: 'medium', width: 900, height: undefined },
      { name: 'large', width: 1400, height: undefined },
      { name: 'xlarge', width: 1920, height: undefined },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
    mimeTypes: ['image/*'],
    /**
     * With photos in R2, nothing is written here — but Payload still looks in
     * this folder to avoid a name clash, and `public/media` holds the local
     * copies of the same files, so every upload came back as "brand-01-window-1.jpg"
     * and the storefront, which finds some photos by name, lost them. An empty
     * folder of its own avoids that.
     */
    staticDir: isR2MediaEnabled()
      ? path.join(os.tmpdir(), 'plumpose-r2-media')
      : path.resolve(dirname, '../../public/media'),
  },
}
