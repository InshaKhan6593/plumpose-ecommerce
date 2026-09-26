/**
 * Once a day, asks the site to refresh its exchange rates (REQUIREMENTS A14;
 * the endpoint is src/endpoints/refreshRates.ts). Hand-set prices never move;
 * this only updates the "at today's rate" comparison in the admin.
 *
 * A Netlify scheduled function: runs on the published production deploy
 * only. Needs CRON_SECRET, the same value the site checks.
 */
export default async (): Promise<void> => {
  const site = process.env.URL
  const secret = process.env.CRON_SECRET
  if (!site || !secret) {
    console.error('refresh-rates: URL or CRON_SECRET is not set; nothing refreshed.')
    return
  }
  const res = await fetch(`${site}/api/currencies/refresh-rates`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  const body = await res.text()
  console.log(`refresh-rates: ${res.status} ${body.slice(0, 300)}`)
}

export const config = { schedule: '@daily' }
