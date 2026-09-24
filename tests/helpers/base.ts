/**
 * Where the end-to-end suite points. Defaults to the project's usual dev port;
 * set `E2E_BASE_URL` when the dev server runs elsewhere (this machine runs it
 * on 3001 — see .claude/launch.json).
 */
export const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'
