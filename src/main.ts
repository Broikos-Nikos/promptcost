/**
 * The page.
 *
 * It computes nothing it could get wrong. Every region, rate, band and price
 * comes out of `src/generated/density.json`, written by `npm run build:density`
 * from two committed and hashed inputs, and the only arithmetic here is the
 * multiplication the dials exist to do.
 *
 * That is not tidiness, it is the lesson from `evalkit`: its page recomputed a
 * threshold with its own rounding, the headline said 177 while the library said
 * 178, the build passed, and nine assertions stayed green. So the rule in this
 * project is that a number the page shows is either read from the measurement
 * or produced by `cost()`, the one function the gates also call.
 */

import './style.css'
import data from './generated/density.json'
// @ts-expect-error the library is plain JavaScript, shared with the builder and
// every gate on purpose: a typed second copy for the browser is two
// implementations of the same arithmetic, which agree about a mistake sooner or
// later. `evalkit` had exactly that and shipped a headline one off its library.
import { cost, heat, rampGradient, rateByLine, tint } from './lib/density.mjs'

type Region = { from: number; to: number; chars: number; tokens: number; charsPerToken: number; label: string }
type Grain = 'section' | 'paragraph' | 'line'

const GRAIN_NOTE: Record<Grain, string> = {
  section: 'the grain a heatmap is always drawn at',
  paragraph: 'one step down',
  line: 'where the structure actually is',
}

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id)
  if (!node) throw new Error(`the page is missing #${id}`)
  return node as T
}

const state = {
  grain: 'section' as Grain,
  doc: data.opensOn,
  model: data.verdict.dearest.id,
  sends: data.cadence.sendsPerDay,
  days: data.cadence.days,
}

const doc = () => data.documents.find((d) => d.id === state.doc) ?? data.documents[0]
const grains = () => doc().grains as unknown as Record<Grain, { regions: Region[]; spread: Record<string, number> }>
const fmt = (n: number) => n.toLocaleString('en-US')
const money = (n: number) => `$${n.toFixed(n >= 0.1 ? 2 : 4)}`

/*
 * One ramp, cold to hot, with the cold end a long way from the page background
 * so a cheap line still reads as painted rather than as unpainted. The first
 * version faded to the background at heat 0 and the section-grain map looked
 * like a rendering failure rather than like a flat measurement, which is the
 * one reading this page cannot afford.
 *
 * `tint` and its five stops live in `lib/density.mjs` now, with `heat`, because
 * the legend below the map was a second hand written copy of them in CSS. See
 * the note on `TINT_STOPS`.
 */

function drawSegments() {
  for (const [id, h] of [
    ['grain', ['section', 'paragraph', 'line']],
    ['doc', data.documents.map((d) => d.id)],
  ] as const) {
    const host = el(id)
    host.textContent = ''
    for (const value of h) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.value = value
      b.className = 'seg-btn'
      b.setAttribute('role', 'radio')
      if (id === 'grain') {
        b.textContent = value
        b.title = GRAIN_NOTE[value as Grain]
      } else {
        // The label is the document's own, not a test on its position. This read
        // `value === data.documents[0].id ? 'the prompt' : 'with JSON pasted in'`,
        // which called whatever sat at index 0 the prompt and everything else
        // the control.
        const d = data.documents.find((x) => x.id === value)
        b.textContent = d ? d.button : value
        b.title = d ? d.note : ''
      }
      b.addEventListener('click', () => {
        if (id === 'grain') state.grain = value as Grain
        else state.doc = value
        render()
      })
      host.appendChild(b)
    }
  }
}

function drawModels() {
  const sel = el<HTMLSelectElement>('model')
  sel.textContent = ''
  for (const m of data.verdict.costs) {
    const o = document.createElement('option')
    o.value = m.id
    o.textContent = `${m.label}, $${m.inputPerMillion}/M input`
    sel.appendChild(o)
  }
  sel.value = state.model
  sel.addEventListener('change', () => {
    state.model = sel.value
    renderBill()
  })
  for (const [id, key] of [
    ['sends', 'sends'],
    ['days', 'days'],
  ] as const) {
    const input = el<HTMLInputElement>(id)
    input.value = String(state[key])
    input.addEventListener('input', () => {
      state[key] = Number(input.value)
      renderBill()
    })
  }
}

