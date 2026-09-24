/**
 * What a visitor actually sees, held to the committed measurement.
 *
 *   npm run check:page          (or npm run verify, which starts the server)
 *
 * Every other gate in this project reads files. This one reads the rendered
 * page, because the defect this project most plausibly ships with is invisible
 * to all of them: **a map whose colours do not come from the data**.
 *
 * Every figure could be right, every region could recompute, and the tint could
 * still be a constant, a hash of the line number, or a ramp applied in the
 * wrong direction. The page would look like a heatmap, the build would pass,
 * and the whole claim would rest on a picture that means nothing. `tokenlab`
 * shipped the same shape once: nothing anywhere asserted that a single
 * fractured chip was ever drawn, so the entire visual payload could have
 * vanished silently.
 *
 * So the middle of this file reads the computed background colour of every
 * painted line and checks three things about it: that it varies, that it is
 * ordered by the rate, and that it is the exact colour the library's own `heat`
 * says it should be. The first two would catch a constant and an inverted ramp.
 * The third catches everything else.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { serve, useShared } from './serve.mjs'
import { cost, heat, rateByLine } from '../src/lib/density.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const d = JSON.parse(readFileSync(resolve(root, 'src/generated/density.json'), 'utf8'))

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}
const ok = (what) => console.log(`  ok      ${what}`)
const is = (what, got, want) => {
  if (String(got) === String(want)) ok(`${what}: ${got}`)
  else fail(what, `the page says ${JSON.stringify(String(got))}, the measurement says ${JSON.stringify(String(want))}`)
}

const server = process.env.PROMPTCOST_URL ? await useShared(process.env.PROMPTCOST_URL) : await serve()
const browser = await chromium.launch()

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(server.url, { waitUntil: 'networkidle' })

  /* 1. The three figures a ten second reader takes away. */
  const v = d.verdict
  is('the section grain figure', await page.textContent('#kpi-section'), `${v.sectionBand}x`)
  is('the line grain figure', await page.textContent('#kpi-line'), `${v.lineBand}x`)
  is('the model spread figure', await page.textContent('#kpi-spread'), `${v.modelSpread}x`)

  /* 2. The bill at the dials the page opens on. */
  const opening = cost(d.documents[0].tokens, v.dearest.inputPerMillion, d.cadence)
  is('the opening bill', await page.textContent('#bill'), `$${opening.perWindow.toFixed(2)}`)

  /*
   * 3. The map itself, at every grain of every document.
   *
   * This is the gate. `expected` is computed here from the committed regions
   * through the same `heat()` the page calls, so a page that paints from
   * anything else, or paints nothing, disagrees immediately.
   */
  for (const doc of d.documents) {
    await page.click(`#doc .seg-btn[data-value="${doc.id}"]`)
    for (const grain of ['section', 'paragraph', 'line']) {
      await page.click(`#grain .seg-btn[data-value="${grain}"]`)
      const spread = doc.grains[grain].spread

      const readout = (await page.textContent('#readout')) ?? ''
      const wanted = `${spread.regions} regions`
      if (!readout.includes(wanted) || !readout.includes(`${spread.band}x`)) {
        fail(
          `${doc.id} at ${grain} grain: the readout does not carry the committed spread`,
          `wanted ${JSON.stringify(wanted)} and ${spread.band}x, page said ${JSON.stringify(readout.slice(0, 140))}`,
        )
        continue
      }

      const painted = await page.$$eval('#paper .row', (rows) =>
        rows.map((r) => ({ bg: getComputedStyle(r).backgroundColor, empty: r.classList.contains('row--empty') })),
      )

      if (painted.length !== doc.lines) {
        fail(`${doc.id} at ${grain} grain: the page drew ${painted.length} lines and the document has ${doc.lines}`)
        continue
      }

      const rates = rateByLine(doc.grains[grain].regions, doc.lines)
      const distinct = new Set(painted.filter((p) => !p.empty).map((p) => p.bg))
      if (distinct.size < 2) {
        fail(
          `${doc.id} at ${grain} grain: every painted line is the same colour, ${[...distinct][0]}`,
          'A map with one colour is not drawn from the data, whatever the numbers beside it say.',
        )
        continue
      }

      /*
       * Ordered by rate, in the right direction. A ramp applied backwards keeps
       * every number on the page correct and inverts the entire finding.
       */
      const byRate = painted
        .map((p, i) => ({ ...p, rate: rates[i] }))
        .filter((p) => !p.empty && p.rate > 0)
        .map((p) => ({ ...p, alpha: alphaOf(p.bg) }))
      const cheapest = byRate.reduce((a, b) => (b.rate > a.rate ? b : a))
      const dearest = byRate.reduce((a, b) => (b.rate < a.rate ? b : a))
      if (!(dearest.alpha > cheapest.alpha)) {
        fail(
          `${doc.id} at ${grain} grain: the dearest line is not painted more strongly than the cheapest`,
          `dearest ${dearest.rate} chars/token at ${dearest.alpha.toFixed(3)}, cheapest ${cheapest.rate} at ${cheapest.alpha.toFixed(3)}.\n` +
            '      The ramp is inverted, and every number on the page stays correct while it is.',
        )
        continue
      }

      /* And the exact value, line by line, through the library the page uses. */
      let wrong = 0
      let firstWrong = null
      painted.forEach((p, i) => {
        const want = rates[i] > 0 ? heat(rates[i], d.scale) : null
        if (want === null) return
        const got = alphaOf(p.bg)
        const wantAlpha = 0.16 + 0.74 * want
        if (Math.abs(got - wantAlpha) > 0.012) {
          wrong++
          if (!firstWrong) firstWrong = `line ${i + 1}, rate ${rates[i]}, wanted ${wantAlpha.toFixed(3)} and got ${got.toFixed(3)}`
        }
      })
      if (wrong > 0) fail(`${doc.id} at ${grain} grain: ${wrong} lines painted at the wrong strength`, firstWrong)
      else ok(`${doc.id} at ${grain} grain: ${painted.length} lines, ${distinct.size} distinct colours, every one from the committed rate`)
    }
  }

  /*
   * 4. The control, seen rather than computed. Pasting JSON has to visibly
   * widen the section grain, which is the claim the picture rests on.
   */
  await page.click(`#doc .seg-btn[data-value="contract"]`)
  await page.click('#grain .seg-btn[data-value="section"]')
  const flatColours = await page.$$eval('#paper .row', (rows) => new Set(rows.map((r) => getComputedStyle(r).backgroundColor)).size)
  await page.click(`#doc .seg-btn[data-value="contract-json"]`)
  const controlColours = await page.$$eval('#paper .row', (rows) => new Set(rows.map((r) => getComputedStyle(r).backgroundColor)).size)
  if (controlColours <= flatColours) {
    fail(
      'pasting the JSON block does not add a colour to the section map',
      `${flatColours} distinct colours before, ${controlColours} after. The control is the only thing ruling out a broken instrument.`,
    )
  } else {
    ok(`the control adds colour to the section map, ${flatColours} distinct colours becoming ${controlColours}`)
  }

  await page.close()

  /* 5. The phone. A map is useless at a width that scrolls sideways. */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await phone.goto(server.url, { waitUntil: 'networkidle' })
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0) fail(`the page scrolls sideways by ${overflow}px at 390`, 'Every phone reader meets this before they meet the finding.')
  else ok('no horizontal overflow at 390')

  const legend = await phone.$eval('.ramp', (n) => n.getBoundingClientRect().width)
  if (legend < 120) fail(`the colour ramp is ${Math.round(legend)}px wide at 390`, 'It is the only thing on the page that says what the colour means.')
  else ok(`the colour ramp is ${Math.round(legend)}px wide at 390`)
  await phone.close()
} finally {
  await browser.close()
  server.stop()
}

