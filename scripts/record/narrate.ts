/**
 * Makes a tutorial's voice before it is recorded: every `say('…')` caption and
 * every card's spoken line in videos/<video>.ts, one ElevenLabs clip each,
 * into ../recordings/<video>/voice/. Lines already made are skipped, so only
 * new or changed words are billed.
 *
 *   npx tsx scripts/record/narrate.ts 04-handle-an-order          # make them
 *   npx tsx scripts/record/narrate.ts 04-handle-an-order --dry    # count only
 *
 * Captions must be plain string literals for this to find them (no template
 * strings or joins) — the recorder makes any it missed mid-take, as a pause.
 */
import fs from 'node:fs'
import path from 'node:path'

import { OUT_ROOT } from './stage'
import { spoken, Voice } from './voice'

const [name, flag] = process.argv.slice(2)
if (!name) {
  console.error('usage: narrate.ts <video-name> [--dry]')
  process.exit(1)
}

const source = fs.readFileSync(path.resolve('scripts/record/videos', `${name}.ts`), 'utf8')
const literal = `(['"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`
const unquote = (s: string) => s.replace(/\\(.)/g, '$1')
const lines = [
  ...[...source.matchAll(new RegExp(`\\.say\\(\\s*${literal}`, 'g'))].map((m) => unquote(m[2])),
  ...[...source.matchAll(new RegExp(`speak:\\s*${literal}`, 'g'))].map((m) => unquote(m[2])),
]
const unique = [...new Set(lines)]

const voice = new Voice(path.join(OUT_ROOT, name))
const todo = unique.filter((l) => !voice.cached(l))
const chars = todo.reduce((n, l) => n + spoken(l).length, 0)
console.log(`${unique.length} lines, ${todo.length} to make (${chars} characters)`)

if (flag !== '--dry') {
  for (const [i, line] of todo.entries()) {
    const clip = await voice.clip(line)
    console.log(`${String(i + 1).padStart(2)}/${todo.length}  ${clip.duration.toFixed(1)}s  ${line}`)
  }
  console.log(`voice ready in ${voice.dir}`)
}