function renderMap() {
  const d = doc()
  const g = grains()[state.grain]
  const rates = rateByLine(g.regions, d.lines)
  const lines = d.text.split('\n')
  const paper = el('paper')
  paper.textContent = ''

  const frag = document.createDocumentFragment()
  lines.forEach((line, i) => {
    const row = document.createElement('span')
    row.className = 'row'
    row.dataset.row = ''
    /*
     * The map is `role="img"` with a description, and that is not enough: the
     * role drops these elements from the accessibility tree and leaves their
     * text in it. Measured before this, on the committed contract: 294 rows put
     * 902 nodes into the tree, 608 of them carrying a line of the document, out
     * of 1,340 on the whole page, so two thirds of what a screen reader walks
     * was the picture reading the document out a second time.
     */
    row.setAttribute('aria-hidden', 'true')
    const rate = rates[i]
    if (rate > 0) {
      const h = heat(rate, data.scale)
      row.style.setProperty('--tint', tint(h))
      row.style.setProperty('--strength', String(0.16 + 0.74 * h))
      row.title = `${rate} characters a token`
    } else {
      row.classList.add('row--empty')
    }
    row.textContent = line === '' ? ' ' : line
    frag.appendChild(row)
  })
  paper.appendChild(frag)

  const s = g.spread
  el('readout').innerHTML =
    `<strong>${s.regions} regions</strong> at ${state.grain} grain, ${GRAIN_NOTE[state.grain]}. ` +
    `The middle 90% of them run <strong>${s.p5} to ${s.p95}</strong> characters a token, a spread of ` +
    `<strong>${s.band}x</strong>. ${s.outside} region${s.outside === 1 ? '' : 's'} outside that band.`

  el('paper-alt').textContent =
    `${d.title}, ${fmt(d.chars)} characters and ${fmt(d.tokens)} tokens over ${d.lines} lines, tinted by characters ` +
    `per token at ${state.grain} grain on a fixed scale of ${data.scale.low} to ${data.scale.high}. ` +
    `Cool is cheap, hot is expensive. The middle 90% of regions span ${s.band}x.`

  const sorted = [...g.regions].filter((r) => r.chars >= 20).sort((a, b) => a.charsPerToken - b.charsPerToken)
  const picked = [...sorted.slice(0, 3), ...sorted.slice(-3).reverse()]
  const body = el('worst')
  body.textContent = ''
  picked.forEach((r, i) => {
    const tr = document.createElement('tr')
    if (i === 3) tr.className = 'rule'
    const th = document.createElement('th')
    th.scope = 'row'
    th.textContent = r.label
    const cells = [fmt(r.chars), fmt(r.tokens), r.charsPerToken.toFixed(2)]
    tr.appendChild(th)
    for (const c of cells) {
      const td = document.createElement('td')
      td.textContent = c
      tr.appendChild(td)
    }
    const swatch = document.createElement('td')
    swatch.className = 'swatch'
    swatch.style.background = tint(heat(r.charsPerToken, data.scale))
    tr.appendChild(swatch)
    body.appendChild(tr)
  })
  el('worst-caption').textContent =
    `The three most expensive and three cheapest regions at ${state.grain} grain, of 20 characters or more. Low is expensive.`

  for (const b of document.querySelectorAll<HTMLButtonElement>('.seg-btn')) {
    const on = b.dataset.value === state.grain || b.dataset.value === state.doc
    b.classList.toggle('is-on', on)
    b.setAttribute('aria-checked', String(on))
  }
}

function renderBill() {
  const d = doc()
  const cadence = { sendsPerDay: state.sends, days: state.days }
  const rows = data.verdict.costs.map((m) => ({ ...m, ...cost(d.tokens, m.inputPerMillion, cadence) }))
  const mine = rows.find((m) => m.id === state.model) ?? rows[0]
  const dearest = rows.reduce((a, b) => (b.perWindow > a.perWindow ? b : a))
  const cheapest = rows.reduce((a, b) => (b.perWindow < a.perWindow ? b : a))

  el('bill').textContent = money(mine.perWindow)
  el('bill-note').textContent =
    `${mine.label}, ${fmt(d.tokens)} input tokens, ${fmt(state.sends)} sends a day for ${state.days} days. ` +
    `The same prompt on ${cheapest.label} is ${money(cheapest.perWindow)}, a factor of ${Math.round(dearest.perWindow / cheapest.perWindow)}.`
  el('sends-out').textContent = String(state.sends)
  el('days-out').textContent = String(state.days)

  const body = el('prices')
  body.textContent = ''
  for (const m of rows) {
    const tr = document.createElement('tr')
    if (m.id === state.model) tr.className = 'is-on'
    const th = document.createElement('th')
    th.scope = 'row'
    th.textContent = m.label
    tr.appendChild(th)
    for (const c of [`$${m.inputPerMillion}/M`, money(m.perSend), money(m.perWindow)]) {
      const td = document.createElement('td')
      td.textContent = c
      tr.appendChild(td)
    }
    body.appendChild(tr)
  }

  el('kpi-spread').textContent = `${Math.round(dearest.perWindow / cheapest.perWindow)}x`
  el('kpi-spread-unit').textContent = `${money(dearest.perWindow)} against ${money(cheapest.perWindow)}, identical tokens`
}

function render() {
  renderMap()
  renderBill()
}

const v = data.verdict
el('kpi-section').textContent = `${v.sectionBand}x`
el('kpi-line').textContent = `${v.lineBand}x`
el('ramp').style.backgroundImage = rampGradient()
el('legend-low').textContent = `${data.scale.high} chars/token, cheap`
el('legend-high').textContent = `${data.scale.low}, expensive`
el('method-provenance').textContent =
  `Measured ${data.measured} with ${data.encoding}, the encoding every model in the price table uses. ` +
  `The prompt is ${data.inputs.contract.file}, sha256 ${data.inputs.contract.sha256.slice(0, 16)}. ` +
  `The prices are ${data.inputs.pricing.file}, checked ${data.inputs.pricing.checked}, sha256 ${data.inputs.pricing.sha256.slice(0, 16)}.`

drawSegments()
drawModels()
render()
