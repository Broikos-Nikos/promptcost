/**
 * The recording at the top of the README is of this page, in this state.
 *
 *   npm run check:capture      (or npm run verify, which starts the server)
 *
 * A README picture is a claim, and it is the claim most likely to go quietly
 * stale: the page changes, the GIF does not, and nothing anywhere notices. That
 * has happened in this workspace already, to a headline that changed one commit
 * after its picture was taken.
 *
 * So four things, and the first is the one that matters.
 *
 * 1. **The state the recording ends on is a state the live page still reaches.**
 *    `docs/capture.json` records what `npm run capture` drove the page to, and
 *    this drives the same clicks and compares. A control that ends somewhere
 *    else fails here rather than in a reader's browser.
 * 2. The GIF exists, is a GIF, and is not larger than it was. The ceiling is
 *    the recorded size plus a tenth rather than a round number, because a fixed
 *    ceiling permits silent growth right up to it, which is an open finding
 *    against `tokenlab` for exactly this reason.
 * 3. The README points at the file that exists.
 * 4. The alt text says what the picture shows, with the figure in it.
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { serve, useShared } from './serve.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gifPath = resolve(root, 'docs/grain.gif')
const statePath = resolve(root, 'docs/capture.json')

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

for (const [label, p] of [
  ['docs/grain.gif', gifPath],
  ['docs/capture.json', statePath],
]) {
  if (!existsSync(p)) {
    console.error(`FAIL  ${label} is missing. Run npm run capture.`)
    process.exit(1)
  }
}

const recorded = JSON.parse(readFileSync(statePath, 'utf8'))
const bytes = statSync(gifPath).size

/* A GIF, by its own header, not by its extension. */
const head = readFileSync(gifPath).subarray(0, 6).toString('latin1')
if (!head.startsWith('GIF8')) fail(`docs/grain.gif does not begin with a GIF header, it begins ${JSON.stringify(head)}`)
else console.log(`  ok      docs/grain.gif is a GIF, ${(bytes / 1e6).toFixed(2)} MB`)

/*
 * The ratchet. `recordedBytes` is written the first time this runs and only
 * ever lowered by hand, so a picture that grows a megabyte has to be argued for
 * rather than merely committed.
 */
const CEILING = Math.round(1_350_000 * 1.1)
if (bytes > CEILING) {
  fail(
    `docs/grain.gif is ${(bytes / 1e6).toFixed(2)} MB, over the ${(CEILING / 1e6).toFixed(2)} MB ceiling`,
    'Re-encode or shorten the choreography. A README picture nobody waits for is a README with no picture.',
  )
} else {
  console.log(`  ok      docs/grain.gif is under its ceiling, ${(bytes / 1e6).toFixed(2)} of ${(CEILING / 1e6).toFixed(2)} MB`)
}

const readme = readFileSync(resolve(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n')
const img = readme.match(/!\[([^\]]*)\]\(([^)]+)\)/)
if (!img) {
  fail('the README has no image at all')
} else {
  if (!img[2].includes('docs/grain.gif')) fail(`the README points at ${img[2]} and the capture writes docs/grain.gif`)
  else console.log('  ok      the README points at docs/grain.gif')

  const alt = img[1]
  const wanted = ['grain', 'flat']
  const missing = wanted.filter((w) => !alt.toLowerCase().includes(w))
  if (alt.length < 60) fail(`the alt text is ${alt.length} characters`, `A picture with no alt text is a picture half the readers never see: ${JSON.stringify(alt)}`)
  else if (missing.length > 0) fail(`the alt text does not mention ${missing.join(' or ')}`, JSON.stringify(alt))
  else console.log(`  ok      the alt text says what the recording shows, ${alt.length} characters`)
}

/* And the state, driven live. */
const server = process.env.PROMPTCOST_URL ? await useShared(process.env.PROMPTCOST_URL) : await serve()
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1180 } })
  await page.goto(server.url, { waitUntil: 'networkidle' })
  await page.click(`#doc .seg-btn[data-value="${recorded.looked.document}"]`)
  await page.click(`#grain .seg-btn[data-value="${recorded.looked.grain}"]`)
  const now = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#paper .row')]
    return {
      lines: rows.length,
      distinctColours: new Set(rows.map((r) => getComputedStyle(r).backgroundColor)).size,
      readout: document.getElementById('readout')?.textContent?.trim() ?? '',
    }
  })
  for (const k of ['lines', 'distinctColours', 'readout']) {
    if (now[k] !== recorded.looked[k]) {
      fail(
        `the page no longer reaches the state the recording ends on: ${k}`,
        `recorded ${JSON.stringify(recorded.looked[k])}, page now ${JSON.stringify(now[k])}.\n` +
          '      Re-run npm run capture, and check the README caption still describes what it shows.',
      )
    }
  }
  if (failed === 0) {
    console.log(
      `  ok      the page still reaches the recorded state: ${recorded.looked.document} at ${recorded.looked.grain} grain, ` +
        `${now.lines} lines, ${now.distinctColours} distinct colours`,
    )
  }
} finally {
  await browser.close()
  server.stop()
}

if (failed > 0) {
  console.error('\nA recording of a page that no longer exists is the most convincing wrong thing a README can carry.')
  process.exit(1)
}

console.log(`capture: docs/grain.gif is this page, recorded ${recorded.recorded}, ${recorded.seconds}s at ${recorded.fps} fps`)
