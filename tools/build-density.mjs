/**
 * Measure the committed prompts and write `src/generated/density.json`.
 *
 *   npm run build:density
 *
 * The page never tokenises anything at runtime. It reads this file, which is
 * produced here from two inputs committed in `data/` and hashed into the
 * output, and `npm run check:density` recomputes every figure from those same
 * files and refuses any disagreement.
 *
 * ## Why the prompt is committed rather than read where it lives
 *
 * `BUILD-PROMPT.md` is the contract this workspace's build loop re-reads every
 * thirty minutes, and it is edited every few ticks. An earlier project in this
 * workspace measured a live file and published counts that were wrong nineteen
 * minutes later. So `data/contract.md` is a frozen copy, its hash is in the
 * output, and the gate holds one to the other. The page quotes a document that
 * exists rather than one that has moved on.
 *
 * ## The second document is generated, not written
 *
 * A heatmap that shows nothing on a uniform document has two possible readings:
 * the document is uniform, or the instrument is broken. They are impossible to
 * tell apart from one picture, and the first is only a finding once the second
 * is ruled out.
 *
 * So the second document is the first with this repository's own price table
 * pasted into it as a fenced JSON block, composed here from the two inputs
 * rather than hand written, so it needs no third hash and cannot drift from
 * either. It is the control made visible to the reader: the same instrument,
 * the same scale, one region going dark. If it ever stops going dark, the flat
 * map on the first document stops meaning anything.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encode } from 'gpt-tokenizer/encoding/o200k_base'
import { GRAINS, cost, regions, spread } from '../src/lib/density.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(resolve(root, rel))
/**
 * The hash of the **text**, not of the bytes on this disk.
 *
 * Hashing `readFileSync()` straight was wrong and provably so. Git stores text
 * with LF and checks it out with CRLF wherever `core.autocrlf` is on, which is
 * the default on Windows, so the same committed file has two different sha256
 * values depending on who cloned it. Measured on this repository's own input:
 * `data/contract.md` hashes `1ba90de0cc3cd6d4` on the machine it was written on
 * and `819fde8663378c9e` in a fresh clone, because the working copy carries 293
 * CRLF pairs and the blob carries none.
 *
 * That is not a nuisance, it is a gate that fails everywhere except the one
 * machine that wrote it, which is the exact opposite of what a provenance hash
 * is for. Normalising the line endings first makes the value a property of the
 * document rather than of the checkout.
 */
const sha = (buf) => createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex')

/** The cadence the contract sets for itself, and the window to price over. */
export const CADENCE = { minutesPerSend: 30, sendsPerDay: 48, days: 30 }

const contractBytes = read('data/contract.md')
const pricingBytes = read('data/pricing.json')
const contract = contractBytes.toString('utf8').replace(/\r\n/g, '\n')
const pricing = JSON.parse(pricingBytes.toString('utf8'))

/**
 * The control document: the same prompt with a real JSON blob pasted in, the
 * way a retrieved record or a tool schema arrives in a real system prompt.
 */
const pasted = [
  contract.trimEnd(),
  '',
  '## 10. The price table this run is costed against',
  '',
  'Pasted in whole, the way a tool schema or a retrieved record arrives.',
  '',
  '```json',
  pricingBytes.toString('utf8').replace(/\r\n/g, '\n').trimEnd(),
  '```',
  '',
].join('\n')

const DOCS = [
  {
    id: 'contract',
    title: 'The build contract',
    button: 'the prompt',
    note: 'The prompt that built this repository, re-read every 30 minutes. Frozen and hashed.',
    text: contract,
  },
  {
    id: 'contract-json',
    title: 'The same prompt, with a price table pasted in',
    button: 'with JSON pasted in',
    note: 'The control. Composed from the two committed inputs, so the instrument can be seen to work.',
    text: pasted,
  },
]

/**
 * Which document the page opens on, by id.
 *
 * The page had `data.documents[0].id`, and the button under it read "the
 * prompt" for whatever sat at index 0 and "with JSON pasted in" for everything
 * else. Both are answers to "which one is the interesting one" written as a
 * position in this array, so adding a third document here would have opened the
 * page on it and labelled the control wrongly, with nothing to notice. The
 * label is a field on the document now, and this is the choice, named.
 *
 * tokenlab MA-F8 is the same shape one project over, and its version reached a
 * published page: the bill opened on `pricing.models[1]`.
 */
const OPENS_ON = 'contract'

/** The one that is meant to go dark, and the reason a flat map means anything. */
const CONTROL = 'contract-json'

const measured = DOCS.map((doc) => {
  const grains = {}
  for (const g of GRAINS) {
    const rs = regions(doc.text, g, encode)
    grains[g] = { regions: rs, spread: spread(rs) }
  }
  return {
    id: doc.id,
    title: doc.title,
    button: doc.button,
    note: doc.note,
    lines: doc.text.split('\n').length,
    chars: doc.text.length,
    tokens: encode(doc.text).length,
    text: doc.text,
    grains,
  }
})

/*
 * One scale for every grain and both documents, so the bunching at section
 * grain is visible against a ramp that does not move. Recomputing it per view
 * would normalise every grain to the same spread of colour and erase the only
 * thing this page is trying to show.
 *
 * Its ends are the 5th and 95th percentile of every line in both documents, not
 * the minimum and maximum. Taking the extremes put the cold end of the ramp at
 * 1.0, which is a line containing one `{`, and spent most of the colour on rates
 * no paragraph of prose can ever reach. `heat()` clamps, so the handful of lines
 * outside saturate rather than being lost.
 */
