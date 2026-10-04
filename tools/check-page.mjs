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
import { TINT_STOPS, cost, heat, rateByLine, tint } from '../src/lib/density.mjs'

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

  /*
   * 4b. What the map hands a screen reader.
   *
   * It is `role="img"` with a heading and a description, and that is not enough:
   * the role drops the row elements from the accessibility tree and leaves their
   * text in it. Measured on the committed contract before this: 294 rows put 902
   * nodes into the tree, 608 of them carrying a line of the document, out of
   * 1,340 on the whole page. Two thirds of what a reader walks was the picture
   * reading the document out a second time, a line at a time, unlabelled.
   *
   * tokenlab's PA-F8 was the same shape one project over, 2,779 nodes of 3,144,
   * and it is the reason this assertion exists here.
   */
  const client = await page.context().newCDPSession(page)
  await client.send('Accessibility.enable')
  {
    const { root } = await client.send('DOM.getDocument', { depth: -1 })
    const findDom = (node) => {
      const attrs = node.attributes ?? []
      for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'id' && attrs[i + 1] === 'paper') return node
      for (const child of node.children ?? []) {
        const hit = findDom(child)
        if (hit) return hit
      }
      return null
    }
    const dom = findDom(root)
    const { nodes } = await client.send('Accessibility.getFullAXTree')
    const byId = new Map(nodes.map((n) => [n.nodeId, n]))
    const mapAx = nodes.find((n) => n.backendDOMNodeId === dom?.backendNodeId)
    const names = []
    const walk = (ax) => {
      if (ax.name?.value) names.push(ax.name.value)
      for (const id of ax.childIds ?? []) {
        const child = byId.get(id)
        if (child) walk(child)
      }
    }
    if (mapAx) walk(mapAx)
    const rows = await page.$$eval('#paper .row', (n) => n.length)

    if (!mapAx) {
      fail('the map is not in the accessibility tree at all', 'Hiding the picture is not the same as describing it.')
    } else if (names.length !== 1) {
      fail(
        `the map puts ${names.length} named nodes into the accessibility tree, one per line of the document`,
        `${rows} rows, and it reads back as ${JSON.stringify(names.slice(1, 4).join(' | ').slice(0, 120))}\n` +
          '      role="img" drops the elements and keeps their text. The rows have to say they are decoration.',
      )
    } else {
      ok(`the map is one named node for ${rows} rows: ${JSON.stringify(names[0].slice(0, 60))}`)
    }
  }

  await page.close()

  /* 5. The phone. A map is useless at a width that scrolls sideways. */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await phone.goto(server.url, { waitUntil: 'networkidle' })
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0) fail(`the page scrolls sideways by ${overflow}px at 390`, 'Every phone reader meets this before they meet the finding.')
  else ok('no horizontal overflow at 390')

  /*
   * 6. And the legend is a reading of the scale, not a second copy of it.
   *
   * The ramp's five colours and five percentages were written out again in
   * `style.css`, by hand, next to the array the cells are painted from. They
   * agreed, and that is all that stood between this page and a legend that
   * explains the map with the wrong colours: every assertion above would have
   * stayed green, because every one of them reads cells. A reader matching a
   * cell against the ramp would have been reading a different scale.
   *
   * So the ramp is painted by `rampGradient()` now, and this compares what the
   * browser actually resolved against what the library says, stop by stop. It
   * is deliberately the resolved value rather than the string the page set: a
   * gate that reads back its own input measures nothing.
   */
  const painted = await phone.$eval('#ramp', (n) => getComputedStyle(n).backgroundImage)
  const colours = [...String(painted).matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map(Number)
    return `rgb(${p[0]} ${p[1]} ${p[2]})`
  })
  const percents = [...String(painted).matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]))
  const wantColours = TINT_STOPS.map(([at]) => tint(at))
  const wantPercents = TINT_STOPS.map(([at]) => +(at * 100).toFixed(2))

  if (colours.length !== wantColours.length) {
    fail(
      `the ramp resolves to ${colours.length} colour stops, the scale has ${wantColours.length}`,
      `the browser says ${JSON.stringify(String(painted).slice(0, 140))}`,
    )
  } else if (colours.join(' ') !== wantColours.join(' ')) {
    fail(
      'the ramp is not painted in the map’s own colours',
      `the ramp says ${colours.join(', ')}
      the cells are painted ${wantColours.join(', ')}`,
    )
  } else if (percents.join(' ') !== wantPercents.join(' ')) {
    fail(
      'the ramp’s stops are not where the scale puts them',
      `the ramp says ${percents.join('%, ')}%, the scale says ${wantPercents.join('%, ')}%`,
    )
  } else {
    ok(`the ramp is the scale: ${colours.length} stops, ${wantColours[0]} to ${wantColours[wantColours.length - 1]}, at ${wantPercents.join('%, ')}%`)
  }

  /* And the ends of the ramp are the ends of the measured scale, in words. */
  const ends = await phone.evaluate(() => [
    document.getElementById('legend-low').textContent.trim(),
    document.getElementById('legend-high').textContent.trim(),
  ])
  is('the cold end of the ramp', ends[0], `${d.scale.high} chars/token, cheap`)
  is('the hot end of the ramp', ends[1], `${d.scale.low}, expensive`)

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
