/**
 * What a prompt costs, per region, at three grains.
 *
 * One file, imported by the builder that writes `src/generated/density.json`,
 * by the page that draws it, and by every gate that checks it. `evalkit` proved
 * why: while its page recomputed a threshold with its own `Math.round`, the
 * headline said 177 and the library said 178, the build passed, and nine
 * assertions stayed green. A second implementation of a number is a second
 * answer waiting to be given.
 *
 * ## The unit, and why it is this one
 *
 * **Characters per token**, not tokens. Tokens alone redraw the document's
 * shape: a long section has more of them because it is long, which is a fact
 * about the outline and not about cost. Characters per token is a rate, so a
 * region is expensive when it buys fewer characters of what a reader sees for
 * each token that is paid for. Low is expensive. That inversion is stated on
 * the page rather than assumed, because every reader's instinct is that a big
 * number is a bad number.
 *
 * ## The grains, and why the switch is the instrument
 *
 * The project was specified as "a cost heatmap over a prompt". Measured at the
 * grain such maps are always drawn at, whole sections, `BUILD-PROMPT.md` spans
 * 3.61 to 4.28 characters a token, a range of 1.19x, which is twelve rectangles
 * of the same colour. At line grain the same document spans 2.50 to 5.71, a
 * range of 2.29x.
 *
 * So the finding is not that prompts are uniform. It is that **the structure is
 * below the grain the instrument is usually pointed at**, and the thing that
 * makes a line expensive is its punctuation rather than its subject: the
 * cheapest line in the contract is a list item made of backticked filenames,
 * and the dearest is a sentence of ordinary English.
 */

/** Low is expensive: a region buying few characters per token paid for. */
export const GRAINS = ['section', 'paragraph', 'line']

/**
 * Split text into regions at one grain, each carrying the line numbers it
 * covers.
 *
 * Every grain returns line spans rather than character offsets, because the
 * page renders one element per line at every grain and only ever recolours
 * them. Switching grain must not reflow the document: if the layout moved, a
 * reader could not tell a change of colour from a change of shape, and the
 * whole comparison this project is built on would be unreadable.
 */
export function regions(text, grain, encode) {
  const lines = text.split('\n')
  const spans = []

  if (grain === 'line') {
    lines.forEach((_, i) => spans.push([i, i]))
  } else if (grain === 'paragraph') {
    let start = 0
    lines.forEach((line, i) => {
      if (line.trim() !== '') return
      if (i > start) spans.push([start, i - 1])
      start = i + 1
    })
    if (start < lines.length) spans.push([start, lines.length - 1])
  } else if (grain === 'section') {
    let start = 0
    lines.forEach((line, i) => {
      if (i === 0 || !line.startsWith('## ')) return
      spans.push([start, i - 1])
      start = i
    })
    spans.push([start, lines.length - 1])
  } else {
    throw new Error(`unknown grain ${JSON.stringify(grain)}`)
  }

  return spans
    .map(([from, to]) => {
      const body = lines.slice(from, to + 1).join('\n')
      const tokens = encode(body).length
      return {
        from,
        to,
        chars: body.length,
        tokens,
        /*
         * Two decimals is the page's own precision, and rounding here rather
         * than at each display site is deliberate. `evalkit` decided a
         * comparison on a value rounded to two places while the library held
         * four, twice, and the third failure was the test's own `toFixed`
         * losing 3.5e-7. One rounding, in one place, and everything downstream
         * reads it.
         */
        charsPerToken: tokens === 0 ? 0 : Number((body.length / tokens).toFixed(2)),
        label: label(lines[from], from),
      }
    })
    .filter((r) => r.tokens > 0)
}

/** What to call a region in a tooltip: its first non-empty line, trimmed. */
function label(first, index) {
  const t = (first ?? '').replace(/^#+\s*/, '').trim()
  return t.length > 0 ? t.slice(0, 64) : `line ${index + 1}`
}

/**
 * Line-by-line rate, from regions that have already been measured.
 *
 * The page paints with this and `check:page` reads the painted result through
 * it, so neither can hold its own opinion about which line is which colour. The
 * page never tokenises anything: it is handed the committed regions and does
 * index arithmetic, which is why nothing in `dist/` carries a vocabulary.
 */
export function rateByLine(rs, lineCount) {
  const rate = new Array(lineCount).fill(0)
  for (const r of rs) {
    for (let i = r.from; i <= r.to && i < lineCount; i++) rate[i] = r.charsPerToken
  }
  return rate
}

/** The same, measured from scratch. Used by the gate that trusts nothing. */
export function perLine(text, grain, encode) {
  return rateByLine(regions(text, grain, encode), text.split('\n').length)
}

/**
 * The spread of a grain, reported as the band from the 5th to the 95th
 * percentile, with the full range beside it and the outliers counted.
 *
 * **Min and max are not the statistic here, and the reason was measured rather
 * than assumed.** The first build of this project reported the full range and
 * got 3.02x at line grain, which looked like a strong finding until the two
 * lines fixing it turned out to be `|---|---|---|---|` at 1.89 and, in the
 * control document, a line containing one `{` at 1.0. A ratio over nine tokens
 * is not a rate, and a heatmap whose scale is set by a brace is a map of
 * markdown punctuation.
 *
 * The obvious fix, a minimum region size, was tried and rejected **because it
 * changed nothing that mattered**: raising the floor from 1 token to 8 dropped
 * 41 of 216 lines and moved the p5 to p95 band from 1.73x to 1.73x. The spread
 * is not an artefact of small regions. It was min and max that were the
 * artefact, exactly the way `gatewaylab` found its own reported spread growing
 * from 5% to 29% purely by raising the sample size from 3 to 10.
 *
 * So: the band is the headline, the full range is printed next to it so nothing
 * is hidden, and the count outside the band says how many regions the band
 * ignores.
 */
export function spread(rs) {
  const sorted = rs.map((r) => r.charsPerToken).sort((a, b) => a - b)
  const at = (f) => sorted[Math.min(sorted.length - 1, Math.floor(f * (sorted.length - 1)))]
  const lo = sorted[0]
  const hi = sorted[sorted.length - 1]
  const p5 = at(0.05)
  const p95 = at(0.95)
  return {
    regions: rs.length,
    low: lo,
    p5,
    p25: at(0.25),
    median: at(0.5),
    p75: at(0.75),
    p95,
    high: hi,
    band: Number((p95 / p5).toFixed(2)),
    fullRange: Number((hi / lo).toFixed(2)),
    outside: sorted.filter((v) => v < p5 || v > p95).length,
  }
}

/** What one send of `tokens` costs, and what sending it on a cadence costs. */
export function cost(tokens, inputPerMillion, cadence) {
  const perSend = (tokens / 1e6) * inputPerMillion
  return {
    perSend: Number(perSend.toFixed(4)),
    perDay: Number((perSend * cadence.sendsPerDay).toFixed(3)),
    perWindow: Number((perSend * cadence.sendsPerDay * cadence.days).toFixed(2)),
  }
}

/**
 * Where a rate sits on the scale, 0 cheapest to 1 dearest.
 *
 * The scale is fixed across grains and documents by the builder, not
 * recomputed per view. A per-view scale would normalise every grain to the same
 * spread of colour and erase the only thing this page is trying to show: at
 * section grain the colours have to visibly bunch.
 */
export function heat(charsPerToken, scale) {
  if (charsPerToken <= 0) return 0
  const t = (scale.high - charsPerToken) / (scale.high - scale.low)
  return Math.max(0, Math.min(1, Number(t.toFixed(4))))
}
