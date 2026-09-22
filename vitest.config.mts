import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    /**
     * Run test files one at a time.
     *
     * Every database-backed spec boots its own Payload instance, and Payload
     * in dev pushes the schema on init. Run in parallel they race on the same
     * database and Postgres fails with 42704 (`ATExecDropConstraint` — the
     * constraint one worker is dropping has already been dropped by another).
     * The specs themselves are independent; it is the schema push that cannot
     * be concurrent.
     */
    fileParallelism: false,
  },
})
