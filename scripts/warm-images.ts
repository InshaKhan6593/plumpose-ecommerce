/**
 * Makes the site its own first visitor, so real visitors never wait for a
 * photo to be resized. Run after each deploy:
 *
 *   npx tsx scripts/warm-images.ts https://plumpose.vercel.app
 *   npx tsx scripts/warm-images.ts https://… --widths=640,828,1080,1920
 *
 * Every photo is resized the first time a given width is asked for — fetched
 * from R2 and resized, 1–3 s — and served from the cache after that (BUILD-LOG
 * §35–36). This reads the sitemap, opens every page, and asks for each photo
 * at the widths a page offers the browser, the way a browser would.
 *
 * `--widths` narrows that to the sizes phones, tablets and desktops actually
 * use; without it every width in every srcset is warmed.
 */

export {}

const [base = '', ...args] = process.argv.slice(2)
if (!/^https?:\/\//.test(base)) {
  console.error('Usage: npx tsx scripts/warm-images.ts <site url> [--widths=640,828,1080,1920]')
  process.exit(1)
}
const origin = base.replace(/\/+$/, '')
const widthsArg = args.find((a) => a.startsWith('--widths='))
const widths = widthsArg
  ? new Set(widthsArg.slice('--widths='.length).split(',').map(Number))
  : null

/** Browser-like, so the host stores the format browsers will ask for. */
const IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'

const pool = async <T>(items: T[], size: number, run: (item: T) => Promise<void>) => {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) await run(queue.shift()!)
    }),
  )
}

const unescape = (s: string) => s.replace(/&amp;/g, '&')

/* ---------------- the pages ---------------- */

const sitemap = await fetch(`${origin}/sitemap.xml`).then((r) => (r.ok ? r.text() : ''))
const pages = new Set<string>([`${origin}/`])
for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  // The sitemap names the canonical address; warm the one given here.
  pages.add(`${origin}${new URL(unescape(loc!)).pathname}`)
}
console.log(`${pages.size} pages`)

/* ---------------- the photos on them ---------------- */

const images = new Set<string>()
await pool([...pages], 3, async (page) => {
  const res = await fetch(page).catch(() => null)
  if (!res?.ok) {
    console.log(`  page ${res?.status ?? 'failed'}  ${page}`)
    return
  }
  const html = await res.text()
  for (const [match] of html.matchAll(/\/_next\/image\?[^"'\s,]+/g)) {
    const url = new URL(unescape(match), origin)
    const w = Number(url.searchParams.get('w'))
    if (!widths || widths.has(w)) images.add(url.href)
  }
})
console.log(`${images.size} photo sizes to warm`)

/* ---------------- warm them ---------------- */

const outcome = new Map<number | string, number>()
let slowest = 0
let total = 0
const failed: string[] = []
await pool([...images], 6, async (url) => {
  const started = Date.now()
  const res = await fetch(url, { headers: { Accept: IMAGE_ACCEPT } }).catch(() => null)
  await res?.arrayBuffer().catch(() => undefined)
  const ms = Date.now() - started
  const status = res?.status ?? 'error'
  outcome.set(status, (outcome.get(status) ?? 0) + 1)
  slowest = Math.max(slowest, ms)
  total += ms
  if (status !== 200) failed.push(`${status}  ${decodeURIComponent(url)}`)
})

console.log(
  `\n${[...outcome].map(([s, n]) => `${s}: ${n}`).join(', ')} — ` +
    `average ${(total / Math.max(images.size, 1) / 1000).toFixed(1)} s, slowest ${(slowest / 1000).toFixed(1)} s`,
)
if (failed.length) {
  console.log('\nNot warmed (run again — a second try usually succeeds):')
  for (const line of failed.slice(0, 20)) console.log(`  ${line}`)
  process.exitCode = 1
}
