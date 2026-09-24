import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import { fileURLToPath } from 'url'

/**
 * Uploads AI-generated **test** photographs to the Media library, so they can
 * be tried in the real layout before the client is asked to shoot them.
 * See docs/TEST-SHOTS.md.
 *
 *   pnpm test-shots
 *
 * Reads `../brand-assets/test-shots/*.{jpg,png,webp}` and stores each as
 * `test-<name>` with an alt text that says plainly it is not for launch.
 * Idempotent — re-running replaces a shot, so a regenerated image simply takes
 * over. They only appear on the site while `TEST_SHOTS=on`.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url))
process.loadEnvFile(path.resolve(dirname, '../.env'))

const { default: config } = await import('../src/payload.config.js')

const DIR = path.resolve(dirname, '../../brand-assets/test-shots')
const ALT_PREFIX = 'TEST SHOT — not for launch:'

const run = async () => {
  const payload = await getPayload({ config })

  const files = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('test-'))
    : []

  if (!files.length) {
    console.log(`  no images in ${DIR}`)
    process.exit(0)
  }

  for (const file of files) {
    const alt = `${ALT_PREFIX} ${path.parse(file).name}`

    const existing = await payload.find({ collection: 'media', depth: 0, limit: 10, where: { alt: { equals: alt } } })
    for (const doc of existing.docs) await payload.delete({ collection: 'media', id: doc.id })

    // Uploaded under test-<name> so the site finds it by name.
    const staged = path.join(DIR, `test-${file}`)
    fs.copyFileSync(path.join(DIR, file), staged)
    try {
      const doc = await payload.create({ collection: 'media', data: { alt }, filePath: staged })
      console.log(`  ${existing.docs.length ? 'replaced' : 'imported'}  ${file}  →  ${doc.filename}`)
    } finally {
      fs.rmSync(staged, { force: true })
    }
  }

  process.exit(0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
