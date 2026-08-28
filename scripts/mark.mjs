/* The DuctForge mark, defined once.
 *
 * Both generators import it — the logo lockup and the favicon set — so the tab
 * icon and the wordmark's mark cannot drift apart. They did once: the favicon
 * was a stroked path and the logo was a filled band, and at a glance they were
 * two different symbols.
 *
 * A DUCT ELBOW WITH TWO MITRE CUTS. Owner's direction, 28 August 2026, third
 * reference sheet (logo3). Level in from the left, then down — never the
 * mirror of that, which runs up-then-right and is the skeleton of a lowercase
 * r; two earlier marks and one rejected reference sheet were exactly that.
 *
 * WHAT CHANGED, AND WHY THE PREVIOUS ONE WAS WRONG.
 *
 * It carried flange plates as well as the seams. Four separate gaps in a shape
 * this small: the eye read fragments, not a fitting, and every one of the four
 * had to be a hairline to stop the mark falling apart — at which point none of
 * them was visible at any size anybody actually sees the icon. Two details
 * fighting for the same small space and both losing.
 *
 * So: one detail, stated properly. The plates are gone, the silhouette is the
 * clean bend of the reference, and the two cuts get the room they need to be
 * seen. Subtraction, which is the usual answer when a small mark is busy.
 *
 * WHERE THE CUTS SIT is not a look, it is a fact about the object. Each one
 * lands exactly on the tangent point where the straight leg meets the bend —
 * where a fabricated elbow's straight sections are joined to it. That also
 * makes them mirror images of each other about the shape's own axis of
 * symmetry (the anti-diagonal), so the mark stays balanced.
 *
 * THE CUTS ARE HOLES, NOT PAINT. They are subpaths of MARK_PATH and the whole
 * thing fills EVEN-ODD, so a cut shows whatever is behind the mark. Drawing
 * them as background-coloured strokes on top would look right on cream and
 * wrong everywhere else — cream slashes across the indigo app icon — which is
 * exactly the failure this construction exists to make impossible. Any
 * consumer that fills this path MUST use `MARK_FILL_RULE`.
 *
 * Everything is in a 100 × 100 box, filled corner to corner, so it places at
 * any size.
 */

/* PROPORTIONS, measured off logo3 rather than invented.
 *
 * BAND at 20 is the reference's: a channel, not a pipe. The previous mark ran
 * 24 with plates on the end and read heavy and busy.
 *
 * SEAM is the number this revision exists to get right, and it has been wrong
 * in both directions: at 4 against a band of 24, with four gaps in the shape,
 * the cuts severed the duct into floating pieces; the correction to 2 made
 * them invisible at every size below a poster. Chosen this time by rendering
 * five widths at three sizes and looking — `node scripts/preview.mjs seams`.
 *
 * 3.5 against a band of 20 is visible on a phone home screen, which is the
 * size that decides it, and still reads as a cut rather than a break. Dropping
 * the flange plates is what bought the room: two details in a shape this small
 * meant both had to be hairlines, and a detail nobody can see is not a detail.
 */

/** Wall-to-wall width of the duct. */
export const BAND = 20;
/** Width of a mitre cut, measured along the run. */
export const SEAM = 3.5;

const R_OUTER = 50;
/** Radius of the inside (throat) sweep. */
export const R_INNER = R_OUTER - BAND;

/**
 * The elbow, its two cuts, and the two as one even-odd path.
 *
 * A factory rather than three constants so `scripts/preview.mjs seams` can
 * render several widths side by side and the choice can be made by looking.
 * That is how both previous seam widths were found to be wrong.
 */
export function elbow({ band = BAND, seam = SEAM } = {}) {
  const rOuter = 50;
  const rInner = rOuter - band;

  const body = [
    /* Level in along the top, round the outside, down the right. */
    `M0 0`,
    `L50 0`,
    `A${rOuter} ${rOuter} 0 0 1 100 50`,
    `L100 100`,
    `L${100 - band} 100`,
    `L${100 - band} 50`,
    `A${rInner} ${rInner} 0 0 0 50 ${band}`,
    `L0 ${band}`,
    "Z",
  ].join("");

  /* Each cut is the parallelogram between two parallel 45° lines, offset ALONG
   * the run rather than perpendicular to it. A perpendicular strip's corners
   * stick out past the band's edges, and under even-odd anything sticking out
   * stops being a hole and becomes a floating shard. Offsetting along the run
   * keeps all four corners on the band's own edges.
   *
   * The leading edge runs from (50 − band, 0) to (50, band): its lower corner
   * is precisely where the inner arc begins. */
  const cuts = [
    `M${50 - band - seam} 0`,
    `L${50 - band} 0`,
    `L50 ${band}`,
    `L${50 - seam} ${band}`,
    "Z",
    /* The same cut reflected about y = 100 − x, the shape's own symmetry. */
    `M100 ${50 + band + seam}`,
    `L100 ${50 + band}`,
    `L${100 - band} 50`,
    `L${100 - band} ${50 + seam}`,
    "Z",
  ].join("");

  return { body, cuts, path: body + cuts };
}

const MARK = elbow();

/** The elbow with no cuts — the silhouette, for anywhere detail is pointless. */
export const MARK_BODY = MARK.body;
/** The two mitre cuts alone. */
export const MARK_SEAMS = MARK.cuts;
export const MARK_PATH = MARK.path;

/** Fill rule MARK_PATH must be drawn with, or the cuts fill in. */
export const MARK_FILL_RULE = "evenodd";

/**
 * Corner radius of the icon tile, as a fraction of its side.
 *
 * 0.30, up from 0.22, off logo3 — a soft squircle rather than a rounded
 * rectangle. With a mark this light inside it, a tighter corner made the tile
 * read as the dominant object and the duct as something printed on it.
 */
export const TILE_RADIUS = 0.3;

/**
 * How far the mark is inset when it sits on a tile, in the same 100 units.
 *
 * A quarter of the tile, off logo3, and much more air than the previous mark
 * was given. A small mark in a generous field reads as considered; the same
 * mark pushed out to the edges reads as a screenshot of something bigger.
 */
export const TILE_INSET = 25;

/**
 * The inset to use at a given pixel size, as a fraction.
 *
 * OPTICAL SIZING. `TILE_INSET` gives a large icon room to breathe. Apply the
 * same fraction at favicon size and the duct is two pixels wide with a wide
 * margin around it, which is a smudge in a box. Small icons are not small
 * versions of big ones — every pixel is load-bearing, so the mark is pushed
 * out towards the tile's edges and the air is what gets sacrificed.
 *
 * Lives here rather than in the generator so `scripts/preview.mjs icons`
 * renders what actually ships. A verification sheet that quietly uses
 * different numbers from the build is worse than no verification sheet.
 */
export const insetFor = (size) => (size <= 48 ? 0.08 : TILE_INSET / 100);

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
