/**
 * Is this database on this machine (the Docker one), rather than the live one
 * in the cloud?
 *
 * Development can run against either. What must never reach the live
 * database is decided here, not by NODE_ENV — `pnpm dev` pointed at Neon is
 * still development:
 *
 *   · schema push (Payload rewriting tables to follow the code) — the live
 *     schema changes only through migrations
 *   · the dev admin fixture, whose password is in the repository
 */
export const isLocalDatabase = (url: string = process.env.DATABASE_URL || ''): boolean => {
  try {
    const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
  } catch {
    return false
  }
}
