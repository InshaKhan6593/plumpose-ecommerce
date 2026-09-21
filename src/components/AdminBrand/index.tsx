import React from 'react'

/** Wordmark shown on the login screen, replacing the Payload logo. */
export const AdminLogo: React.FC = () => (
  <div className="plumpose-mark" style={{ textAlign: 'center' }}>
    plumpose
    <div
      style={{
        color: 'var(--plumpose-ink-soft)',
        fontFamily: 'var(--font-jost, sans-serif)',
        fontSize: '.6rem',
        letterSpacing: '.28em',
        marginTop: '.5rem',
        textTransform: 'uppercase',
      }}
    >
      Atelier
    </div>
  </div>
)

/** Small mark shown in the admin nav. */
export const AdminIcon: React.FC = () => <span className="plumpose-mark plumpose-mark--small">p</span>
