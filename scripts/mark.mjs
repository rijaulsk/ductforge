/* The DuctForge mark, defined once.
 *
 * Both generators import it — the logo lockup and the favicon set — so the tab
 * icon and the wordmark's mark cannot drift apart. They did once: the favicon
 * was a stroked path and the logo was a filled band, and at a glance they were
 * two different symbols.
 *
 * A FLANGED, MITRED DUCT ELBOW. Owner's direction, 28 August 2026, from two
 * reference sheets; the geometry below is the "cut icon" variant of the first
 * one, read off at 16× with scripts/crop.mjs rather than from its thumbnail.
 * Three things are going on and every one of them is ductwork:
 *
 *   FLANGE PLATES   a detached square at each open end. Detached because a
 *                   flanged joint is two plates and a gasket, not a thickening
 *                   of the run. It is the detail that separates sheet-metal
 *                   duct from a pipe, a hose or a swoosh.
 *   MITRE SEAMS     a 45° gap across the band at each end, mirrored about the
 *                   bend — where an elbow's throat and heel pieces are cut and
 *                   joined. They fall below the pixel grid under about 24px,
 *                   which is correct: one mark, whose fine detail drops out.
 *   DIRECTION       level in from the left, then down. The mirror of this runs
 *                   up-then-right, which is the skeleton of a lowercase r —
 *                   that is what the previous mark and the second reference
 *                   sheet both were, and the reason neither survived.
 *
 * THE SEAMS ARE HOLES, NOT PAINT. They are subpaths of MARK_PATH and the whole
 * thing fills EVEN-ODD, so the gap shows whatever is behind the mark. Drawing
 * them as background-coloured strokes on top would look right on cream and
 * wrong on every other ground — cream slashes across the indigo app icon —
 * which is exactly the failure this construction exists to make impossible.
 * Any consumer that fills this path MUST use `MARK_FILL_RULE`.
 *
 * Everything is in a 100 × 100 box: the outer sweep touches the top and right
 * edges, the two plates touch the left and bottom, so it places at any size.
 */

/* PROPORTIONS, measured off the reference rather than guessed.
 *
 * The first attempt had GAP and SEAM at 4 against a band of 22 — nearly a
 * fifth of the duct's width. Rendered at 512 on the indigo tile they stopped
 * being joint lines and became slashes that severed the run into three
 * floating pieces. On the reference sheet both are HAIRLINES, about a twelfth
 * of the band, and that is the difference between a mark that reads as one
 * fitting with joints and a mark that reads as debris.
 */

/** Wall-to-wall width of the duct. */
export const BAND = 24;
/** Side of a flange plate, along the run. */
const PLATE = 22;
/** Standoff between a plate and the opening it serves. */
const GAP = 2;
/** Width of a mitre seam, measured along the run. */
const SEAM = 2;

const R_OUTER = 50;
/** Radius of the inside (throat) sweep. */
export const R_INNER = R_OUTER - BAND;

/* How far the straight legs run before the bend takes over. NOT a free
 * parameter: it is whatever puts the two plates exactly on the box edges. */
const LEGS = 50 - GAP - PLATE;
const END_X = 50 - LEGS;
const END_Y = 50 + LEGS;

const rect = (x, y, w, h) => `M${x} ${y}H${x + w}V${y + h}H${x}Z`;

/** The elbow and its two plates, with no seams cut in. */
export const MARK_BODY = [
  `M${END_X} ${50 - R_OUTER}`,
  `L50 ${50 - R_OUTER}`,
  `A${R_OUTER} ${R_OUTER} 0 0 1 ${50 + R_OUTER} 50`,
  `L${50 + R_OUTER} ${END_Y}`,
  `L${50 + R_INNER} ${END_Y}`,
  `L${50 + R_INNER} 50`,
  `A${R_INNER} ${R_INNER} 0 0 0 50 ${50 - R_INNER}`,
  `L${END_X} ${50 - R_INNER}`,
  "Z",
  rect(END_X - GAP - PLATE, 50 - R_OUTER, PLATE, BAND),
  rect(50 + R_INNER, END_Y + GAP, BAND, PLATE),
].join("");

/* The two seams, as parallelograms between parallel 45° lines.
 *
 * Deliberately NOT a perpendicular-offset strip: that one's corners stick out
 * past the band's edges, and under even-odd anything sticking out stops being
 * a hole and becomes a floating shard. Offsetting ALONG the run instead keeps
 * all four corners on the band's own edges. Each seam ends exactly where the
 * bend begins, which is why the numbers look chosen — they are. */
export const MARK_SEAMS = [
  `M${END_X} ${50 - R_OUTER}`,
  `L${END_X + SEAM} ${50 - R_OUTER}`,
  `L${END_X + BAND + SEAM} ${50 - R_INNER}`,
  `L${END_X + BAND} ${50 - R_INNER}`,
  "Z",
  `M${50 + R_INNER} ${END_Y}`,
  `L${50 + R_OUTER} ${END_Y - BAND}`,
  `L${50 + R_OUTER} ${END_Y - BAND - SEAM}`,
  `L${50 + R_INNER} ${END_Y - SEAM}`,
  "Z",
].join("");

export const MARK_PATH = MARK_BODY + MARK_SEAMS;

/** Fill rule MARK_PATH must be drawn with, or the seams fill in. */
export const MARK_FILL_RULE = "evenodd";

/**
 * How far the mark is inset when it sits on a tile, in the same 100 units.
 *
 * Bigger than it was for the old mark, and that is the point: the old one was
 * a solid corner that filled its box, this one is a band with two plates and a
 * lot of air in the lower left, so an inset tuned for the solid shape leaves
 * this one looking like a small sticker in the middle of a large square.
 * Checked by looking — see preview/icons.png.
 */
export const TILE_INSET = 19;

/**
 * The inset to use at a given pixel size, as a fraction.
 *
 * OPTICAL SIZING. `TILE_INSET` gives a large icon room to breathe. Apply the
 * same fraction at favicon size and the duct is two pixels wide with a margin
 * around it, which is a smudge. Small icons are not small versions of big
 * ones — every pixel is load-bearing, so the mark is pushed out towards the
 * tile's edges and the air is what gets sacrificed.
 *
 * Lives here rather than in the generator so `scripts/preview.mjs icons`
 * renders what actually ships. A verification sheet that quietly uses
 * different numbers from the build is worse than no verification sheet.
 */
export const insetFor = (size) => (size <= 48 ? 0.09 : TILE_INSET / 100);

/** A rounded square, for the icon's ground. */
export function roundedRect(size, radius) {
  const r = radius;
  const s = size;
  return [
    `M${r} 0`,
    `L${s - r} 0`,
    `A${r} ${r} 0 0 1 ${s} ${r}`,
    `L${s} ${s - r}`,
    `A${r} ${r} 0 0 1 ${s - r} ${s}`,
    `L${r} ${s}`,
    `A${r} ${r} 0 0 1 0 ${s - r}`,
    `L0 ${r}`,
    `A${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join("");
}

export const INDIGO = "#6467F2";
export const INDIGO_400 = "#8792FE";
export const CREAM = "#F7F3EB";
