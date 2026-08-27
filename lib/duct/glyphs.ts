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
 *    reducer's small end look like it had been closed twice.
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
  reducer: "M5 4L39 10M5 24L39 18M5 4V24M39 10V18",
  elbow: "M5 25V15A10 10 0 0 1 15 5H27M13 25V15A2 2 0 0 1 15 13H27M5 25H13M27 5V13",
  dropper: "M4 6H18L32 20H40M4 15H16L30 25H40M4 6V15M40 20V25",
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

  /* Square one end, round the other — it has to show both or it is just
   * another reducer. */
  "square-to-round": [
    "M5 4H13V24H5Z",
    "M13 4L33 10.5M13 24L33 17.5",
    farEnd(33, 14, 1.5, 3.5),
  ].join(""),
};