/**
 * The alpha a painted row resolves to.
 *
 * **This function threw away the whole gate once and nearly passed while doing
 * it.** The first version matched `rgba(...)` only and returned 0 for anything
 * else. Chromium resolves `color-mix(in srgb, ... , transparent)` to
 * `color(srgb 0.8 0.55 0.3 / 0.66)`, so every line came back as 0, and the
 * ordering assertion then compared 0 against 0. It failed, which is the only
 * reason this was found: had the fallback been 1 instead of 0, every assertion
 * below would have compared 1 against 1 and reported the map correct without
 * ever having read a colour.
 *
 * So there is no fallback. A format this cannot parse is a measurement that did
 * not happen, and it says so rather than returning a number.
 */
function alphaOf(bg) {
  const s = String(bg)
  const mix = s.match(/^color\(srgb\s+[\d.eE+-]+\s+[\d.eE+-]+\s+[\d.eE+-]+\s*\/\s*([\d.eE+-]+)\s*\)$/)
  if (mix) return Number(mix[1])
  const rgb = s.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) {
    const parts = rgb[1].split(/[,/]/).map((x) => Number(x.trim()))
    if (parts.length >= 4) return parts[3]
    if (parts.length === 3) return 1
  }
  throw new Error(`cannot read an alpha out of ${JSON.stringify(s)}. A gate that guesses here measures nothing.`)
}

if (failed > 0) {
  console.error('\nThe picture is the claim. A picture nothing checks is a claim nothing checks.')
  process.exit(1)
}

console.log('page: every figure and every colour a visitor sees comes from the committed measurement')
