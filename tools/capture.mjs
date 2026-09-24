/**
 * The moving picture at the top of the README.
 *
 *   npm run capture
 *
 * The recording is the finding. A still of this page is a grey panel with some
 * numbers beside it, and a grey panel is exactly what a broken heatmap looks
 * like, so the one thing worth ten seconds of a recruiter's attention is the
 * moment the same document goes from flat to structured without a single
 * character of it moving.
 *
 * So the choreography is fixed and its end state is asserted: section grain,
 * then paragraph, then line, then the control document at section grain where
 * one region goes dark. If the page cannot be driven into that last state, this
 * exits non-zero rather than writing a GIF of whatever it did instead.
 * `watch-it-think` shipped a recording of a page in the wrong state once, and
 * the README was captioned for the page it was supposed to be.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { serve } from './serve.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'docs/grain.gif')
const WORK = resolve(root, '.capture')

const SIZE = { width: 1280, height: 1180 }
const FPS = 8
const WIDTH = 880

rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })

const server = await serve()
let looked
let seconds
let crop

try {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: WORK, size: SIZE } })
  const videoStart = Date.now()
  const page = await context.newPage()
  await page.goto(server.url, { waitUntil: 'networkidle' })

  /*
   * Put the instrument in frame before recording anything worth keeping. The
   * crop is measured from the page rather than typed, because the masthead is
   * `clamp()`ed against the viewport and a hardcoded band moved by 40px the
   * first time the headline grew a word.
   */
  await page.evaluate(() => document.querySelector('.map')?.scrollIntoView({ block: 'start', behavior: 'instant' }))
  await page.waitForTimeout(400)
  const box = await page.evaluate(() => {
    const head = document.querySelector('.map-head')
    const paper = document.getElementById('paper')
    if (!head || !paper) return null
    const a = head.getBoundingClientRect()
    const b = paper.getBoundingClientRect()
    return { top: Math.max(0, Math.floor(a.top) - 14), bottom: Math.ceil(b.bottom) + 14 }
  })
  if (!box) {
    console.error('FAIL  the map is not on the page, so there is nothing to record')
    process.exit(1)
  }
  // Even height, because some players and encoders refuse an odd one.
  const height = Math.min(SIZE.height - box.top, box.bottom - box.top) & ~1
  crop = `crop=${SIZE.width}:${height}:0:${box.top}`

  const startedAt = Date.now()
  const grain = (v) => page.click(`#grain .seg-btn[data-value="${v}"]`)
  const doc = (v) => page.click(`#doc .seg-btn[data-value="${v}"]`)

  /*
   * Open on the flat map and hold, because the flat map is the claim. A viewer
   * who arrives after the colour has appeared has been shown an ordinary
   * heatmap and has no idea what this page is arguing.
   */
  await grain('section')
  await page.waitForTimeout(1700)
  await grain('paragraph')
  await page.waitForTimeout(1100)
  await grain('line')
  await page.waitForTimeout(1900)

  // Back to flat, then the control, so the last thing the loop shows is the one
  // region that goes dark when there is genuinely something to draw.
  await grain('section')
  await page.waitForTimeout(900)
  await doc('contract-json')
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    const paper = document.getElementById('paper')
    if (paper) paper.scrollTo({ top: paper.scrollHeight, behavior: 'smooth' })
  })
  await page.waitForTimeout(2200)

  seconds = (Date.now() - startedAt) / 1000

  looked = await page.evaluate(() => {
    const on = (id) => document.querySelector(`#${id} .seg-btn.is-on`)?.dataset.value ?? null
    const rows = [...document.querySelectorAll('#paper .row')]
    const colours = new Set(rows.map((r) => getComputedStyle(r).backgroundColor))
    return {
      grain: on('grain'),
      document: on('doc'),
      lines: rows.length,
      distinctColours: colours.size,
      readout: document.getElementById('readout')?.textContent?.trim() ?? '',
    }
  })

  const wanted = { grain: 'section', document: 'contract-json' }
  const wrong = Object.entries(wanted).filter(([k, v]) => looked[k] !== v)
  if (wrong.length > 0) {
    console.error('FAIL  the page did not reach the state this recording is choreographed for')
    for (const [k, v] of wrong) console.error(`      ${k}: wanted ${JSON.stringify(v)}, page is ${JSON.stringify(looked[k])}`)
    process.exit(1)
  }

  await context.close()
  await browser.close()

  const video = readdirSync(WORK).find((f) => f.endsWith('.webm'))
  if (!video) {
    console.error('FAIL  playwright wrote no video')
    process.exit(1)
  }
  const webm = resolve(WORK, video)
  mkdirSync(resolve(root, 'docs'), { recursive: true })

  const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
  const palette = resolve(WORK, 'palette.png')
  const filters = `${crop},fps=${FPS},scale=${WIDTH}:-1:flags=lanczos`

  const LEAD_IN = 0.3
  const offset = Math.max(0, (startedAt - videoStart) / 1000 - LEAD_IN)
  const trim = ['-ss', String(offset)]

  /*
   * Sixteen colours, undithered, eight frames a second, which is what
   * `chunkline` measured and the reasoning carries here unchanged: playwright
   * records lossy webm, so two frames of a page standing still are not
   * identical, GIF pays only for what changes, and a small palette quantises
   * that compression noise back onto the same few entries.
   *
   * There is one thing here that argues the other way and it was checked rather
   * than assumed. This picture **is** a ramp, which is the one case where
   * sixteen colours and no dithering normally show banding. It does not, and
   * the reason is that the ramp is never continuous on screen: it is painted a
   * line at a time from a finite set of rates, so the page arrives at ffmpeg
   * already quantised. Re-encoded from the same `docs/grain.webm`:
   *
   *   16 colours   1.35 MB
   *   32 colours   2.08 MB
   *   64 colours   2.69 MB
   *
   * Looked at at 1:1, the map bands no more at 16 than at 64, and the mono text
   * over the hot end stays crisp, which is the only thing that could have
   * vetoed it.
   */
  ff([...trim, '-i', webm, '-vf', `${filters},palettegen=max_colors=16:stats_mode=diff`, palette])
  ff([...trim, '-i', webm, '-i', palette, '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=none`, '-loop', '0', OUT])

  renameSync(webm, resolve(root, 'docs/grain.webm'))
  rmSync(WORK, { recursive: true, force: true })

  writeFileSync(
    resolve(root, 'docs/capture.json'),
    JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), fps: FPS, width: WIDTH, crop, seconds: Number(seconds.toFixed(1)), looked }, null, 2) + '\n',
  )
} finally {
  server.stop()
}

const { size } = statSync(OUT)
console.log(`docs/grain.gif   ${(size / 1e6).toFixed(2)} MB at ${FPS} fps, ${WIDTH}px wide, ${crop}`)
console.log(`docs/grain.webm  kept alongside it, for anywhere that takes video`)
console.log(`ends on ${looked.document} at ${looked.grain} grain: ${looked.lines} lines, ${looked.distinctColours} distinct colours, ${seconds.toFixed(1)}s of action`)
