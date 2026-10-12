/**
 * The picture the argument is about begins on the first screen.
 *
 *   npm run check:fold
 *
 * `PFOLD-F1`, swept from `chunkline` CME2-F4 on 4 October and measured again
 * at tick 230, the day this repository was published, against the built page:
 *
 *     1280x800   the heatmap starts at 1129   fold 800
 *     390x844    the heatmap starts at 1442   fold 844
 *
 * ## The first version of this gate passed while the finding was still true
 *
 * It measured `section.map`, and tightening the masthead brought that to 616
 * of 800 with 184 pixels showing, which it called ok. `section.map` is the
 * heading, the grain controls, the readout and the key, and the picture is
 * `.paper` inside it: still at 886 at 1280 and 1150 at 390, which is below
 * the fold at both widths. A gate reporting 184 pixels of a picture that was
 * not on the screen is the class this workspace keeps finding, an expected
 * value that is a property of something other than the gate's subject. The
 * subject is the paper.
 *
 * A reader arriving at this page met an eyebrow, a headline, a standfirst and
 * three numbers, and had to take on trust that there is a map at all. The
 * whole page is an argument that the map is the wrong picture for the
 * question, which cannot be made to somebody who has not seen the map.
 *
 * ## What it asks, and why it is a quantity rather than a yes
 *
 * At both widths the map's top is above the fold **and at least 120 pixels of
 * it are on the first screen**. A gate that asked only for the top to be above
 * the fold passes on one pixel of a 1,194 pixel picture, which is the same
 * defect with a better number. 120 is the first band of the map plus its
 * heading, measured: it is what makes the thing recognisable as a picture
 * rather than as a border.
 *
 * It does not ask for the whole map, because the map is 1,194 pixels tall at
 * 1280 and 1,486 at 390 and no fold holds it. `chunkline` could ask for all of
 * its ticks because its comparison is 300 pixels tall. The assertion has to be
 * about what this page's picture is, not about what another project's was.
 *
 * ## What it cost
 *
 * No text, and nothing that was visible. The masthead's own air first: the
 * headline cap from 3.9rem to 3.1rem over a 24ch measure, a third off the
 * padding of the three figures, and the gap above the first section from 8vh
 * to 3vh. That was 243 pixels and it was not enough. The standfirst and the
 * three figures moved below the map, which is where a summary belongs once
 * there is something to summarise, and on a phone the key moved under the
 * picture it explains.
 *
 *     1280x800   the heatmap starts at 620 of 800   180 pixels showing
 *     390x844    the heatmap starts at 619 of 844   225 pixels showing
 */

import { chromium } from 'playwright'
import { serve, useShared } from './serve.mjs'

/* The desktop window the audits use and a phone that is still common. */
const SIZES = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]

/* Of the picture, on the first screen. See the header. */
const WANT_VISIBLE = 120

/*
 * The paper, not the section that contains it. The section is a heading, a row
 * of grain controls, a readout and a key, and the first version of this gate
 * measured it and passed while the heatmap was 86 pixels below the fold.
 */
const PICTURE = '.paper'

const server = process.env.PROMPTCOST_URL ? await useShared(process.env.PROMPTCOST_URL) : await serve()
const browser = await chromium.launch()

let failed = 0
const fail = (what, detail) => {
  failed++
  console.error(`FAIL  ${what}`)
  if (detail) console.error(`      ${detail}`)
}

try {
  for (const viewport of SIZES) {
    const page = await browser.newPage({ viewport })
    await page.goto(server.url, { waitUntil: 'networkidle' })

    /* The map draws from src/generated/density.json after the first paint, and
       a measurement taken before it has drawn is a measurement of a placeholder. */
    await page.waitForFunction((selector) => (document.querySelector(selector)?.children.length ?? 0) > 0, PICTURE, {
      timeout: 30_000,
    })
    await page.waitForTimeout(600)

    const seen = await page.evaluate((selector) => {
      const picture = document.querySelector(selector)
      if (!picture) return null
      const r = picture.getBoundingClientRect()
      return {
        fold: window.innerHeight,
        top: Math.round(r.top + window.scrollY),
        height: Math.round(r.height),
      }
    }, PICTURE)

    if (!seen) {
      fail(`at ${viewport.width}x${viewport.height} there is no ${PICTURE} on the page`, 'This gate is reading the wrong element, which is how its first version passed.')
      await page.close()
      continue
    }

    const visible = Math.max(0, seen.fold - seen.top)
    if (visible < WANT_VISIBLE) {
      fail(
        `at ${viewport.width}x${viewport.height} the heatmap starts at ${seen.top} against a fold of ${seen.fold}`,
        `${visible} pixels of it are on the first screen and the rule is ${WANT_VISIBLE}. The page is an argument that this picture is the wrong one, and it cannot be made to somebody who has not seen it.`,
      )
    } else {
      console.log(
        `  ok      ${viewport.width}x${viewport.height}  the heatmap starts at ${seen.top} of ${seen.fold}, ${visible} of its ${seen.height} pixels on the first screen`,
      )
    }
    await page.close()
  }
} finally {
  await browser.close()
  server.stop()
}

if (failed > 0) {
  console.error('\nA picture nobody scrolls to is a picture the argument is missing.')
  process.exit(1)
}

console.log(`fold: the heatmap begins on the first screen at ${SIZES.length} widths, with at least ${WANT_VISIBLE} pixels of it showing`)
