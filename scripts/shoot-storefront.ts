import { chromium, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Screenshots storefront pages at desktop and phone sizes, for reviewing
 * layout without a visible browser.
 *
 *   npx tsx scripts/shoot-storefront.ts                 # the default set
 *   npx tsx scripts/shoot-storefront.ts /shop /faq      # just these
 *
 * Two shots per page and size:
 *   - `…-full.png`  the whole page, with reduced motion so content below the
 *                   fold is visible (scroll reveals would otherwise hide it)
 *   - `…-fold.png`  the first screen with motion on, after the intro animations
 *                   have finished — what a visitor actually sees on arrival
 */
const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const OUT = path.resolve('.screenshots/storefront')

const DEFAULT_PAGES = ['/', '/shop', '/products/al-shaheen-nights', '/find-order', '/checkout']

const SIZES = [
  { name: 'desktop', options: { viewport: { height: 900, width: 1440 } } },
  { name: 'phone', options: { ...devices['iPhone 13'] } },
] as const

const slug = (url: string) => url.replace(/^\/$/, 'home').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')

const run = async () => {
  const pages = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PAGES
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch()

  for (const size of SIZES) {
    for (const reducedMotion of ['reduce', 'no-preference'] as const) {
      const context = await browser.newContext({ ...size.options, reducedMotion })
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text().slice(0, 200))
      })

      for (const url of pages) {
        const response = await page.goto(`${BASE}${url}`, { timeout: 120_000, waitUntil: 'networkidle' })
        await page.waitForTimeout(reducedMotion === 'reduce' ? 1500 : 2600)

        const kind = reducedMotion === 'reduce' ? 'full' : 'fold'
        const file = path.join(OUT, `${slug(url)}-${size.name}-${kind}.png`)
        await page.screenshot({ fullPage: kind === 'full', path: file })
        console.log(`  ${response?.status()} ${size.name.padEnd(7)} ${kind}  ${url}  →  ${path.relative(process.cwd(), file)}`)
      }

      if (errors.length) console.log(`  errors (${size.name}, ${reducedMotion}):\n    ${[...new Set(errors)].join('\n    ')}`)
      await context.close()
    }
  }

  await browser.close()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
