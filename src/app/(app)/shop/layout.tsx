import React from 'react'

/**
 * The template put a search box and a filter sidebar around every shop page.
 * The plumpose shop carries its own heading and filter row (see ./page.tsx),
 * so this layout is now a plain pass-through.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
