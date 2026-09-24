/**
 * Every figure in the README is one the measurement produces.
 *
 *   npm run check:claims
 *
 * **Every claim is a phrase with its surrounding words, and every phrase is
 * counted rather than merely found.** A bare number is not a claim: a spec gate
 * in this workspace held one as the string "107", and its negative control
 * passed against a document edited to say 108, because the file said 107 three
 * more times in other sentences. A gate that cannot fail is worse than no gate,
 * because it is quoted as evidence.
 *
 * There is a second half, and it is the one that catches the numbers nobody
 * thought to assert. After checking that everything claimed is present, this
 * sweeps the README for figures **of the shapes this project deals in**, an `x`
 * spread, a dollar amount, a characters-a-token rate, and fails on any one the
 * measurement does not produce anywhere. That is how a hand typed number gets
 * caught: not by being wrong, but by being unaccounted for.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const d = JSON.parse(readFileSync(resolve(root, 'src/generated/density.json'), 'utf8'))
const readme = readFileSync(resolve(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n')
const flat = readme.replace(/\s+/g, ' ')

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

const v = d.verdict
const base = d.documents[0]
const num = (n) => n.toLocaleString('en-US')
const sec = base.grains.section.spread
const para = base.grains.paragraph.spread
const line = base.grains.line.spread

const CLAIMS = [
  ['the size of the prompt', `${num(base.chars)} characters and ${num(base.tokens)} tokens`],
  ['the section spread, in the standfirst', `span **${v.sectionBand}x** in cost per character`],
  ['the line spread, in the standfirst', `the same document spans **${v.lineBand}x**`],
  ['the section band, in prose', `run **${sec.p5} to ${sec.p95}** characters a token`],
  ['the section row', `| section | ${sec.regions} | ${sec.p5} to ${sec.p95} | ${sec.band}x |`],
  ['the paragraph row', `| paragraph | ${para.regions} | ${para.p5} to ${para.p95} | ${para.band}x |`],
  ['the line row', `| line | ${line.regions} | ${line.p5} to ${line.p95} | ${line.band}x |`],
  ['the cheapest line of prose', `buys ${v.cheapestLine.charsPerToken} characters per token`],
  ['the dearest line of prose', `the dearest buys ${v.dearestLine.charsPerToken}`],
  ['the range the first build reported', `got ${line.fullRange}x at line grain`],
  ['the band being unmoved by a floor', `changed the band from ${v.lineBand}x to ${v.lineBand}x`],
  ['the size of the pasted block', `${num(v.control.addedChars)} characters of JSON at **${v.control.pastedCharsPerToken}** characters a`],
  ['the rate of the prose it lands in', `against ${(base.chars / base.tokens).toFixed(2)} for the prose it lands in`],
  ['what the control does to the section grain', `take the section grain from ${v.sectionBand}x to **${v.control.sectionBand}x**`],
  ['the cadence', `re-read every ${d.cadence.minutesPerSend} minutes, which is ${d.cadence.sendsPerDay} sends a day`],
  ['the window', `over ${d.cadence.days} days`],
  ['the two monthly figures', `**$${v.dearest.perWindow} against $${v.cheapest.perWindow} for the identical tokens, a factor of ${v.modelSpread}.**`],
  ['the price check date', `checked ${d.inputs.pricing.checked}`],
  ['the hash of the prompt', `sha256 \`${d.inputs.contract.sha256.slice(0, 16)}\``],
  ['the line count the page gate reads', `all ${base.lines} lines`],
]

for (const m of [v.dearest, v.cheapest, ...v.costs.filter((c) => ['gpt-5.5', 'gpt-4o'].includes(c.id))]) {
  CLAIMS.push([`the price row for ${m.label}`, `| ${m.label} | $${m.inputPerMillion}/M | $${m.perSend} | `])
}

for (const [what, value] of CLAIMS) {
  const wanted = String(value).replace(/\s+/g, ' ')
  const times = flat.split(wanted).length - 1
  if (times === 0) fail(`${what}: the measurement says ${JSON.stringify(wanted)} and the README does not say it`)
}
if (failed === 0) console.log(`  ok      ${CLAIMS.length} figures in the README are what the measurement produces`)

/*
 * And the other direction: a figure of a shape this project produces, that the
 * measurement does not account for anywhere.
 */
const produced = new Set()
const add = (x) => produced.add(String(x))
for (const doc of d.documents) {
  add(doc.chars)
  add(num(doc.chars))
  add(doc.tokens)
  add(num(doc.tokens))
  add(doc.lines)
  for (const g of Object.values(doc.grains)) {
    for (const k of Object.values(g.spread)) add(k)
    for (const r of g.regions) {
      add(r.charsPerToken)
      add(r.chars)
      add(r.tokens)
    }
  }
}
for (const c of v.costs) {
  add(c.inputPerMillion)
  add(c.perSend)
  add(c.perDay)
  add(c.perWindow)
}
for (const k of [v.sectionBand, v.lineBand, v.grainGain, v.modelSpread, d.scale.low, d.scale.high, d.scale.clamped]) add(k)
for (const k of Object.values(v.control)) add(k)
for (const k of Object.values(d.cadence)) add(k)
add((base.chars / base.tokens).toFixed(2))
// The same prices in cents, so a README written either way is checkable.
for (const c of v.costs) {
  add(Number((c.perSend * 100).toFixed(2)))
  add(Number((c.perSend * 100).toFixed(1)))
}

/*
 * Figures that are not measurements and never could be: the year in a date, a
 * percentile this file names in prose, the MIT in a licence line. Each is
 * listed rather than pattern matched, so adding one is a decision somebody makes
 * on purpose.
 */
const NOT_MEASURED = new Set(['2026', '09', '20', '24', '25', '5', '95', '90', '100', '1', '2', '3', '4'])

const shapes = [
  [/\b(\d+(?:\.\d+)?)x\b/g, 'a spread'],
  [/\$(\d+(?:\.\d+)?)/g, 'a price'],
  [/\b(\d+(?:\.\d+)?) characters a token\b/g, 'a rate'],
  /*
   * Cents, because the first version of this sweep had three shapes and its own
   * control wrote "4.4 cents" into the README and passed all three. A price in
   * this project is as likely to be written in cents as in dollars, and the
   * shape that is missing is the shape a mistake takes.
   *
   * What this still cannot see is a figure spelled in English, "about three
   * cents", and that is said here rather than papered over: the README is
   * written so that any such phrase sits beside the digits it rounds, and the
   * digits are what is gated.
   */
  [/\b(\d+(?:\.\d+)?) cents?\b/g, 'a price in cents'],
]
let loose = 0
for (const [re, kind] of shapes) {
  for (const m of flat.matchAll(re)) {
    const figure = m[1]
    if (produced.has(figure) || NOT_MEASURED.has(figure)) continue
    loose++
    fail(`${kind} of ${figure} is in the README and the measurement produces no such figure`, `in: ${JSON.stringify(context(flat, m.index))}`)
  }
}
if (loose === 0) console.log('  ok      every spread, price and rate in the README is a figure the measurement produces')

function context(text, at) {
  return text.slice(Math.max(0, at - 50), at + 50)
}

if (failed > 0) {
  console.error('\nA number in prose that no command produces is the one thing this repository promises it does not have.')
  process.exit(1)
}

console.log('claims: every figure in the README comes out of the committed measurement')
