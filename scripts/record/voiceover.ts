/**
 * Writes a video's voiceover script from its timeline:
 *
 *   npx tsx scripts/record/voiceover.ts 04-handle-an-order ["opening line"] ["closing line"]
 *
 * One line per caption, with its start time and the time it has, so each
 * ElevenLabs clip (01.mp3, 02.mp3 …) can be laid at its start. The captions
 * are written to be spoken; the title and recap cards get the opening and
 * closing lines given here (they default to the card's title and "That's it.").
 * Lines longer than their slot at a calm pace (2.3 words a second) are flagged.
 */
import fs from 'node:fs'
import path from 'node:path'

import { OUT_ROOT } from './stage'

type Step = { caption: string; end: number; index: number; start: number }

const [name, opening, closing] = process.argv.slice(2)
if (!name) {
  console.error('usage: voiceover.ts <video-name> ["opening line"] ["closing line"]')
  process.exit(1)
}

const dir = path.join(OUT_ROOT, name)
const { steps, video } = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8')) as {
  steps: Step[]
  video: string
}

const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
/** Read aloud as written on screen, except symbols a voice would stumble on. */
const forVoice = (text: string) => text.replace(/⋯/g, 'three-dot').replace(/ & /g, ' and ')

const spoken = (step: Step, i: number) => {
  if (i === 0) return opening ?? forVoice(`${step.caption.split(': ').pop()}.`)
  if (i === steps.length - 1 && step.caption.startsWith('Remember')) return closing ?? 'That’s it.'
  return forVoice(step.caption)
}

const lines = steps.map((step, i) => {
  const text = spoken(step, i)
  const slot = step.end - step.start
  const tooLong = text.split(/\s+/).length / 2.3 > slot
  return { n: String(i + 1).padStart(2, '0'), slot, start: step.start, text, tooLong }
})

const length = steps.at(-1)?.end ?? 0
const md = `# Voiceover — ${name}

Video: \`${video}\` (${clock(length).replace(/\.\d$/, '')}). Each line starts at its time and must end
before the next line's start (about 2.3 words a second leaves room).

**In ElevenLabs:** one clip per line, \`01.mp3\` … \`${lines.at(-1)?.n}.mp3\`, the same voice and
settings for every video, into \`recordings/${name}/voice/\`.

| # | Starts | Time available | Line |
|---|---|---|---|
${lines.map((l) => `| ${l.n} | ${clock(l.start)} | ${l.slot.toFixed(1)} s | ${l.text}${l.tooLong ? ' ⚠ long' : ''} |`).join('\n')}

## Lines only (to paste one at a time)

\`\`\`
${lines.map((l) => `${l.n}  ${l.text}`).join('\n')}
\`\`\`
`

fs.writeFileSync(path.join(dir, 'voiceover-script.md'), md)
const long = lines.filter((l) => l.tooLong)
console.log(`wrote ${path.join(dir, 'voiceover-script.md')} — ${lines.length} lines${long.length ? `, ${long.length} may be long: ${long.map((l) => l.n).join(', ')}` : ''}`)
