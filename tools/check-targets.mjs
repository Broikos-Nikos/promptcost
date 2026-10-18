/**
 * Everything a reader can press is big enough to press.
 *
 *   npm run check:targets
 *
 * `PTAP-F1`, measured at tick 193 across all eight projects and still true at
 * tick 234. Nine visible controls on this page and three of them under 24 by
 * 24 at every width, the smallest 311.2 by 16:
 *
 *     button.seg-btn    69.8 x 35.3   section
 *     button.seg-btn    89.7 x 35.3   paragraph
 *     button.seg-btn    47.8 x 35.3   line
 *     button.seg-btn    96.2 x 35.3   the prompt
 *     button.seg-btn   150.4 x 35.3   with JSON pasted in
 *     select#model     311.2 x 40     the model and its price
 *     input#sends      311.2 x 16     how often the prompt is sent
 *     input#days       311.2 x 16     over how many days
 *     a                303.6 x 21     Source, measurement and gates on GitHub
 *
 * Two different reasons for the same number. A range input is 16 pixels tall
 * because that is the track the user agent draws, and the track is the target:
 * a press anywhere along it moves the thumb. An inline link is 21 tall because
 * that is the line box of its text and it has no height of its own.
 *
 * The two sliders are the ones that matter here. This page's whole argument is
 * that the bill is how often you send the prompt rather than what is in it,
 * and `#sends` and `#days` are the two controls that make that argument move.
 * A reader on a phone was being asked to drag a 16 pixel band.
 *
 * WCAG 2.5.8 AA asks for 24 by 24, with an exception where an equivalent
 * control exists elsewhere on the page. `agentscope` used that exception at
 * tick 193 for 648 marks inside a picture that cannot be made larger. Nothing
 * here has that excuse: a slider can be 24 tall and a link can have padding.
 *
 * ## What it asserts
 *
 * Every visible interactive element is at least 24 by 24, at three widths. The
 * widths matter because a target shrinks with its container: `#sends` is 352.9
 * wide at 1280 and 281.2 at 360, and the link is 23 tall on a laptop and 21 on
 * a phone. A gate run at one width would have been wrong about the others.
 *
 * What counts as interactive is listed rather than inferred, and a scroll
 * container with `tabindex` is excluded by name: it is a region a keyboard
 * enters, not a thing a thumb presses, and counting it would make this gate
 * pass or fail on something it is not about.
 */

import { chromium } from 'playwright'
import { serve, useShared } from './serve.mjs'

const SIZES = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]

/* WCAG 2.5.8 AA. agentscope holds its own list to 44, the AAA figure, because
   those rows were built for this finding and could be any size. These are the
   page's own controls and 24 is the rule they have to meet. */
const MIN = 24

const CONTROLS = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="radio"], [role="button"]'

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

    /* The heatmap draws after the first paint, and the controls are laid out
       beside it, so a measurement taken before it has drawn is a measurement
       of a page that is still moving. */
    await page.waitForFunction((selector) => (document.querySelector(selector)?.children.length ?? 0) > 0, '.paper', {
      timeout: 60_000,
    })

    const seen = await page.evaluate(
      ([selector, min]) =>
        [...document.querySelectorAll(selector)]
          .map((e) => {
            const r = e.getBoundingClientRect()
            return {
              what: e.tagName.toLowerCase() + (e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : ''),
              text: (e.textContent || '').trim().slice(0, 40),
              w: Math.round(r.width * 10) / 10,
              h: Math.round(r.height * 10) / 10,
            }
          })
          .filter((x) => x.w > 0 && x.h > 0)
          .map((x) => ({ ...x, small: x.w < min || x.h < min })),
      [CONTROLS, MIN],
    )

    if (seen.length === 0) {
      fail(
        `at ${viewport.width}x${viewport.height} this gate found no controls at all`,
        'It is reading the wrong page or the wrong selector, which is worse than the finding it holds.',
      )
      await page.close()
      continue
    }

    const small = seen.filter((x) => x.small)
    if (small.length > 0) {
      fail(
        `at ${viewport.width}x${viewport.height}, ${small.length} of ${seen.length} controls are under ${MIN} by ${MIN}`,
        small.map((x) => `${x.what} ${x.w}x${x.h} ${JSON.stringify(x.text)}`).join('; '),
      )
    } else {
      const smallest = seen.reduce((a, b) => (Math.min(b.w, b.h) < Math.min(a.w, a.h) ? b : a))
      console.log(
        `  ok      ${viewport.width}x${viewport.height}  ${seen.length} controls, the smallest ${smallest.what} at ${smallest.w} by ${smallest.h}`,
      )
    }
    await page.close()
  }
} finally {
  await browser.close()
  server.stop()
}

if (failed > 0) {
  console.error('\nA control a thumb cannot hit is a control the page does not have on a phone.')
  process.exit(1)
}

console.log(`targets: every control is at least ${MIN} by ${MIN} at ${SIZES.length} widths`)
