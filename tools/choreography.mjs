/**
 * The states the recording visits, and how long each one is held.
 *
 * One source of truth, because three things need it and they must not drift:
 * `capture.mjs` performs it, `capture.mjs` trims the recording to it, and
 * `check-loop.mjs` holds both the script and the file to it. Before tick 234
 * the holds were six bare numbers inside `capture.mjs` and nothing checked
 * them.
 *
 * ## Every hold is a whole number of frames
 *
 * The GIF is encoded at 8 frames a second, so the shortest thing it can
 * express is 125ms. A hold of 950ms is 7.6 frames and lands in the file as
 * either 875 or 1,000 depending on where the hold starts relative to the
 * sampling grid, and 875 is under the floor below. The gate at tick 234 could
 * not see that, because it compared this file's numbers against this file's
 * numbers. Raised in the audit of tick 234 as F1 and fixed here: the holds are
 * multiples of `FRAME_MS`, so the script's number and the file's number are
 * the same number.
 *
 * ## Why the gate reads the file for duration and this module for holds
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
 *
 * So the division of labour is: the holds below are a statement about the
 * script, and `check-loop.mjs` says so rather than dressing it up as a
 * measurement; the file is held to its total, which is now pinned at both ends
 * and is a real measurement of what a reader downloads.
 */

/** The GIF's frame rate, and the reason every hold below is a multiple of it. */
export const FPS = 8
export const FRAME_MS = 1000 / FPS

/** Each hold, in the order the recording visits it. */
export const HOLDS = [
  { name: 'the flat map at section grain, which is the claim', ms: 1125 },
  { name: 'paragraph grain, where structure starts to show', ms: 1000 },
  { name: 'line grain, the map the page is arguing for', ms: 1250 },
  { name: 'back to section grain, so the comparison closes', ms: 625 },
  { name: 'the JSON control pasted in', ms: 500 },
  { name: 'the scroll to the one region that goes dark', ms: 1125 },
]

/**
 * A state has to last long enough to be read and not so long that the picture
 * looks stopped. 900ms is `tokenlab`'s floor, measured there against a state
 * held 670ms that a recruiter pass could not describe afterwards.
 */
export const BEAT_MIN = 900
export const BEAT_MAX = 2500

/**
 * Two of the six are not states a reader stops at: the 625ms return to section
 * grain is a wipe between the argument and its control, and the 500ms before
 * the scroll is the paste landing. They are named here rather than exempted
 * silently.
 */
export const TRANSITIONS = new Set([3, 4])

/**
 * The frames kept before the first hold begins, so the loop does not open on
 * a click already in progress. The encoder seeks to `startedAt - LEAD_IN` and
 * runs for `LEAD_IN + the choreography`, so this number is part of the file's
 * expected length rather than a detail of the encode.
 */
export const LEAD_IN = 300

/**
 * How much longer the file may run than the holds and the lead in together.
 * The clicks and the heatmap's redraw happen between the holds and they are
 * not free: `docs/capture.json` measured the whole action at 5.6s against
 * 5.45s of holds at tick 234, which is 0.15s. 0.5s is that with room, and it
 * is this tight only because the recording is now trimmed at both ends. Before
 * tick 235 the tail ran until the browser context closed and about 0.7s of the
 * file was pinned by nothing.
 */
export const OVERHEAD_MAX = 500

/**
 * The whole loop, as a reader experiences it. A reader gives a README picture
 * a few seconds, and the version filed as `PGIF-F1` ran 8.76s, so most of them
 * saw half the argument. This ceiling is about them; `OVERHEAD_MAX` above is
 * about whether the file is the script's output. They are different questions
 * and the audit of tick 234 was right that asserting one twice is not two
 * assertions.
 */
export const TOTAL_MAX = 7000

/** A held photograph inside a loop reads as a page that has stopped working. */
export const STILL_MAX = 900
