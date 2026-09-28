/**
 * Adds sizes XS and XL (her size chart of 28 Sep 2026) to Al Shaheen Nights,
 * beside S, M and L. Stock 0: the piece is Made to order, so they can be
 * ordered at once; she sets the real stock in Sizes & stock. Safe to run
 * again — anything already there is left alone.
 *
 *   npx tsx scripts/add-sizes-xs-xl.ts                                # the database in .env
 *   DATABASE_URL=<live, direct> npx tsx scripts/add-sizes-xs-xl.ts    # Neon, without the pooler
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

const dirname = path.dirname(fileURLToPath(import.meta.url))
process.loadEnvFile(path.resolve(dirname, '../.env'))

const PIECE = 'al-shaheen-nights'
const SIZES = [
  { label: 'XS', value: 'xs' },
  { label: 'XL', value: 'xl' },
]

const { default: config } = await import('../src/payload.config.js')
const payload = await getPayload({ config })
console.log('database:', new URL(process.env.DATABASE_URL!.replace(/^postgres(ql)?:/, 'http:')).hostname)

const sizeType = (
  await payload.find({ collection: 'variantTypes', depth: 0, limit: 1, where: { name: { equals: 'Size' } } })
).docs[0]
if (!sizeType) throw new Error('No "Size" kind of option on this database.')

const piece = (
  await payload.find({ collection: 'products', depth: 0, draft: true, limit: 1, where: { slug: { equals: PIECE } } })
).docs[0]
if (!piece) throw new Error(`No piece with the web address "${PIECE}".`)

for (const size of SIZES) {
  const option =
    (
      await payload.find({
        collection: 'variantOptions',
        depth: 0,
        limit: 1,
        where: { and: [{ variantType: { equals: sizeType.id } }, { label: { equals: size.label } }] },
      })
    ).docs[0] ??
    (await payload.create({
      collection: 'variantOptions',
      data: { label: size.label, value: size.value, variantType: sizeType.id },
    }))

  const existing = await payload.find({
    collection: 'variants',
    depth: 0,
    limit: 1,
    where: { and: [{ product: { equals: piece.id } }, { options: { contains: option.id } }] },
  })
  if (existing.docs.length) {
    console.log(`${size.label}: already on the piece`)
    continue
  }
  await payload.create({
    collection: 'variants',
    data: { inventory: 0, options: [option.id], product: piece.id },
  })
  console.log(`${size.label}: added (stock 0)`)
}

process.exit(0)
