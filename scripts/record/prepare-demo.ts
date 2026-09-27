/**
 * Makes the demo database the tutorial videos start from: the whole website
 * in place — settings, delivery, embroidery, page text, FAQs, content — and
 * no products, so each video adds its own from her saved photographs.
 *
 * Run after `payload migrate` + `pnpm seed` against the demo database
 * (scripts/record/reset-demo.sh does all of it). Refuses anything that is not
 * a local database.
 *
 * Removes what the seed adds for development: the piece and its sizes, the
 * SAMPLE Made-for-You projects and the dev admin. Creates one admin for the
 * recordings and writes its login to ../recordings/demo-admin.json (outside
 * the repository).
 */
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { getPayload } from 'payload'

// A standalone script: load .env as the seed does. Variables already set —
// DATABASE_URL pointing at the demo — win.
process.loadEnvFile(path.resolve(process.cwd(), '.env'))

const { default: config } = await import('@/payload.config')
const { isLocalDatabase } = await import('@/utilities/database')

if (!isLocalDatabase() || !/plumpose_demo/.test(process.env.DATABASE_URL ?? '')) {
  console.error('prepare-demo runs only against the local plumpose_demo database.')
  process.exit(1)
}

const payload = await getPayload({ config: await config })
const quiet = { disableRevalidate: true }
const all = { depth: 0, limit: 0, overrideAccess: true, pagination: false } as const

const variants = await payload.find({ collection: 'variants', ...all, trash: true })
for (const v of variants.docs) {
  await payload.delete({ collection: 'variants', context: quiet, id: v.id, overrideAccess: true, trash: false })
}
const products = await payload.find({ collection: 'products', ...all, draft: true, trash: true })
for (const p of products.docs) {
  await payload.delete({ collection: 'products', context: quiet, id: p.id, overrideAccess: true, trash: false })
}
const samples = await payload.find({ collection: 'projects', ...all, trash: true })
for (const p of samples.docs) {
  await payload.delete({ collection: 'projects', context: quiet, id: p.id, overrideAccess: true, trash: false })
}
await payload.delete({
  collection: 'users',
  overrideAccess: true,
  where: { email: { equals: 'dev@plumpose.local' } },
})

const email = 'admin@plumpose.demo'
const password = randomBytes(12).toString('base64url')
await payload.delete({ collection: 'users', overrideAccess: true, where: { email: { equals: email } } })
await payload.create({
  collection: 'users',
  data: { email, name: 'Plumpose', password, roles: ['admin'] },
  overrideAccess: true,
})

const out = path.resolve(process.cwd(), '..', 'recordings')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'demo-admin.json'), JSON.stringify({ email, password }, null, 2))

console.log(
  `demo ready: removed ${products.docs.length} piece(s), ${variants.docs.length} size(s), ` +
    `${samples.docs.length} sample project(s); admin ${email} (login in ../recordings/demo-admin.json)`,
)
process.exit(0)
