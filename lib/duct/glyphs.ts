import type { FittingKind } from "./types";

/* The fitting marks, as path data.
 *
 * Separated from the component so `scripts/preview.mjs` can render them to a
 * PNG and they can be LOOKED AT. That is not ceremony: the previous round
 * marks read as perfectly sensible coordinates and rendered with a stray dot
 * and a visible gap, neither of which is findable by reading numbers.
 *
 * Two rules the round ones live by:
 *
 * 1. AN ELLIPSE IS TWO ARCS. `M cx cy A rx ry 0 1 0 cx cy±ε` looks like a
 *    closed ellipse and is not: it starts at the CENTRE, so the browser draws
 *    something offset from where you meant, and the near-closed ends leave a
 *    round cap sitting in the middle of the duct like a dot. Both bugs came
 *    from that shorthand. `ellipse()` below starts on the edge and uses two
 *    half arcs, which is the only form that actually closes.
 *
 * 2. NEAR END FULL, FAR END HALF. A cylinder seen from the side shows the
 *    whole opening at the end nearest you and only the outer curve at the far
 *    end — drawing a full ellipse at both is the "double end" that made a
 *    round reducer's small end look like it had been closed twice.
 *
 *    The square-to-round is the exception and it earns it: its round end is the
 *    whole point of the mark, so it gets a full ellipse regardless of which way
 *    it faces. Drawn as a far-end half it was indistinguishable from a reducer,
 *    which is exactly what got reported.
 *
 * 44 × 28 box, 1.5px stroke, no fill.
 */

/** A closed ellipse, started on its edge. */
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;

/** The visible half of a far opening: the curve that bulges away from you. */
const farEnd = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx} ${cy - ry}A${rx} ${ry} 0 0 1 ${cx} ${cy + ry}`;

export const GLYPH_PATHS: Record<FittingKind, string> = {
  /* ---- rectangular: two walls, two square ends ---- */
  straight: "M4 8H40M4 20H40M4 8V20M40 8V20",
  transition: "M5 4L39 10M5 24L39 18M5 4V24M39 10V18",
  elbow: "M5 25V15A10 10 0 0 1 15 5H27M13 25V15A2 2 0 0 1 15 13H27M5 25H13M27 5V13",

  /* AN OFFSET DOES NOT TAPER, and the version this replaces did.
   *
   * It ran the top wall from y=6 to y=20 and the bottom from y=15 to y=25 —
   * two different slopes — so its end caps came out 9 and 5 units tall and the
   * duct narrowed along its length. A ductworker of ten years took one look at
   * it in the picker and said it was a taper. He was right, and nothing in the
   * app could contradict him: the formula and the blueprint were both correct,
   * so only the icon was lying.
   *
   * Both walls now share one slope and one section: caps of 9 at each end,
   * both diagonals Δ(12, 10). That is the property the check script asserts,
   * because "looks about right" is what let the old one through. */
  offset: "M4 5H16L28 15H40M4 14H16L28 24H40M4 5V14M40 15V24",

  collar: "M15 25V7M29 25V7M9 25H15M29 25H35M15 7H29",
  wye: "M4 9H16L30 3H40M4 20H16L30 26H40M16 9L30 15H40M4 9V20",

  /* ---- round: the opening is the whole point ---- */
  "round-straight": [
    "M9 5H35M9 23H35",
    ellipse(9, 14, 3, 9),
    farEnd(35, 14, 3, 9),
  ].join(""),

  "round-elbow": [
    "M5 25V15A10 10 0 0 1 15 5H27",
    "M13 25V15A2 2 0 0 1 15 13H27",
    farEnd(27, 9, 1.8, 4),
    "M5 25A4 1.5 0 0 0 13 25",
  ].join(""),

  "round-reducer": [
    "M9 5L35 10.5M9 23L35 17.5",
    ellipse(9, 14, 3, 9),
    farEnd(35, 14, 1.5, 3.5),
  ].join(""),

  /* SQUARE ONE END, ROUND THE OTHER — and the round end has to be a CIRCLE.
   *
   * The version this replaces ended with `farEnd(33, 14, 1.5, 3.5)`, which is
   * the identical 3 × 7 sliver the round reducer uses at its small end. Two
   * tapering walls plus that sliver is a reducer; the only thing separating
   * the two marks was the left end, and at picker size nobody could see it.
   * Reported as "still looks like a reducer", correctly.
   *
   * So: a FULL ellipse at a radius you cannot miss, and a square end drawn as
   * an open opening with a depth edge rather than the closed slab it was —
   * a filled-looking rectangle reads as a blanked end, not as a duct. */
  "square-to-round": [
    /* The square opening, face on. Short receding edges were tried to give it
     * depth and rendered as three whiskers hanging off the corners — at
     * 44 × 28 there is no room for perspective. A plain rectangle against a
     * plain ellipse is the whole idea, and the contrast carries it. */
    "M4 4H12V24H4Z",
    /* Walls to the circle's extremes, so the taper lands ON the ellipse rather
     * than running past it to a vanishing point. */
    "M12 4L31 6.5M12 24L31 21.5",
    ellipse(31, 14, 3.5, 7.5),
  ].join(""),
};
