/* The DuctForge mark, defined once.
 *
 * Both generators import it — the logo lockup and the favicon set — so the tab
 * icon and the lockup's mark cannot drift apart. They did once: the favicon was
 * a stroked path and the logo was a filled band, and at a glance they were two
 * different symbols.
 *
 * A DUCT ELBOW WITH ONE FLANGE JOINT. Owner's direction, 28 August 2026, from
 * the fourth reference sheet (logo4). Level in from the left, then down —
 * never the mirror of that, which runs up-then-right and is the skeleton of a
 * lowercase r; two earlier marks and one rejected reference sheet were exactly
 * that.
 *
 * THE MARK IS NEVER SHOWN WITHOUT ITS TILE. Owner's rule, same day. There is no
 * "bare mark" asset any more and there should not be one: the elbow alone is a
 * shape, the elbow in its rounded indigo square is the logo. Everywhere the
 * identity appears — the app header, the favicon, the app icon, the OG card,
 * the printed sheet — it is the tile. See `tileSvg` in make-logo.mjs and the
 * TILE constant that reaches the React side.
 *
 * WHAT CHANGED FROM THE PREVIOUS MARK, and why.
 *
 *   ONE CUT, NOT TWO, AND IT IS SQUARE.  Two 45° mitre seams were a drawing of
 *   a fabrication detail; this is the joint itself. A duct run is delivered in
 *   sections that bolt together at flanged ends, and the gap between two of
 *   them is a straight line across the duct, not a diagonal. One joint, drawn
 *   properly, says more than two seams drawn faintly.
 *
 *   ROUNDED CORNERS.  Every square end takes the same small radius. The
 *   previous mark was all hard corners inside a soft tile and the two argued;
 *   sharing a radius language is what makes the mark sit in the square rather
 *   than on it.
 *
 *   A THICKER BAND.  30 against the old 20. The mark is read at 24px in the
 *   app header more often than at any other size, and a thin channel with a
 *   gap in it is the first thing to break there.
 *
 * Everything is in a 100 × 100 box, filled corner to corner, so it places at
 * any size.
 */

/* PROPORTIONS, measured off logo4 rather than invented. */

/** Wall-to-wall width of the duct. */
export const BAND = 30;
/** Outer radius of the bend. */
export const R_OUTER = 48;
/** Radius of the inside (throat) sweep. */
export const R_INNER = R_OUTER - BAND;
/** Length of the detached end section, along the run. */
export const PIECE = 28;
/* The flange joint: the gap between that section and the rest of the run.
 *
 * This number has been wrong three times by being reasoned about, so it is
 * chosen by rendering five widths at three sizes and looking — `node
 * scripts/preview.mjs seams`. logo4's own gap is nearer 3.5, but the standing
 * complaint about every version of this mark has been that the detail cannot
 * be seen; 4.5 is legible at 32px and still reads as a joint rather than two
 * separate objects. */
export const JOINT = 4.5;
/** Corner radius on every square end. */
export const NIB = 5;

/**
 * The elbow and its detached end section.
 *
 * TWO DISJOINT SUBPATHS, which is worth stating because the previous mark's
 * cuts were HOLES and needed even-odd to show the ground through them. This
 * gap is simply the space between two closed shapes, so it renders correctly
 * under either fill rule. `MARK_FILL_RULE` is still exported and still passed
 * everywhere — it costs nothing and it keeps the contract if a hole ever comes
 * back — but nothing depends on it now.
 *
 * A factory rather than a constant so `scripts/preview.mjs seams` can render
 * several joint widths side by side and the choice can be made by looking.
 * That is how the last two widths were found to be wrong.
 */
export function elbow({ band = BAND, joint = JOINT, piece = PIECE, nib = NIB } = {}) {
  const rOuter = R_OUTER;
  const rInner = rOuter - band;
  /* Where the bend's outer arc leaves the top edge, and where its inner arc
   * meets the inner edge. Both follow from the radii; neither is a choice. */
  const arcX = 100 - rOuter;
  const cut = piece + joint;

  /* Clockwise from the cut end's top corner, so every convex turn is sweep 1. */
  const body = [
    `M${cut + nib} 0`,
    `L${arcX} 0`,
    `A${rOuter} ${rOuter} 0 0 1 100 ${rOuter}`,
    `L100 ${100 - nib}`,
    `A${nib} ${nib} 0 0 1 ${100 - nib} 100`,
    `L${100 - band + nib} 100`,
    `A${nib} ${nib} 0 0 1 ${100 - band} ${100 - nib}`,
    `L${100 - band} ${rOuter}`,
    `A${rInner} ${rInner} 0 0 0 ${arcX} ${band}`,
    `L${cut + nib} ${band}`,
    `A${nib} ${nib} 0 0 1 ${cut} ${band - nib}`,
    `L${cut} ${nib}`,
    `A${nib} ${nib} 0 0 1 ${cut + nib} 0`,
    "Z",
  ].join("");

  /* The delivered section on the other side of the joint: a rounded square of
   * the duct's own cross-section. */
  const end = [
    `M${nib} 0`,
    `L${piece - nib} 0`,
    `A${nib} ${nib} 0 0 1 ${piece} ${nib}`,
    `L${piece} ${band - nib}`,
    `A${nib} ${nib} 0 0 1 ${piece - nib} ${band}`,
    `L${nib} ${band}`,
    `A${nib} ${nib} 0 0 1 0 ${band - nib}`,
    `L0 ${nib}`,
    `A${nib} ${nib} 0 0 1 ${nib} 0`,
    "Z",
  ].join("");

  return { body, end, path: body + end };
}

const MARK = elbow();

/** The elbow without its detached end section. */
export const MARK_BODY = MARK.body;
/** That section alone. */
export const MARK_END = MARK.end;
export const MARK_PATH = MARK.path;

/** Fill rule MARK_PATH is drawn with. See `elbow` — belt and braces now. */
export const MARK_FILL_RULE = "evenodd";

/**
 * Corner radius of the icon tile, as a fraction of its side.
 *
 * Off logo4. Reads rounder than the number suggests because the mark inside
 * shares the radius language rather than fighting it.
 */
export const TILE_RADIUS = 0.24;

/** How far the mark is inset inside the tile, in the same 100 units. */
export const TILE_INSET = 21;

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
export const insetFor = (size) => (size <= 48 ? 0.1 : TILE_INSET / 100);

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

/* Every value below is `--ds-*` from app/globals.css, so the standalone files
 * and the in-app inline SVG render the same logo rather than two near-misses.
 *
 * The TILE is fixed in both themes — an app icon does not restyle itself — and
 * only the type follows the theme. Wordmark takes `--ds-accent` (indigo 600 /
 * indigo 400) rather than the tile's indigo 500, because that is the tone the
 * token table prescribes for reading, not for a filled ground. */
export const INDIGO = "#6467F2";
export const CREAM = "#F7F3EB";
/** `--ds-accent`: the wordmark's colour, light and dark. */
export const WORD_LIGHT = "#5251DA";
export const WORD_DARK = "#8792FE";
/** `--ds-body`: the byline's colour, light and dark. */
export const BYLINE_LIGHT = "#5E5A53";
export const BYLINE_DARK = "#D8D4CD";
