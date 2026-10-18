/**
 * The picture at the top of the README is a progression a reader can follow,
 * not a film they have to sit through.
 *
 *   npm run check:loop           # or against any GIF: node tools/check-loop.mjs path.gif
 *
 * `PGIF-F1`, filed at tick 151 against the recording that shipped: 8.76s
 * across 70 frames, and the finding's own sentence was "above the five and a
 * half `tokenlab` settled on".
 *
 * ## The number it was measured against was not this loop's number
 *
 * `tokenlab`'s 5.5s ceiling was derived for a loop with three beats: a calm
 * state, a red wall, the calm state again. There and back, and the whole claim
 * is the difference between two pictures. This one is a progression through
 * six holds, and those cannot share 5.5s without several falling under the
 * 0.9s floor `tokenlab` itself set for a state anybody can read. The ceiling
 * was re-derived rather than inherited, which is the mistake this workspace
 * keeps naming: an expected value that is a property of something other than
 * its subject.
 *
 *     before   8.76s   70 frames
 *     after    6.00s   48 frames
 *
 * ## Two questions, and only one of them is a measurement
 *
 * The first version of this gate, at tick 234, said it asserted the holds.
 * It did not: it compared `HOLDS` in `choreography.mjs` against `BEAT_MIN` in
 * `choreography.mjs`, so no recording could ever turn it red. The audit of
 * that tick called it F1 and was right. It is a check on the script, it is
 * worth having, and it says so here instead of being dressed up.
 *
 *   **Is the script readable?** Every hold a reader stops at is between 0.9s
 *   and 2.5s, every hold is a whole number of frames so the script's number
 *   and the file's number are the same number, and the scripted total is
 *   inside the reader's ceiling. All three are statements about
 *   `choreography.mjs`, and editing that file is what makes them fail.
 *
 *   **Is the file that script's output?** The GIF's duration against the lead
 *   in plus the holds plus a measured overhead, to 0.5s. This is a real
 *   measurement, and it is only this tight because the recording is now
 *   trimmed at both ends: before tick 235 the encoder cut the start and
 *   nothing cut the end, so around 0.7s of the file was however long the
 *   browser took to close. A stale `docs/grain.gif` fails here, which is what
 *   the tick 234 version could not do.
 *
 * And the freeze, which a GIF answers honestly however it was made: a
 * motionless frame compresses to a few hundred bytes against a redraw's forty
 * thousand, so a held photograph is readable straight out of the file.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HOLDS,
  TRANSITIONS,
  FRAME_MS,
  BEAT_MIN,
  BEAT_MAX,
  LEAD_IN,
  OVERHEAD_MAX,
  TOTAL_MAX,
  STILL_MAX,
} from './choreography.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const file = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'docs/grain.gif')

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

/* ------------------------------------------------------------------ *
 * Is the script readable? Three statements about choreography.mjs.
 * ------------------------------------------------------------------ */

for (const [i, hold] of HOLDS.entries()) {
  if (hold.ms % FRAME_MS !== 0) {
    fail(
      `${hold.name} is held ${hold.ms}ms, which is ${(hold.ms / FRAME_MS).toFixed(1)} frames`,
      `At ${1000 / FRAME_MS} frames a second the file can only express multiples of ${FRAME_MS}ms, so this hold lands as ${Math.floor(hold.ms / FRAME_MS) * FRAME_MS} or ${Math.ceil(hold.ms / FRAME_MS) * FRAME_MS} depending on where it starts. A hold whose length the file rounds is a hold this gate cannot speak for.`,
    )
  }
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

const scripted = HOLDS.reduce((s, h) => s + h.ms, 0)
const longest = LEAD_IN + scripted + OVERHEAD_MAX

if (longest > TOTAL_MAX) {
  fail(
    `the choreography can run ${(longest / 1000).toFixed(2)}s and a reader's ceiling is ${(TOTAL_MAX / 1000).toFixed(1)}s`,
    'A reader gives a README picture a few seconds. The version filed as PGIF-F1 ran 8.76s and most of them saw half the argument.',
  )
}

/* ------------------------------------------------------------------ *
 * Is the file that script's output? One measurement, and the freeze.
 * ------------------------------------------------------------------ */

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

const all = frames(readFileSync(file))
if (all.length < 8) {
  fail(`${all.length} frames in ${file}, which is not a loop this gate can read`)
  process.exit(1)
}

const total = all.reduce((s, f) => s + f.delayMs, 0)
const floor = LEAD_IN + scripted

if (total < floor || total > floor + OVERHEAD_MAX) {
  fail(
    `the GIF runs ${(total / 1000).toFixed(2)}s and the script asks for ${(floor / 1000).toFixed(2)}s`,
    total < floor
      ? 'A recording shorter than its own script was cut short, or the holds were edited after it was made.'
      : `The clicks and the heatmap's redraw are the only things between the holds and capture.json measured them at 0.15s. More than ${(OVERHEAD_MAX / 1000).toFixed(1)}s over and docs/grain.gif is not this choreography: re-run npm run capture.`,
  )
}

/* The freeze. A motionless frame compresses to a few hundred bytes. */
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
  `${(total / 1000).toFixed(2)}s against a script of ${(floor / 1000).toFixed(2)}s, ${all.length} frames, ` +
  `holds ${HOLDS.map((h) => (h.ms / 1000).toFixed(2)).join(' ')}, longest still ${(longestStill.ms / 1000).toFixed(2)}s`

if (failed > 0) {
  console.error(`\n${summary}`)
  console.error(`\n${failed} thing${failed === 1 ? '' : 's'} wrong with the picture at the top of the README.`)
  process.exit(1)
}

console.log(`  ok      ${summary}`)
console.log('loop: the script is readable, the file is the script, and nothing in it stands still')
