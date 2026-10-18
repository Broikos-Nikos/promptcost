/**
 * The picture at the top of the README is a progression a reader can follow,
 * not a film they have to sit through.
 *
 *   npm run check:loop           # or against any GIF: node tools/check-loop.mjs path.gif
 *
 * `PGIF-F1`, filed at tick 151 against the recording that shipped: 8.76s across
 * 70 frames, and the finding's own sentence was "above the five and a half
 * `tokenlab` settled on".
 *
 * ## The number it was measured against was not this loop's number
 *
 * `tokenlab`'s 5.5s ceiling was derived for a loop with three beats: a calm
 * state, a red wall, the calm state again. There and back, and the whole claim
 * is the difference between two pictures. This one is a progression through
 * six holds: section grain, paragraph, line, back to section, the JSON control
 * pasted in, and the scroll to the region that goes dark. Those cannot share
 * 5.5s without several of them falling under the 0.9s floor `tokenlab` itself
 * set for a state anybody can read.
 *
 * So the ceiling was re-derived rather than inherited, which is the mistake
 * this workspace keeps naming: an expected value that is a property of
 * something other than its subject.
 *
 *     before   8.76s   70 frames
 *     after    6.63s   53 frames
 *
 * A quarter off, and it came out of the two holds that were doing nothing: the
 * opening flat map from 1.7s to 1.1s and the closing JSON state from 2.2s to
 * 1.1s. An intermediate retime put the paragraph state at 0.75s, and that is
 * why `BEAT_MIN` exists.
 *
 * ## What this reads, and what it refuses to read
 *
 * The holds come from `tools/choreography.mjs`, which `capture.mjs` performs,
 * and the duration and the freeze come from the GIF. That split is deliberate
 * and `choreography.mjs` has the measurements behind it: this recording never
 * stands still, its frame sizes are a continuous ramp with no gap to put a
 * threshold in, and two recordings of the identical choreography clustered
 * into different numbers of beats. Reading beats out of this file the way
 * `tokenlab` reads them out of its own gives a gate that answers differently
 * on the same input, which is worse than no gate.
 *
 * Four assertions:
 *
 *   every hold a reader stops at is between 0.9s and 2.5s
 *   the file's duration agrees with the choreography, so the GIF is the thing
 *     the script describes and not some older recording left in docs/
 *   the whole loop is between 5.5s and 7.0s
 *   no motionless stretch over 0.9s, which the file does answer honestly
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOLDS, TRANSITIONS, BEAT_MIN, BEAT_MAX, TOTAL_MIN, TOTAL_MAX, STILL_MAX } from './choreography.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const file = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'docs/grain.gif')

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

if (!existsSync(file)) {
  console.error(`FAIL  ${file} is missing, and the README leads with it`)
  process.exit(1)
}

/**
 * Walk the GIF's blocks. A frame is an image descriptor plus its data blocks,
 * and the graphic control extension before it carries the delay in hundredths
 * of a second. The walk is `tokenlab`'s, written there for RC-F6; what is done
 * with the result is not.
 */
function frames(buf) {
  let i = 13
  if (buf[10] & 0x80) i += 3 * (1 << ((buf[10] & 7) + 1))
  const out = []
  let delay = 0
  while (i < buf.length) {
    const block = buf[i]
    if (block === 0x21) {
      const label = buf[i + 1]
      i += 2
      if (label === 0xf9) delay = buf.readUInt16LE(i + 2)
      while (buf[i] !== 0) i += buf[i] + 1
      i++
    } else if (block === 0x2c) {
      const start = i
      const flags = buf[i + 9]
      i += 10
      if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1))
      i++
      while (buf[i] !== 0) i += buf[i] + 1
      i++
      out.push({ delayMs: delay * 10, bytes: i - start })
    } else if (block === 0x3b) {
      break
    } else {
      i++
    }
  }
  let at = 0
  return out.map((f) => {
    const frame = { at, ...f }
    at += f.delayMs
    return frame
  })
}

/* ---- the choreography, which is what a reader's eye gets ---- */

