import React from 'react'

export const BeforeLogin: React.FC = () => {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <p style={{ margin: 0 }}>
        <strong>plumpose</strong> — sign in to manage products, orders and the site.
      </p>
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: '.85rem', margin: '.4rem 0 0' }}>
        Customers sign in on the website itself, not here.
      </p>
    </div>
  )
}
