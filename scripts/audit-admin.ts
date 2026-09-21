import path from 'path'
import { getPayload } from 'payload'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
process.loadEnvFile(path.resolve(dirname, '../.env'))

const { default: config } = await import('../src/payload.config.js')

/**
 * Prints the resolved admin configuration for every collection and global,
 * so gaps (missing group, missing useAsTitle, no defaultColumns, columns
 * pointing at fields that do not exist) can be found without clicking
 * through the panel.
 *
 *   pnpm audit:admin
 */
const run = async () => {
  const payload = await getPayload({ config })

  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))

  console.log('\n' + '='.repeat(110))
  console.log('COLLECTIONS')
  console.log('='.repeat(110))
  console.log(
    pad('slug', 24) + pad('group', 16) + pad('useAsTitle', 18) + pad('sort', 14) + 'flags',
  )
  console.log('-'.repeat(110))

  const problems: string[] = []

  for (const col of payload.config.collections) {
    const a: any = col.admin || {}
    // Payload's own internal collections are hidden and not the client's concern
    if (col.slug.startsWith('payload-')) continue
    const flags = [
      (col as any).orderable ? 'orderable' : '',
      (col as any).trash ? 'trash' : '',
      (col as any).versions ? 'versions' : '',
      a.hidden ? 'HIDDEN' : '',
    ]
      .filter(Boolean)
      .join(' ')

    console.log(
      pad(col.slug, 24) +
        pad(a.group || '— none —', 16) +
        pad(a.useAsTitle || '— none —', 18) +
        pad(String((col as any).defaultSort || '—'), 14) +
        flags,
    )

    const fieldNames = new Set<string>()
    const walk = (fields: any[]) => {
      for (const f of fields) {
        if (f.name) fieldNames.add(f.name)
        if (f.fields) walk(f.fields)
        if (f.tabs) f.tabs.forEach((t: any) => walk(t.fields || []))
      }
    }
    walk(col.fields as any[])
    // Payload adds these automatically
    ;['id', 'createdAt', 'updatedAt', '_status', 'filename', 'mimeType', 'filesize'].forEach((n) =>
      fieldNames.add(n),
    )

    const cols: string[] = a.defaultColumns || []
    if (!cols.length) {
      problems.push(`${col.slug}: no defaultColumns — the list will guess`)
    }
    for (const c of cols) {
      const base = c.split('.')[0]
      if (!fieldNames.has(base)) {
        problems.push(`${col.slug}: column "${c}" does not match any field`)
      }
    }
    if (!a.group) problems.push(`${col.slug}: no admin.group — it floats loose in the sidebar`)
    if (!a.useAsTitle && !col.auth) problems.push(`${col.slug}: no useAsTitle — rows show as IDs`)

    if (cols.length) console.log('    columns: ' + cols.join(', '))
  }

  console.log('\n' + '='.repeat(110))
  console.log('GLOBALS')
  console.log('='.repeat(110))
  for (const g of payload.config.globals) {
    const a: any = g.admin || {}
    console.log(pad(g.slug, 24) + pad(a.group || '— none —', 16))
    if (!a.group) problems.push(`global ${g.slug}: no admin.group`)
  }

  console.log('\n' + '='.repeat(110))
  console.log(problems.length ? `PROBLEMS (${problems.length})` : 'NO PROBLEMS FOUND')
  console.log('='.repeat(110))
  problems.forEach((p) => console.log('  • ' + p))
  console.log()

  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
