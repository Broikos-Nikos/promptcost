/**
 * The states the recording visits, and how long each one is held.
 *
 * One source of truth, because two things need it and they must not drift:
 * `capture.mjs` performs it, and `check-loop.mjs` holds it to the window a
 * reader can actually read. Before tick 234 the holds were six bare numbers
 * inside `capture.mjs` and nothing checked them.
 *
 * ## Why the gate reads this rather than the GIF's own beats
 *
 * `tokenlab`'s `check-loop.mjs` finds its beats in the file: in an optimised
 * GIF a still frame compresses to a few dozen bytes and a whole redraw to a
 * hundred thousand, so the two transitions stand out and the holds between
 * them can be measured without knowing what the recording was supposed to do.
 *
 * That works there and does not work here, measured. `tokenlab`'s loop stands
 * still between its two redraws. This one never stands still: the heatmap
 * recolours, the readout counts, and the last beat scrolls a 316 line document
 * past the viewport. The frame sizes come out as a continuous ramp, median
 * 15,617 bytes against a peak of 43,502, with no gap to put a threshold in.
 * Two recordings of the identical choreography clustered differently, 4 beats
 * one run and 5 the next, because transitions sat either side of the 60% line.
 *
 * A gate that gives two answers for one input is worse than no gate, so this
 * one asserts what is deterministic: the holds here, which are what a reader's
 * eye actually gets, and the file's total duration and freeze, which the file
 * answers honestly. Inheriting `tokenlab`'s method was the same mistake as
 * inheriting its 5.5 second ceiling, one level down.
 */

/** Each hold, in the order the recording visits it. */
export const HOLDS = [
  { name: 'the flat map at section grain, which is the claim', ms: 1100 },
  { name: 'paragraph grain, where structure starts to show', ms: 950 },
  { name: 'line grain, the map the page is arguing for', ms: 1200 },
  { name: 'back to section grain, so the comparison closes', ms: 650 },
  { name: 'the JSON control pasted in', ms: 450 },
  { name: 'the scroll to the one region that goes dark', ms: 1100 },
]

/**
 * A state has to last long enough to be read and not so long that the picture
 * looks stopped. 900ms is `tokenlab`'s floor, measured there against a state
 * held 670ms that a recruiter pass could not describe afterwards.
 */
export const BEAT_MIN = 900
export const BEAT_MAX = 2500

/**
 * Two of the six are not states a reader stops at: the 650ms return to section
 * grain is a wipe between the argument and its control, and the 450ms before
 * the scroll is the paste landing. They are named here rather than exempted
 * silently.
 */
export const TRANSITIONS = new Set([3, 4])

/**
 * The whole loop, measured from the file. The holds come to 5.45s and the
 * transitions, the smooth scroll and ffmpeg's rounding to 8fps add the rest.
 * The window is wide enough for that and narrow enough to fail the 8.76s
 * recording this replaced, which is what `PGIF-F1` was.
 */
export const TOTAL_MIN = 5500
export const TOTAL_MAX = 7000

/** A held photograph inside a loop reads as a page that has stopped working. */
export const STILL_MAX = 900
