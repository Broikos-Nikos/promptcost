# promptcost

### A cost heatmap over a prompt is flat at the grain everyone draws it at. The bill is how often you send it.

**[The page is live.](https://broikos-nikos.github.io/promptcost/)** The heatmap and the argument against it are both on it.

Measured on a real system prompt, 12,855 characters and 3,157 tokens: the twelve
sections of it span **1.18x** in cost per character on screen. Twelve rectangles
of the same colour. Drop to line grain and the same document spans **1.73x**,
and what makes a line expensive turns out to be its punctuation, not its subject.

![The same prompt at three grains. At section grain the map is flat, twelve regions spanning 1.18x. At paragraph grain structure begins to appear. At line grain the map fills with colour, 216 regions spanning 1.73x, with headings and paths hot and plain English cool. Finally a JSON table is pasted in and one region goes dark red against the prose above it.](docs/grain.gif)

**[Open it](https://broikos-nikos.github.io/promptcost/)** and switch the grain
yourself. Nothing on the page is typed: every region, rate and price comes out of
`src/generated/density.json`, which `npm run build:density` computes from two
committed and hashed files, and four gates refuse the page to disagree with it.

---

## The number that matters is not on the map

3,157 tokens is 3.16 cents on the dearest model here. That prompt is re-read
every 30 minutes, which is 48 sends a day:

| model | input | per send | over 30 days |
|---|---|---|---|
| GPT-6 Astra | $10/M | $0.0316 | **$45.46** |
| GPT-5.5 | $5/M | $0.0158 | $22.73 |
| GPT-4o | $2.5/M | $0.0079 | $11.37 |
| GPT-4o mini | $0.15/M | $0.0005 | **$0.68** |

**$45.46 against $0.68 for the identical tokens, a factor of 67.** No
per-section heatmap shows either figure, and the decision they describe, which
model and how often, is the only decision on the page worth more than a rounding
error. That is why the page has dials for it.

## What was expected, and did not happen

The thesis a cost heatmap exists for is that the expensive parts of a prompt are
not the parts that look expensive. Measured section by section, the token share
tracks the line share everywhere, and the middle 90% of the twelve sections run
**3.61 to 4.25** characters a token.

| grain | regions | middle 90% | spread |
|---|---|---|---|
| section | 12 | 3.61 to 4.25 | 1.18x |
| paragraph | 78 | 3 to 4.61 | 1.54x |
| line | 216 | 3 to 5.2 | 1.73x |

So the finding is not that prompts are uniform. It is that **the structure is
below the grain the instrument is usually pointed at**. The cheapest line of the
whole document buys 2.5 characters per token and is a list item made of
backticked filenames; the dearest buys 5.71 and is a sentence of ordinary
English.

The spread is reported as the 5th to 95th percentile rather than as a range,
and that was a correction rather than a preference. The first build reported
min to max, got 3.02x at line grain, and the two lines setting it turned out to
be a markdown table rule and a line containing one brace. Raising a minimum
region size was tried and changed the band from 1.73x to 1.73x: the spread was
never an artefact of small regions, min and max were the artefact.

## The control, because a flat map has two readings

A heatmap that shows nothing might be looking at a uniform document, or it might
be broken. One picture cannot tell those apart, and the first is only a finding
once the second is ruled out.

So the page carries a second document: the same prompt with this repository's
own price table pasted into it, composed by the builder from the same two inputs
rather than written by hand. 1,579 characters of JSON at **2.79** characters a
token, against 4.07 for the prose it lands in, take the section grain from
1.18x to **1.52x**. Same instrument, same fixed scale, one region going dark.

`npm run check:grain` fails if that stops happening, which makes it the unusual
gate in this repository: **it fails when the world changes rather than when the
code does.** If the prompt ever grows a JSON block of its own, the front of this
project stops being true, and it is supposed to fail rather than keep asserting
it.

## What this does not claim

**Not that heatmaps are useless.** A prompt that is half prose, half retrieved
JSON, with a few-shot block in the middle has real structure to show, and the
control above is exactly what such a map surfaces. The claim is narrower: a
uniform prose prompt has nothing to map, and most system prompts are uniform
prose.

**Not that line grain is the right grain.** At line grain the hottest things in
this document are its headings and its horizontal rules, which is true and not
very useful. The honest reading is that the map finds punctuation density,
which is what a tokenizer charges for, and that a reader looking for expensive
*ideas* will not find them here at any grain.

**Not that the prices are current.** They are `tokenlab`'s committed table,
checked 2026-09-20 against the published list, hashed into the measurement. A
price list is stale the day after it is written, so the page prints the hash of
the one it used.

**Not that input tokens are the whole bill.** Output is priced separately and is
often larger. This measures what a prompt costs to send, which is the question a
cost heatmap is asked.

## Reproducing it

```
npm ci
npm run build:density     # measures data/contract.md and data/pricing.json
npm run build             # typecheck, five gates, then vite
npm run verify            # the two gates that need a real browser
```

`npm run capture`, which makes the recording at the top of this file, needs one program npm does not install: **ffmpeg**. Install it (`winget install Gyan.FFmpeg`, `brew install ffmpeg`, `apt install ffmpeg`). Nothing else here needs it and the page does not.

`npm run build:density` prints the table above. Both inputs are in `data/`, and
their sha256 is written into the measurement, so
`node tools/check-density.mjs` can refuse a figure computed from a file that has
since moved. The prompt is the build contract of the workspace these projects
are built in, committed here at `data/contract.md`,
sha256 `819fde8663378c9e`.

## The gates

| gate | what it refuses |
|---|---|
| `check:density` | any region, spread or price that does not recompute from the hashed inputs |
| `check:grain` | the headline, once it stops being true of the prompt it is about |
| `check:claims` | a figure in this README that the measurement does not produce |
| `check:page` | a colour on the page that did not come from the committed rate |
| `check:capture` | a recording of a state the live page no longer reaches |
| `check:source` | an invisible character in any source file |
| `check:licence` | a licence claimed in prose and absent from the tree |

`check:page` is the one worth reading. Every figure on this page could be
correct while the map itself is painted from nothing, so it reads the computed
background colour of all 294 lines and holds each one to `heat()`, the same
function the page calls. Its two controls: a constant tint, and the ramp
inverted. Both fail it, and the second is the interesting one, because an
inverted ramp leaves every number on the page correct.

## Licence

MIT, for the code. `data/contract.md` and `data/pricing.json` are this author's
own files, committed here so the measurement can be reproduced.
