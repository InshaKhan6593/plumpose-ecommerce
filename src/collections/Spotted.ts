import type { CollectionAfterChangeHook, CollectionConfig, FieldAccess } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { checkRole } from '@/access/utilities'
import { spottedSubmitEndpoint } from '@/endpoints/spottedSubmit'
import { withStorefrontRefresh } from '@/hooks/revalidateStorefront'

const adminField: FieldAccess = ({ req: { user } }) => Boolean(user && checkRole(['admin'], user as never))

/**
 * A customer's photograph she rejects is deleted, not kept: they sent it to be
 * shown, and it will not be. Only photographs that came in through the site's
 * form — never one she added herself from the library.
 */
const deleteRejectedPhoto: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (!doc.submitted || doc.status !== 'rejected' || previousDoc?.status === 'rejected') return doc
  const imageId = typeof doc.image === 'object' ? doc.image?.id : doc.image
  if (!imageId) return doc
  await req.payload.delete({ collection: 'media', id: imageId, overrideAccess: true, req }).catch((error: unknown) => {
    req.payload.logger.error({ err: error, spotted: doc.id }, 'Could not delete a rejected Spotted photograph.')
  })
  return doc
}

/**
 * Customer photographs (REQUIREMENTS S15, A10). Customers send them from the
 * Spotted page (@/endpoints/spottedSubmit); she can also add them herself.
 * Nothing appears on the site until it has been approved — a luxury brand
 * cannot show unmoderated photographs of strangers.
 */
export const Spotted: CollectionConfig = {
  slug: 'spotted',
  /** Soft delete — a mistaken delete here costs real work to recreate. */
  trash: true,
  defaultSort: '-createdAt',
  /** Drag-and-drop ordering in the list view — no sortOrder field to type into. */
  orderable: true,
  labels: { singular: 'Spotted post', plural: 'Spotted' },
  admin: {
    defaultColumns: ['instagramHandle', 'status', 'submitted', 'createdAt'],
    description:
      'Customer photos. Only approved posts appear on the site. Rejecting a photo a customer sent in deletes it; drag to change the order.',
    group: 'Content',
    useAsTitle: 'instagramHandle',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    // Pending and rejected posts are hers alone — not every signed-in customer's.
    read: ({ req: { user } }) => {
      if (user && checkRole(['admin'], user as never)) return true
      return { status: { equals: 'approved' } }
    },
    update: adminOnly,
  },
  /** The customers' form posts here (POST /api/spotted/submit). */
  endpoints: [spottedSubmitEndpoint],
  /** The storefront pages that show this are prerendered; see revalidateStorefront. */
  hooks: withStorefrontRefresh({ afterChange: [deleteRejectedPhoto] }),
  fields: [
    {
      /*
       * Required — except on a rejected post a customer sent in, whose photograph
       * is deleted (deleteRejectedPhoto). So it is checked here rather than made
       * a required column, which would stop the photograph being deleted at all.
       */
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      validate: (value: unknown, { data }: { data: Record<string, unknown> }) =>
        Boolean(value) || data?.status === 'rejected' || 'Please choose a photograph.',
    },
    {
      name: 'instagramHandle',
      type: 'text',
      admin: { description: 'Including the @.' },
      required: true,
    },
    { name: 'caption', type: 'text', maxLength: 200 },
    { name: 'postUrl', type: 'text', label: 'Link to the Instagram post' },
    {
      name: 'status',
      type: 'select',
      admin: { position: 'sidebar' },
      defaultValue: 'pending',
      options: [
        { label: 'Pending approval', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      required: true,
    },
    {
      name: 'submitted',
      type: 'checkbox',
      access: { update: () => false },
      admin: { description: 'Sent in by the customer through the Spotted page.', position: 'sidebar', readOnly: true },
      defaultValue: false,
      label: 'Sent in from the site',
    },
    {
      name: 'consent',
      type: 'checkbox',
      access: { update: () => false },
      admin: { description: 'They confirmed the photograph is theirs and that plumpose may share it.', position: 'sidebar', readOnly: true },
      defaultValue: false,
      label: 'Permission to share',
    },
    {
      name: 'email',
      type: 'email',
      access: { read: adminField },
      admin: { description: 'Optional — theirs, if they left it. Never shown on the site.', position: 'sidebar' },
    },
    {
      /** A salted hash of the sender's address, for the per-device limit. Never the address itself. */
      name: 'ipHash',
      type: 'text',
      access: { read: adminField, update: () => false },
      admin: { hidden: true },
      index: true,
    },
  ],
}
