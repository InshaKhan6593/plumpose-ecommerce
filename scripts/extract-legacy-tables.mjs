/**
 * One-off: pulls the country and currency tables out of the old site's
 * source files and writes them to src/seed/data/*.json so the seed can
 * load them without reaching outside the project.
 *
 *   node scripts/extract-legacy-tables.mjs "<path to plumpose-DEPLOY>"
 */
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const legacyRoot =
  process.argv[2] || 'C:\\Users\\Insha Khan\\plumpose Final\\plumpose-DEPLOY'

const libPath = (f) => pathToFileURL(path.join(legacyRoot, 'netlify', 'lib', f)).href

const outDir = path.resolve('src/seed/data')
fs.mkdirSync(outDir, { recursive: true })

const write = (name, data) => {
  const file = path.join(outDir, name)
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`  ${name}  ${Array.isArray(data) ? data.length : Object.keys(data).length} entries`)
}

const countriesMod = await import(libPath('countries.mjs'))
const pricingMod = await import(libPath('pricing.mjs'))

// COUNTRY_TABLE: CODE -> [name, currency, zoneKey, blockedReason?]
const countries = Object.entries(countriesMod.COUNTRY_TABLE).map(([code, row]) => ({
  code,
  name: row[0],
  currencyCode: row[1],
  zoneKey: row[2],
  blockedReason: row[3] || null,
}))

// PRICE_LIST: CODE -> { name, symbol, decimals, step, price }
const currencies = Object.entries(pricingMod.PRICE_LIST).map(([code, row]) => ({
  code,
  name: row.name,
  symbol: row.symbol,
  decimals: row.decimals ?? 0,
  step: row.step ?? 1,
  priceOverride: row.price ?? null,
}))

console.log('\nExtracted from the legacy site:')
write('countries.json', countries)
write('currencies.json', currencies)

const blocked = countries.filter((c) => c.blockedReason)
console.log(`\n  ${blocked.length} countries carry a blocked reason (sanctions / no carrier route)`)
console.log(`  zones referenced: ${[...new Set(countries.map((c) => c.zoneKey))].sort().join(', ')}\n`)
