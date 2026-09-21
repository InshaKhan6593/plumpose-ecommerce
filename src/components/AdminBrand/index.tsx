import React from 'react'

/** Wordmark shown on the login screen, replacing the Payload logo. */
export const AdminLogo: React.FC = () => (
  <div className="plumpose-mark" style={{ textAlign: 'center' }}>
    plumpose
    <div
      style={{
        color: 'var(--plumpose-ink-soft)',
        fontFamily: 'var(--plumpose-body, sans-serif)',
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

/**
 * The mark in the breadcrumb. It sits in a narrow slot, so a wordmark gets
 * truncated to "p…" — a compact monogram is the only thing that fits and
 * still looks deliberate.
 */
export const AdminIcon: React.FC = () => (
  <span
    aria-label="plumpose"
    className="plumpose-mark plumpose-mark--small"
    title="plumpose"
    style={{ display: 'inline-block', lineHeight: 1 }}
  >
    p
  </span>
)
