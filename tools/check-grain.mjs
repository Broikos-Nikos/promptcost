/**
 * The claim on the front of this page is still true of the world.
 *
 *   npm run check:grain
 *
 * This is the gate the project exists to have, and it is an unusual one: it
 * does not fail when the code stops matching the data. It fails when **the data
 * stops supporting the headline**.
 *
 * The headline is three claims, and each is a statement about a document that
 * somebody edits every few ticks rather than about anything in this repository:
 *
 * 1. **A heatmap at section grain is flat.** If the contract grows a large JSON
 *    block, a table-heavy section or a code listing, it stops being flat, and
 *    the top of this page becomes a sentence about a document that no longer
 *    looks like that.
 * 2. **The same document at line grain is not flat.** If it ever is, the whole
 *    finding collapses into "prompts are uniform", which is a different project
 *    and one this page does not make the case for.
 * 3. **The instrument can show structure when structure is there.** This is the
 *    control, and it is the one a reader cannot check by eye: a map that is flat
 *    because the drawing is broken looks exactly like a map that is flat because
 *    the document is uniform. If pasting 1,579 characters of JSON stops moving
 *    the section band, the flat map above means nothing at all and must stop
 *    being published as a finding.
 *
 * Every threshold here sits well clear of the measured value, because a gate
 * tuned to the current number fails on noise and gets deleted. The measured
 * figures on 2026-09-25 were 1.18x, 1.73x and 1.29 times, against thresholds of
 * 1.35, 1.45 and 1.15.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const d = JSON.parse(readFileSync(resolve(root, 'src/generated/density.json'), 'utf8'))
const v = d.verdict

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

const FLAT_AT_MOST = 1.35
const LINE_AT_LEAST = 1.45
const CONTROL_AT_LEAST = 1.15

if (v.sectionBand > FLAT_AT_MOST) {
  fail(
    `the section grain now spans ${v.sectionBand}x and the page calls it flat`,
    `${v.sectionP5} to ${v.sectionP95} characters a token across the middle 90% of sections, against a ceiling of ${FLAT_AT_MOST}x.\n` +
      '      The prompt has changed shape. Rewrite the claim rather than keep making it.',
  )
} else {
  console.log(`  ok      section grain is still flat at ${v.sectionBand}x, ceiling ${FLAT_AT_MOST}x`)
}

if (v.lineBand < LINE_AT_LEAST) {
  fail(
    `the line grain now spans only ${v.lineBand}x, so there is no structure below the section`,
    `Floor ${LINE_AT_LEAST}x. Without this the finding is "prompts are uniform", which is not what this page argues.`,
  )
} else {
  console.log(`  ok      line grain still carries ${v.lineBand}x against a floor of ${LINE_AT_LEAST}x, ${v.grainGain} times the section band`)
}

if (v.control.sectionGain < CONTROL_AT_LEAST) {
  fail(
    `pasting JSON moves the section band by only ${v.control.sectionGain} times, so the instrument cannot be shown to work`,
    `${v.sectionBand}x becomes ${v.control.sectionBand}x, against a floor of ${CONTROL_AT_LEAST}.\n` +
      '      A flat map has two readings and this is the only one that rules out the broken instrument.',
  )
} else {
  console.log(
    `  ok      the control bites: ${v.control.addedChars} characters of JSON at ${v.control.pastedCharsPerToken} chars a token ` +
      `take the section band ${v.sectionBand}x to ${v.control.sectionBand}x, ${v.control.sectionGain} times`,
  )
}

/*
 * And the direction of the whole page. Low is expensive is stated everywhere,
 * so the pasted JSON has to be denser than the prose it was pasted into, not
 * merely different from it. If that inverts, every colour on the page is
 * backwards while all three numbers above still pass.
 */
const prose = d.documents[0].chars / d.documents[0].tokens
if (v.control.pastedCharsPerToken >= prose) {
  fail(
    `the pasted JSON runs at ${v.control.pastedCharsPerToken} characters a token and the prose it went into runs at ${prose.toFixed(2)}`,
    'The control is supposed to be the expensive thing. If it is the cheap thing, the ramp is the wrong way round.',
  )
} else {
  console.log(
    `  ok      the pasted JSON is denser than the prose it went into, ${v.control.pastedCharsPerToken} against ${prose.toFixed(2)} characters a token`,
  )
}

if (failed > 0) {
  console.error('\nThis gate fails when the world changes, not when the code does. That is what it is for.')
  process.exit(1)
}

console.log('grain: the claim on the front of the page is still true of the prompt it is about')
