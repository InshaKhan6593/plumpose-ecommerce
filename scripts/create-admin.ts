/**
 * Creates the first admin login on a database — run once, before the site is
 * public. Until an admin exists, Payload's /admin offers "create first user"
 * to whoever reaches it first.
 *
 *   DATABASE_URL=<live, direct> NODE_ENV=production npx tsx scripts/create-admin.ts you@example.com "Your Name"
 *
 * The password is typed at the prompt, not passed on the command line, so it
 * stays out of the shell history. Refuses if an admin already exists.
 */
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

const dirname = path.dirname(fileURLToPath(import.meta.url))
process.loadEnvFile(path.resolve(dirname, '../.env'))

const [email, ...nameParts] = process.argv.slice(2)
const name = nameParts.join(' ').trim()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email> "<name>"')
  process.exit(1)
}

/** Typed at a terminal: read key by key, showing nothing. */
const readFromTerminal = (question: string): Promise<string> =>
  new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    let value = ''
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (c === '\u0003') process.exit(130) // Ctrl+C
        value = c === '\u007f' || c === '\b' ? value.slice(0, -1) : value + c
      }
    }
    stdin.on('data', onData)
  })

/**
 * Piped in (a script, a test): one line per question, from one reader — a
 * second reader would find stdin already closed by the first.
 */
let piped: AsyncIterator<string> | undefined
const readFromPipe = async (question: string): Promise<string> => {
  process.stdout.write(`${question}\n`)
  piped ??= readline
    .createInterface({ input: process.stdin, terminal: false })
    [Symbol.asyncIterator]()
  const next = await piped.next()
  return next.done ? '' : String(next.value)
}

const askHidden = (question: string) =>
  process.stdin.isTTY ? readFromTerminal(question) : readFromPipe(question)

const { default: config } = await import('../src/payload.config.js')
const payload = await getPayload({ config })

const admins = await payload.count({
  collection: 'users',
  overrideAccess: true,
  where: { roles: { contains: 'admin' } },
})
if (admins.totalDocs > 0) {
  console.error(`This database already has ${admins.totalDocs} admin(s). Nothing changed.`)
  process.exit(1)
}

const host = new URL((process.env.DATABASE_URL || '').replace(/^postgres(ql)?:/, 'http:')).hostname
console.log(`Creating an admin for ${email} on ${host}.`)

const password = await askHidden('Password (at least 12 characters): ')
if (password.length < 12) {
  console.error('Too short. Nothing changed.')
  process.exit(1)
}
if ((await askHidden('Same again: ')) !== password) {
  console.error('The two did not match. Nothing changed.')
  process.exit(1)
}

await payload.create({
  collection: 'users',
  data: { email, name: name || undefined, password, roles: ['admin'] } as never,
  overrideAccess: true,
})
console.log(`Admin created: ${email}. Sign in at /admin.`)
process.exit(0)
