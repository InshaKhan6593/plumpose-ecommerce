import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Every callback the payment gateway sends us, stored verbatim (P4).
 *
 * The webhook is the source of truth for whether an order was paid, so when a
 * payment is disputed the question is always "what did SkipCash actually send,
 * and did it verify?". Without this the answer is unknowable. It also makes
 * the idempotency check auditable rather than a side effect.
 *
 * Kept even when `signatureValid` is false — a stream of failures is exactly
 * what a forged-callback attempt looks like, and discarding them hides it.
 */
export const WebhookLog: CollectionConfig = {
  slug: 'webhookLog',
  access: {
    /** Written by the webhook receiver only, and never edited afterwards. */
    create: () => false,
    delete: () => false,
    read: adminOnly,
    update: () => false,
  },
  admin: {
    defaultColumns: ['paymentId', 'orderRef', 'statusId', 'signatureValid', 'createdAt'],
    description: 'Raw payment gateway callbacks, for audit.',
    group: 'Shop',
    hidden: true,
    useAsTitle: 'paymentId',
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'paymentId', type: 'text', index: true },
    { name: 'orderRef', type: 'text', index: true },
    {
      name: 'statusId',
      type: 'number',
      admin: { description: "The gateway's own status code. 2 is Paid." },
    },
    {
      name: 'signatureValid',
      type: 'checkbox',
      admin: { description: 'Did the HMAC verify? A run of `false` means someone is probing.' },
      defaultValue: false,
    },
    {
      name: 'applied',
      type: 'checkbox',
      admin: { description: 'Did this callback change the order, or was it a duplicate?' },
      defaultValue: false,
    },
    {
      name: 'payload',
      type: 'json',
      admin: { description: 'Exactly what arrived, before we interpreted any of it.' },
    },
  ],
  labels: { plural: 'Payment callbacks', singular: 'Payment callback' },
}
