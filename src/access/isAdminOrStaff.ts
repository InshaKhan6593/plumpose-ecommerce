import type { Access, FieldAccess } from 'payload'

import { checkRole } from '@/access/utilities'

/**
 * Staff can work through orders and moderate content. They cannot change
 * prices, create discounts or open settings — those stay admin-only.
 */
export const isAdminOrStaff: Access = ({ req }) => {
  if (req.user) return checkRole(['admin', 'staff'], req.user)
  return false
}

export const isAdminOrStaffFieldAccess: FieldAccess = ({ req }) => {
  if (req.user) return checkRole(['admin', 'staff'], req.user)
  return false
}

/**
 * Money and payment state are never editable by hand, by anyone.
 *
 * The gateway is the source of truth. If an order's total or payment status
 * can be typed over in the admin, reconciliation against SkipCash silently
 * diverges and the accounts stop matching the money actually taken.
 */
export const neverEditable: FieldAccess = () => false
