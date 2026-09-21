import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Screenshots a single admin screen, optionally after clicking a tab.
 * Useful when chasing one layout problem.
 *
 *   pnpm shoot:one "/admin/collections/products/1" "Price & sizes" price-tab
 */
const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const OUT = path.resolve('.screenshots')

const [, , url, tabText, name] = process.argv

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { height: 1000, width: 1600 } })

  await page.goto(`${BASE}/admin/login`, { timeout: 120_000, waitUntil: 'networkidle' })
  await page.fill('#field-email', 'dev@plumpose.local')
  await page.fill('#field-password', 'devpassword')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 120_000 })

  await page.goto(`${BASE}${url}`, { timeout: 120_000, waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  if (tabText) {
    await page.getByRole('button', { name: tabText }).first().click()
    await page.waitForTimeout(1200)
  }

  const file = path.join(OUT, `${name || 'one'}.png`)
  await page.screenshot({ fullPage: true, path: file })
  console.log(`  saved ${file}`)

  await browser.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
