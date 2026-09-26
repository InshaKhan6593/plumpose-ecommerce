/**
 * Runs the database migrations during a host's build — for the live site
 * only. Part of `pnpm build:deploy`.
 *
 * Deploy previews and branch deploys use the same Neon database as the live
 * site, so a preview of an unfinished branch must never change its schema.
 * Migrations run when the host says this is the production build
 * (Netlify: CONTEXT=production; Vercel: VERCEL_ENV=production), or when asked
 * with MIGRATE_ON_BUILD=yes.
 *
 * They go over the direct connection (DATABASE_URL_DIRECT), not the pooler.
 */
import { spawnSync } from 'node:child_process'

const production =
  process.env.CONTEXT === 'production' || process.env.VERCEL_ENV === 'production'
const asked = process.env.MIGRATE_ON_BUILD === 'yes'

if (!production && !asked) {
  console.log(
    `Migrations skipped: not the production build (CONTEXT=${process.env.CONTEXT ?? '-'}, ` +
      `VERCEL_ENV=${process.env.VERCEL_ENV ?? '-'}). The schema this build expects must ` +
      'already be live — merge migrations to production first.',
  )
  process.exit(0)
}

const direct = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
if (!direct) {
  console.error('Neither DATABASE_URL_DIRECT nor DATABASE_URL is set.')
  process.exit(1)
}

const result = spawnSync('pnpm', ['payload', 'migrate'], {
  env: { ...process.env, DATABASE_URL: direct },
  shell: process.platform === 'win32',
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
