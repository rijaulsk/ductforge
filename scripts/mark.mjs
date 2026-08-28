/* The DuctForge mark, defined once.
 *
 * Both generators import it — the logo lockup and the favicon set — so the tab
 * icon and the lockup's mark cannot drift apart. They did once: the favicon was
 * a stroked path and the logo was a filled band, and at a glance they were two
 * different symbols.
 *
 * A FLANGED DUCT ELBOW: a bend with a delivered section standing off a joint
 * at each end. Owner's direction, 28 August 2026, from the fourth reference
 * sheet (logo4) plus a second joint at the foot, approved from a rendered
 * proposal.
 *
 * THREE RULES, ALL THE OWNER'S, ALL LOAD-BEARING.
 *
 *   IT RUNS LEVEL IN AND DROPS.  Never the mirror of that. Up-then-right is
 *   the skeleton of a lowercase r, and two earlier marks and one rejected
 *   reference sheet were exactly that before anybody noticed.
 *
 *   IT IS NEVER SHOWN WITHOUT ITS TILE.  There is no bare-mark asset and
 *   there should not be one: the elbow alone is a shape, the elbow in its
 *   rounded indigo square is the logo. Everywhere the identity appears — app
 *   header, favicon, app icon, OG card, printed sheet — it is the tile.
 *
 *   THE JOINTS ARE SQUARE, NOT DIAGONAL.  An earlier version drew two 45°
 *   mitre seams, which is a picture of a fabrication detail. This is the joint
 *   itself: duct is delivered in sections that bolt together at flanged ends,
 *   and the gap between two of them is a straight line across the duct.
 *
 * ONE AT EACH END, because that is what a duct section is. The version that
 * shipped for a day had a flange on the inlet and a plain cut at the foot — a
 * piece that connects at one end only. The two are exact mirror images about
 * the shape's own axis of symmetry, which falls out of the geometry rather
 * than being eyeballed; see `endY` below.
 *
 * Every square end takes the same small radius, so the mark shares a language
 * with its tile instead of sitting hard-cornered inside a soft square.
 *
 * Everything is in a 100 × 100 box, filled corner to corner, so it places at
 * any size.
 */

/* PROPORTIONS, measured off logo4 rather than invented. */

/* Owner's call, 28 Aug 2026: a little thicker, and more air inside the tile.
 * 30 → 34 on the band and 21 → 25 on the inset. The mark had been drawn to fill
 * its box and a filled box has no breathing room; pulling it in and fattening
 * the duct at the same time keeps the same visual weight while the tile stops
 * feeling packed. */

/** Wall-to-wall width of the duct. */
export const BAND = 34;
/** Outer radius of the bend. The throat's follows: R_OUTER − BAND. */
export const R_OUTER = 48;
/** Length of a delivered section, along the run. */
export const PIECE = 28;
/* The flange joint: the gap between that section and the rest of the run.
 *
 * This number has been wrong three times by being reasoned about, so it is
 * chosen by rendering five widths at three sizes and looking — `node
 * scripts/preview.mjs joint`. logo4's own gap is nearer 3.5, but the standing
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
 * A factory rather than a constant so `scripts/preview.mjs joint` can render
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
  /* The run stops short at the foot by the same piece-plus-gap the inlet gives
   * up, which is what makes the two ends exact mirror images about the shape's
   * own axis of symmetry (y = 100 − x). Not eyeballed — it falls out. */
  const endY = 100 - cut;

  /* Clockwise from the cut end's top corner, so every convex turn is sweep 1. */
  const body = [
    `M${cut + nib} 0`,
    `L${arcX} 0`,
    `A${rOuter} ${rOuter} 0 0 1 100 ${rOuter}`,
    `L100 ${endY - nib}`,
    `A${nib} ${nib} 0 0 1 ${100 - nib} ${endY}`,
    `L${100 - band + nib} ${endY}`,
    `A${nib} ${nib} 0 0 1 ${100 - band} ${endY - nib}`,
    `L${100 - band} ${rOuter}`,
    `A${rInner} ${rInner} 0 0 0 ${arcX} ${band}`,
    `L${cut + nib} ${band}`,
    `A${nib} ${nib} 0 0 1 ${cut} ${band - nib}`,
    `L${cut} ${nib}`,
    `A${nib} ${nib} 0 0 1 ${cut + nib} 0`,
    "Z",
  ].join("");

  /** A rounded rectangle, clockwise. Both delivered sections are one. */
  const plate = (x, y, w, h) =>
    [
      `M${x + nib} ${y}`,
      `L${x + w - nib} ${y}`,
      `A${nib} ${nib} 0 0 1 ${x + w} ${y + nib}`,
      `L${x + w} ${y + h - nib}`,
      `A${nib} ${nib} 0 0 1 ${x + w - nib} ${y + h}`,
      `L${x + nib} ${y + h}`,
      `A${nib} ${nib} 0 0 1 ${x} ${y + h - nib}`,
      `L${x} ${y + nib}`,
      `A${nib} ${nib} 0 0 1 ${x + nib} ${y}`,
      "Z",
    ].join("");

  /* The delivered sections on the other side of each joint: a rounded
   * rectangle of the duct's own cross-section. The inlet's lies along the run,
   * the foot's is the same rectangle turned, so both read as one piece of duct
   * standing off a flange rather than as two different objects. */
  const end = plate(0, 0, piece, band);
  const foot = plate(100 - band, 100 - piece, band, piece);

  return { body, end, foot, path: body + end + foot };
}

/** The mark: the bend and both delivered sections, as one path. */
export const MARK_PATH = elbow().path;

/**
 * Fill rule MARK_PATH is drawn with.
 *
 * The three subpaths are disjoint, so either rule renders this mark correctly
 * — an earlier version cut its joints as HOLES and genuinely depended on
 * even-odd. Kept and still passed everywhere because it costs nothing and it
 * keeps the contract if a hole ever comes back.
 */
export const MARK_FILL_RULE = "evenodd";

/**
 * Corner radius of the icon tile, as a fraction of its side.
 *
 * Off logo4. Reads rounder than the number suggests because the mark inside
 * shares the radius language rather than fighting it.
 */
export const TILE_RADIUS = 0.24;

/** How far the mark is inset inside the tile, in the same 100 units. */
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
