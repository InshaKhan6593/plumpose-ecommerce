import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 1,
  /**
   * One worker, everywhere — not just on CI.
   *
   * These specs share one database and one seeded product, so running them in
   * parallel makes them fight over it. With the default 5 workers, `decrements
   * stock by the quantity ordered` read stock, bought two, and found three
   * gone because another worker had bought one in between. The integration
   * suite guards the same hazard with `fileParallelism: false`.
   *
   * If this becomes too slow, the fix is a database per worker, not more
   * workers.
   */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  /**
   * Reuses a running dev server. Point the suite elsewhere with E2E_BASE_URL
   * (this machine runs dev on 3001 — see tests/helpers/base.ts).
   */
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: true,
    url: process.env.E2E_BASE_URL || 'http://localhost:3000',
  },
})
