import type { FieldAccess, PayloadRequest } from 'payload'

import { describe, expect, it } from 'vitest'

import config from '@/payload.config'

/**
 * An order's money and lines are the gateway's record, never hand-edited.
 *
 * The plugin nests `amount` / `currency` in an unnamed row and `items` in a
 * tabs field. A top-level map once locked only `status` and `transactions`,
 * so the admin could change a paid order's total and quantities. The
 * sanitised config flattens rows and unnamed tabs, which is exactly where
 * those fields were missed.
 */
describe('orders — money and lines are locked', async () => {
  const orders = (await config).collections.find((c) => c.slug === 'orders')
  const admin = { user: { roles: ['admin'] } } as unknown as PayloadRequest

  it.each(['amount', 'currency', 'items', 'status', 'transactions'])(
    '%s cannot be updated, even by an admin',
    async (name) => {
      const field = orders?.flattenedFields.find((f) => f.name === name)
      expect(field, `${name} is on orders`).toBeDefined()
      const update = (field as { access?: { update?: FieldAccess } }).access?.update
      expect(update, `${name} has update access`).toBeTypeOf('function')
      expect(await update!({ req: admin } as Parameters<FieldAccess>[0])).toBe(false)
      expect((field as { admin?: { readOnly?: boolean } }).admin?.readOnly).toBe(true)
    },
  )

  it.each(['fulfilment', 'trackingNumber', 'adminNotes', 'gift'])(
    '%s stays editable for her',
    (name) => {
      const field = orders?.flattenedFields.find((f) => f.name === name)
      expect((field as { access?: { update?: unknown } }).access?.update).toBeUndefined()
    },
  )
})