for (const [i, hold] of HOLDS.entries()) {
  if (TRANSITIONS.has(i)) continue
  if (hold.ms < BEAT_MIN) {
    fail(
      `${hold.name} is held ${(hold.ms / 1000).toFixed(2)}s`,
      `Under ${(BEAT_MIN / 1000).toFixed(1)}s a state is a flicker. tokenlab measured one at 0.67s that a recruiter pass could not describe afterwards.`,
    )
  }
  if (hold.ms > BEAT_MAX) {
    fail(
      `${hold.name} is held ${(hold.ms / 1000).toFixed(2)}s`,
      `Past ${(BEAT_MAX / 1000).toFixed(1)}s a held state reads as a page that has stopped working.`,
    )
  }
}

/* ---- the file ---- */

const all = frames(readFileSync(file))
if (all.length < 8) {
  fail(`${all.length} frames in ${file}, which is not a loop this gate can read`)
  process.exit(1)
}

const total = all.reduce((s, f) => s + f.delayMs, 0)
const scripted = HOLDS.reduce((s, h) => s + h.ms, 0)

/*
 * The GIF is longer than the sum of the holds: the clicks, the heatmap's
 * redraw and the smooth scroll all happen between them, and ffmpeg rounds
 * every frame to an eighth of a second. 1.6s is what that came to, measured,
 * and the tolerance is there to catch a stale recording rather than to police
 * the encoder.
 */
const SLACK = 1600
if (total < scripted || total > scripted + SLACK) {
  fail(
    `the GIF runs ${(total / 1000).toFixed(2)}s and the choreography asks for ${(scripted / 1000).toFixed(2)}s`,
    total < scripted
      ? 'A recording shorter than its own script is a recording that was cut short.'
      : `Transitions and the scroll add about ${(SLACK / 1000).toFixed(1)}s. More than that and docs/grain.gif is not this choreography: re-run npm run capture.`,
  )
}

if (total < TOTAL_MIN || total > TOTAL_MAX) {
  fail(
    `the loop runs ${(total / 1000).toFixed(2)}s and the window is ${(TOTAL_MIN / 1000).toFixed(1)}s to ${(TOTAL_MAX / 1000).toFixed(1)}s`,
    total > TOTAL_MAX
      ? 'A reader gives a README picture a few seconds. The version filed as PGIF-F1 ran 8.76s and most readers saw half the argument.'
      : 'Six holds under that means one of them is near the flicker floor. Shorter is not better here, it is thinner.',
  )
}

/* The freeze, which the file does answer honestly: a motionless frame
   compresses to a few hundred bytes against a redraw's forty thousand. */
const rest = all.slice(1)
const peak = Math.max(...rest.map((f) => f.bytes))
let longestStill = { ms: 0, at: 0 }
let runFrom = null
for (const f of [...rest, { at: total, delayMs: 0, bytes: peak }]) {
  if (f.bytes < peak * 0.05) {
    if (runFrom === null) runFrom = f.at
  } else if (runFrom !== null) {
    if (f.at - runFrom > longestStill.ms) longestStill = { ms: f.at - runFrom, at: runFrom }
    runFrom = null
  }
}

if (longestStill.ms > STILL_MAX) {
  fail(
    `nothing moves for ${(longestStill.ms / 1000).toFixed(2)}s, from ${(longestStill.at / 1000).toFixed(2)}s`,
    'A held photograph inside a loop reads as a page that has stopped. tokenlab RC-F6 was 1.49s of one.',
  )
}

const summary =
  `${(total / 1000).toFixed(2)}s, ${all.length} frames, ${HOLDS.length} holds ` +
  `(${HOLDS.map((h) => (h.ms / 1000).toFixed(2)).join(' ')}), longest still ${(longestStill.ms / 1000).toFixed(2)}s`

if (failed > 0) {
  console.error(`\n${summary}`)
  console.error(`\n${failed} thing${failed === 1 ? '' : 's'} wrong with the picture at the top of the README.`)
  process.exit(1)
}

console.log(`  ok      ${summary}`)
console.log('loop: the picture at the top is a progression a reader can follow, and it comes round again')