const allLineRates = measured.flatMap((m) => m.grains.line.regions.map((r) => r.charsPerToken)).sort((a, b) => a - b)
const pct = (f) => allLineRates[Math.floor(f * (allLineRates.length - 1))]
const scale = {
  low: Math.floor(pct(0.05) * 10) / 10,
  high: Math.ceil(pct(0.95) * 10) / 10,
  clamped: allLineRates.filter((v) => v < pct(0.05) || v > pct(0.95)).length,
}

/*
 * Both by id, for the reason above: these two lines are what `opensOn` and the
 * control are measured from, and `measured[0]` would have followed a reordering
 * of DOCS without a word.
 */
const base = measured.find((m) => m.id === OPENS_ON)
const control = measured.find((m) => m.id === CONTROL)
const readable = base.grains.line.regions.filter((r) => r.chars >= 20)
const costs = pricing.models.map((m) => ({
  id: m.id,
  label: m.label,
  inputPerMillion: m.inputPerMillion,
  ...cost(base.tokens, m.inputPerMillion, CADENCE),
}))
const dearest = costs.reduce((a, b) => (b.perWindow > a.perWindow ? b : a))
const cheapest = costs.reduce((a, b) => (b.perWindow < a.perWindow ? b : a))

const out = {
  measured: new Date().toISOString().slice(0, 10),
  encoding: 'o200k_base',
  inputs: {
    contract: { file: 'data/contract.md', sha256: sha(contractBytes) },
    pricing: { file: 'data/pricing.json', sha256: sha(pricingBytes), checked: pricing.checked, source: pricing.source },
  },
  cadence: CADENCE,
  scale,
  opensOn: OPENS_ON,
  documents: measured,
  /*
   * The headline, as numbers a gate can hold: the grain everybody draws a
   * heatmap at, against the grain the structure is actually at, against the
   * same instrument on a document that has something to show.
   */
  verdict: {
    sectionBand: base.grains.section.spread.band,
    sectionP5: base.grains.section.spread.p5,
    sectionP95: base.grains.section.spread.p95,
    lineBand: base.grains.line.spread.band,
    lineP5: base.grains.line.spread.p5,
    lineP95: base.grains.line.spread.p95,
    grainGain: Number((base.grains.line.spread.band / base.grains.section.spread.band).toFixed(2)),
    /*
     * The control, as a number rather than as a picture. A flat map has two
     * readings, a uniform document and a blind instrument, and only the second
     * can be ruled out. These are the same grains on the same scale after one
     * JSON table is pasted in.
     */
    control: {
      sectionBand: control.grains.section.spread.band,
      lineBand: control.grains.line.spread.band,
      sectionGain: Number((control.grains.section.spread.band / base.grains.section.spread.band).toFixed(2)),
      addedTokens: control.tokens - base.tokens,
      addedChars: control.chars - base.chars,
      pastedCharsPerToken: Number(((control.chars - base.chars) / (control.tokens - base.tokens)).toFixed(2)),
    },
    /*
     * The cheapest and dearest line of prose, which is what the map is read for.
     * Regions below 20 characters are excluded here and only here: a rate over
     * four tokens is a rounding artefact, and naming `|---|---|---|---|` as the
     * most expensive thing in a prompt is a claim about markdown. The band above
     * is computed over every line, so nothing is being hidden from the statistic.
     */
    cheapestLine: readable.reduce((a, b) => (b.charsPerToken < a.charsPerToken ? b : a)),
    dearestLine: readable.reduce((a, b) => (b.charsPerToken > a.charsPerToken ? b : a)),
    costs,
    dearest,
    cheapest,
    modelSpread: Math.round(dearest.perWindow / cheapest.perWindow),
  },
}

writeFileSync(resolve(root, 'src/generated/density.json'), JSON.stringify(out, null, 2) + String.fromCharCode(10))

const v = out.verdict
console.log(`${base.title}: ${base.chars} characters, ${base.tokens} tokens, ${base.lines} lines`)
console.log()
for (const doc of measured) {
  console.log(`  ${doc.id}`)
  console.log('    grain        regions     p5  median     p95    band   full   outside')
  for (const g of GRAINS) {
    const s = doc.grains[g].spread
    console.log(
      `    ${g.padEnd(12)} ${String(s.regions).padStart(6)} ${String(s.p5).padStart(6)} ${String(s.median).padStart(7)} ` +
        `${String(s.p95).padStart(7)} ${String(s.band + 'x').padStart(7)} ${String(s.fullRange + 'x').padStart(6)} ${String(s.outside).padStart(9)}`,
    )
  }
}
console.log()
console.log(`section grain spans ${v.sectionBand}x, line grain spans ${v.lineBand}x: ${v.grainGain} times the band, same document`)
console.log(`  cheapest line of prose ${v.cheapestLine.charsPerToken}  ${JSON.stringify(v.cheapestLine.label)}`)
console.log(`  dearest line of prose  ${v.dearestLine.charsPerToken}  ${JSON.stringify(v.dearestLine.label)}`)
console.log()
console.log(
  `the control: pasting ${v.control.addedChars} characters of JSON, ${v.control.pastedCharsPerToken} chars a token, ` +
    `takes the section band from ${v.sectionBand}x to ${v.control.sectionBand}x, ${v.control.sectionGain} times`,
)
console.log(`scale ${scale.low} to ${scale.high} characters a token, fixed across both documents and all three grains, ${scale.clamped} lines clamped`)
console.log(`cadence: $${dearest.perWindow} on ${dearest.label} against $${cheapest.perWindow} on ${cheapest.label} over ${CADENCE.days} days, ${out.verdict.modelSpread}x for the identical tokens`)
