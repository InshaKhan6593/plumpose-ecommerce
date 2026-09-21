import path from 'path'
import { getPayload } from 'payload'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Next loads .env automatically; a standalone tsx script does not.
// process.loadEnvFile is built into Node, so this needs no dependency.
process.loadEnvFile(path.resolve(dirname, '../../.env'))

const { default: config } = await import('../payload.config.js')
const { seed } = await import('./index.js')

/**
 * Run with:  pnpm seed
 *
 * Safe to re-run — every record is checked before it is created.
 */
const run = async () => {
  const payload = await getPayload({ config })

  console.log('\nSeeding plumpose…\n')
  await seed(payload)

  process.exit(0)
}

run().catch((err) => {
  console.error('\nSeed failed:\n', err)
  process.exit(1)
})
