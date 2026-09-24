/**
 * Every region in the committed measurement is one the inputs still produce.
 *
 *   npm run check:density
 *
 * The page reads `src/generated/density.json` and tokenises nothing, which is
 * what keeps a 2 MB vocabulary out of `dist/`. The cost of that is a committed
 * artefact, and a committed artefact is a claim about files that may have moved
 * since. So this recomputes the whole thing from `data/` with the real encoder
 * and refuses any disagreement, region by region rather than in aggregate.
 *
 * **Region by region matters.** An earlier gate in this workspace compared two
 * rounded aggregates and called them identical; two different documents can
 * average to the same rate while no two of their regions agree. The totals
 * would have passed here with the tint of every line wrong.
 *
 * The second document is not read from disk at all. It is composed by the
 * builder from the two inputs, so this recomposes it the same way and checks
 * the composition too: a control document that quietly stopped containing JSON
 * would leave a control that cannot fail, which this workspace has now shipped
 * enough times to gate for by reflex.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encode } from 'gpt-tokenizer/encoding/o200k_base'
import { GRAINS, cost, regions, spread } from '../src/lib/density.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(resolve(root, rel))

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

const d = JSON.parse(readFileSync(resolve(root, 'src/generated/density.json'), 'utf8'))

/* 1. Both inputs are the files these figures were computed from. */
for (const [key, label] of [
  ['contract', 'the prompt'],
  ['pricing', 'the price table'],
]) {
  const recorded = d.inputs[key]
  /*
   * Normalised before hashing, for the reason in `build-density.mjs`: git
   * checks the same committed text out with CRLF on Windows and LF elsewhere,
   * so the raw bytes gave this gate a value that only held on the machine that
   * wrote it. `data/contract.md` hashed `1ba90de0cc3cd6d4` here and
   * `819fde8663378c9e` in a clone, and the first push would have failed CI.
   */
  const now = createHash('sha256').update(read(recorded.file).toString('utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex')
  if (now !== recorded.sha256) {
    fail(
      `${label} is not the file the measurement was taken from`,
      `${recorded.file}: recorded ${recorded.sha256.slice(0, 16)}, on disk ${now.slice(0, 16)}\n` +
        '      Re-run npm run build:density and update every number that moved.',
    )
  } else {
    console.log(`  ok      ${label} is the file measured, ${recorded.file} sha256 ${now.slice(0, 16)}`)
  }
}

/* 2. Every region, recomputed. */
const contract = read('data/contract.md').toString('utf8').replace(/\r\n/g, '\n')
const pricingText = read('data/pricing.json').toString('utf8').replace(/\r\n/g, '\n')
const pricing = JSON.parse(pricingText)

const rebuilt = {
  contract,
  'contract-json': [
    contract.trimEnd(),
    '',
    '## 10. The price table this run is costed against',
    '',
    'Pasted in whole, the way a tool schema or a retrieved record arrives.',
    '',
    '```json',
    pricingText.trimEnd(),
    '```',
    '',
  ].join('\n'),
}

let regionsChecked = 0
for (const doc of d.documents) {
  const text = rebuilt[doc.id]
  if (text === undefined) {
    fail(`the measurement carries a document called ${JSON.stringify(doc.id)} that this gate cannot rebuild`)
    continue
  }
  if (text !== doc.text) {
    fail(
      `the committed text of ${doc.id} is not what the inputs produce`,
      `committed ${doc.text.length} characters, rebuilt ${text.length}`,
    )
    continue
  }
  if (encode(text).length !== doc.tokens) {
    fail(`${doc.id}: committed ${doc.tokens} tokens, the encoder says ${encode(text).length}`)
  }

  for (const g of GRAINS) {
    const mine = regions(text, g, encode)
    const theirs = doc.grains[g].regions
    if (mine.length !== theirs.length) {
      fail(`${doc.id} at ${g} grain: committed ${theirs.length} regions, recomputed ${mine.length}`)
      continue
    }
    for (let i = 0; i < mine.length; i++) {
      const a = mine[i]
      const b = theirs[i]
      for (const k of ['from', 'to', 'chars', 'tokens', 'charsPerToken']) {
        if (a[k] !== b[k]) {
          fail(
            `${doc.id} at ${g} grain, region ${i} (${JSON.stringify(b.label)}): ${k} is ${b[k]} and recomputes to ${a[k]}`,
            'The page tints from the committed value, so this is a line drawn in the wrong colour.',
          )
          i = mine.length
          break
        }
      }
      regionsChecked++
    }
    const s = spread(mine)
    for (const k of Object.keys(s)) {
      if (s[k] !== doc.grains[g].spread[k]) {
        fail(`${doc.id} at ${g} grain: spread.${k} is ${doc.grains[g].spread[k]} and recomputes to ${s[k]}`)
      }
    }
  }
}
if (failed === 0) console.log(`  ok      ${regionsChecked} regions across ${d.documents.length} documents and ${GRAINS.length} grains recompute exactly`)

/* 3. The control document actually contains the thing it is a control for. */
const control = d.documents.find((x) => x.id === 'contract-json')
if (!control) {
  fail('there is no control document', 'A flat map with no control is a picture with two readings and no way to choose.')
} else if (!control.text.includes('```json') || !control.text.includes('"inputPerMillion"')) {
  fail('the control document contains no JSON block', 'A control that cannot light up is worse than no control.')
} else {
  const added = control.tokens - d.documents[0].tokens
  console.log(`  ok      the control carries a real JSON block, ${added} tokens of it`)
}

/* 4. Every price, from the committed table through the one cost function. */
for (const m of d.verdict.costs) {
  const model = pricing.models.find((x) => x.id === m.id)
  if (!model) {
    fail(`the measurement prices a model ${JSON.stringify(m.id)} that is not in the committed table`)
    continue
  }
  if (model.inputPerMillion !== m.inputPerMillion) {
    fail(`${m.id}: the measurement says $${m.inputPerMillion}/M and the table says $${model.inputPerMillion}/M`)
    continue
  }
  const mine = cost(d.documents[0].tokens, model.inputPerMillion, d.cadence)
  for (const k of ['perSend', 'perDay', 'perWindow']) {
    if (mine[k] !== m[k]) fail(`${m.id}: ${k} is ${m[k]} and recomputes to ${mine[k]}`)
  }
}
if (failed === 0) console.log(`  ok      ${d.verdict.costs.length} models priced from the committed table through one cost function`)

if (failed > 0) {
  console.error('\nThe page draws the committed file. A committed file nothing recomputes is a number typed by hand with extra steps.')
  process.exit(1)
}

console.log('density: every region, spread and price recomputes from the hashed inputs')
