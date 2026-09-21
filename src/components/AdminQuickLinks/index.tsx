import Link from 'next/link'
import React from 'react'

import './index.scss'

/**
 * Payload orders each sidebar group by config array order, and the ecommerce
 * plugin appends its collections after ours — so Products and Orders end up
 * below Discount codes and the reward wheel. Those two are what the client
 * opens every day, so they get pinned to the top of the nav instead of
 * fighting the plugin's ordering.
 */
const links: Array<{ href: string; label: string }> = [
  { href: '/admin/collections/products', label: 'Products' },
  { href: '/admin/collections/orders', label: 'Orders' },
  { href: '/admin/globals/siteSettings', label: 'Site settings' },
]

export const AdminQuickLinks: React.FC = () => (
  <nav aria-label="Shortcuts" className="plumpose-quicklinks">
    <span className="plumpose-quicklinks__label">Everyday</span>
    <ul>
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href}>{l.label}</Link>
        </li>
      ))}
    </ul>
  </nav>
)

export default AdminQuickLinks
