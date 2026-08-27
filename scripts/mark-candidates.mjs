/* Candidate marks, for looking at. `node scripts/preview.mjs marks`
 *
 * THE BRIEF: say what the thing is; work at 16px; one idea; fill a square; be
 * ownable.
 *
 * ROUND 1 — elbow variants. The plain elbow band is a curve, and a curve is
 * the most generic mark there is. Confirmed by looking: it could be any of a
 * hundred logos.
 *
 * ROUND 2 — square to round. Descriptive on paper and WRONG in the eye: a wide
 * taper into a circle reads as a megaphone, or a play button next to an O.
 * Being able to name the fitting does not make it a good silhouette.
 *
 * ROUND 3, here — what actually separates DUCT from pipe. Two things, and
 * neither is the bend itself: duct is RECTANGULAR in section, and it is joined
 * with FLANGES. A curve with a flange on each end is sheet metal ductwork; the
 * same curve without them is a pipe, a hose, or a swoosh. And a square-backed
 * heel with a radiused throat — how a mitred rectangular elbow is actually
 * made — is a silhouette a round pipe cannot have.
 *
 * All candidates are drawn in a 100 × 100 box.
 */

const rect = (x, y, w, h) => `M${x} ${y}H${x + w}V${y + h}H${x}Z`;

/** The radiused elbow band the first mark used. */
function band(rInner, width, { legs = 50 } = {}) {
  const rOuter = rInner + width;
  return [
    `M${50 - rOuter} ${50 + legs}`,
    `L${50 - rOuter} 50`,
    `A${rOuter} ${rOuter} 0 0 1 50 ${50 - rOuter}`,
    `L${50 + legs} ${50 - rOuter}`,
    `L${50 + legs} ${50 - rInner}`,
    `L50 ${50 - rInner}`,
    `A${rInner} ${rInner} 0 0 0 ${50 - rInner} 50`,
    `L${50 - rInner} ${50 + legs}`,
    "Z",
  ].join("");
}

/**
 * A SQUARE-BACKED elbow: mitred heel, radiused throat.
 *
 * This is how a rectangular duct bend is actually made, and it is a shape a
 * round pipe cannot produce — the outside turns a corner while the inside
 * sweeps. That asymmetry is the whole point: it stops the mark being a curve.
 */
function squareBacked(rInner, width, { legs = 50 } = {}) {
  const outer = 50 - rInner - width;
  return [
    `M${outer} ${50 + legs}`,
    `L${outer} ${outer}`,
    `L${50 + legs} ${outer}`,
    `L${50 + legs} ${50 - rInner}`,
    `L50 ${50 - rInner}`,
    `A${rInner} ${rInner} 0 0 0 ${50 - rInner} 50`,
    `L${50 - rInner} ${50 + legs}`,
    "Z",
  ].join("");
}

/**
 * The same elbow MIRRORED: horizontal leg top-left, vertical leg bottom-right.
 *
 * This is the difference between the owner's two reference sheets, and it is
 * not a small one. `band()` above runs up-then-right — a stem with a shoulder
 * on it, which is the skeleton of a lowercase r. Run the other way, the duct
 * comes in level and drops, which is what a duct does and what no letter does.
 */
function bandDown(rInner, width, { legs = 44 } = {}) {
  const rOuter = rInner + width;
  return [
    `M${50 - legs} ${50 - rOuter}`,
    `L50 ${50 - rOuter}`,
    `A${rOuter} ${rOuter} 0 0 1 ${50 + rOuter} 50`,
    `L${50 + rOuter} ${50 + legs}`,
    `L${50 + rInner} ${50 + legs}`,
    `L${50 + rInner} 50`,
    `A${rInner} ${rInner} 0 0 0 50 ${50 - rInner}`,
    `L${50 - legs} ${50 - rInner}`,
    "Z",
  ].join("");
}

/**
 * The flange plates for `bandDown`, one at each open end.
 *
 * A plate stands PROUD of the duct wall on both sides — that is what you bolt
 * through — and there is a gap between it and the run because a flanged joint
 * is two plates and a gasket, not a thickening of the pipe. Both details are
 * what stop a bent band reading as a hose.
 */
function flangesDown(rInner, width, { legs = 44, plate = 12, proud = 5 } = {}) {
  const rOuter = rInner + width;
  return [
    /* At the horizontal end: a bar across the opening, proud top and bottom. */
    rect(50 - legs, 50 - rOuter - proud, plate, width + proud * 2),
    /* At the vertical end: the same, turned. */
    rect(50 + rInner - proud, 50 + legs - plate, width + proud * 2, plate),
  ].join("");
}

/**
 * ROUND 5 — the synthesis. The shipping mark's weight, sheet 1's direction.
 *
 * Square outer corner (a mitred heel — how a rectangular bend is actually
 * made, and a silhouette a round pipe cannot have), radiused throat, filling
 * its box, running LEVEL IN FROM THE LEFT AND DROPPING. That last part is the
 * whole reason to redraw: the shipping mark and sheet 2 both run up-then-right,
 * which is the skeleton of a lowercase r.
 *
 * `pad` insets the whole mark, for sitting it inside a tile with air around it.
 */
function elbowDown({ pad = 0, band = 30, rInner = 20 } = {}) {
  const a = pad;
  const b = 100 - pad;
  return [
    `M${a} ${a}`,
    `L${b} ${a}`,
    `L${b} ${b}`,
    `L${b - band} ${b}`,
    `L${b - band} ${a + band + rInner}`,
    `A${rInner} ${rInner} 0 0 0 ${b - band - rInner} ${a + band}`,
    `L${a} ${a + band}`,
    "Z",
  ].join("");
}

/** A thin quad from P to Q — a drawn LINE, for the seam gaps. */
function slab(x1, y1, x2, y2, t) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * (t / 2);
  const ny = (dx / len) * (t / 2);
  return `M${x1 + nx} ${y1 + ny}L${x2 + nx} ${y2 + ny}L${x2 - nx} ${y2 - ny}L${x1 - nx} ${y1 - ny}Z`;
}

/**
 * SHEET 1's CUT ICON, drawn as real geometry.
 *
 * Read off logo1.png at 16× (scripts/crop.mjs) rather than from the thumbnail,
 * which is how I missed it the first time. Three things are going on and all
 * three are ductwork, not decoration:
 *
 *   the FLANGE PLATES  — a detached square at each open end. Detached because a
 *                        flanged joint is two plates and a gasket, not a
 *                        thickening of the run.
 *   the MITRE SEAMS    — a 45° line across the band at each end, mirrored about
 *                        the bend. That is where an elbow's throat and heel
 *                        pieces are cut and joined. It is the single most
 *                        trade-literate mark on either sheet.
 *   the DIRECTION      — level in from the left, dropping. Sheet 2 runs the
 *                        other way, which is the skeleton of a lowercase r.
 *
 * Proportioned so the whole thing fills the 100 box: the outer sweep touches
 * the top and right edges, the two plates touch the left and bottom.
 *
 * `cuts` are returned separately because they are drawn in the GROUND colour on
 * top of the body — a gap, not a stroke — so they invert correctly when the
 * mark is knocked out of a tile.
 */
function cutElbow({ pad = 0, width = 22, plate = 22, gap = 4, seam = 3 } = {}) {
  const rOuter = 50 - pad;
  const rInner = rOuter - width;
  /* Not a free parameter: the legs are however long they must be for the two
   * plates to land exactly on the inset box's left and bottom edges. */
  const legs = 50 - pad - gap - plate;
  const endX = 50 - legs;
  const endY = 50 + legs;

  const body = [
    /* The band: in level at the top, out downward at the right. */
    `M${endX} ${50 - rOuter}`,
    `L50 ${50 - rOuter}`,
    `A${rOuter} ${rOuter} 0 0 1 ${50 + rOuter} 50`,
    `L${50 + rOuter} ${endY}`,
    `L${50 + rInner} ${endY}`,
    `L${50 + rInner} 50`,
    `A${rInner} ${rInner} 0 0 0 50 ${50 - rInner}`,
    `L${endX} ${50 - rInner}`,
    "Z",
    /* The two flange plates, standing off their openings. */
    rect(endX - gap - plate, 50 - rOuter, plate, width),
    rect(50 + rInner, endY + gap, width, plate),
  ].join("");

  const cuts = [
    slab(endX, 50 - rOuter, endX + width, 50 - rInner, seam),
    slab(50 + rInner, endY - width, 50 + rOuter, endY, seam),
  ].join("");

  return { body, cuts };
}

const TILE =
  "M22 0H78A22 22 0 0 1 100 22V78A22 22 0 0 1 78 100H22A22 22 0 0 1 0 78V22A22 22 0 0 1 22 0Z";

export const CANDIDATES = [
  {
    name: "G · square-backed elbow — mitred heel, radiused throat",
    d: squareBacked(20, 30, { legs: 50 }),
  },
  {
    name: "H · square-backed elbow with flanges",
    d: [squareBacked(20, 26, { legs: 44 }), rect(-2, 88, 34, 12), rect(88, -2, 12, 34)].join(""),
  },
  {
    name: "I · radiused elbow with flanges",
    d: [band(18, 26, { legs: 44 }), rect(2, 88, 40, 12), rect(88, 2, 12, 40)].join(""),
  },
  {
    name: "J · square-backed elbow on a tile",
    ground: TILE,
    d: squareBacked(16, 22, { legs: 34 }),
  },
  {
    name: "K · flanged square-backed elbow on a tile",
    ground: TILE,
    d: [squareBacked(15, 20, { legs: 30 }), rect(11, 72, 28, 9), rect(72, 11, 9, 28)].join(""),
  },
  {
    name: "L · the current elbow, for comparison",
    d: "M6 100L6 50A44 44 0 0 1 50 6L100 6L100 32L50 32A18 18 0 0 0 32 50L32 100Z",
  },

  /* ---- ROUND 4: the two sheets the owner supplied, 27 Aug 2026 ----------
   *
   * logo1.png and logo2.png at the repo root. Redrawn rather than traced, so
   * all of them are judged on one rasteriser, at one size, beside the mark
   * that currently ships — and so the 16px test is a real test rather than a
   * downscaled JPEG of somebody's presentation slide.
   */
  {
    name: "M · sheet 1 — flanged elbow, level in and dropping",
    d: bandDown(12, 24, { legs: 44 }) + flangesDown(12, 24, { legs: 44 }),
  },
  {
    name: "N · sheet 1's elbow with no flanges, to show what they were doing",
    d: bandDown(12, 24, { legs: 44 }),
  },
  {
    name: "O · sheet 2 — the same band mirrored, knocked out of a tile",
    ground: TILE,
    d: band(13, 20, { legs: 30 }),
  },
  {
    name: "P · sheet 2's mark WITHOUT its tile — this is a lowercase r",
    d: band(13, 20, { legs: 30 }),
  },
  {
    name: "Q · sheet 1's elbow on sheet 2's tile",
    ground: TILE,
    d: bandDown(9, 18, { legs: 32 }) + flangesDown(9, 18, { legs: 32, plate: 9, proud: 4 }),
  },

  /* ---- ROUND 5: the synthesis, for the same comparison --------------- */
  {
    name: "R · SYNTHESIS — mitred heel, radiused throat, level in and dropping",
    d: elbowDown({ band: 30, rInner: 20 }),
  },
  {
    name: "S · the same, knocked out of a tile with air around it",
    ground: TILE,
    d: elbowDown({ pad: 17, band: 24, rInner: 15 }),
  },
  {
    name: "T · the same, lighter band and a wider throat",
    d: elbowDown({ band: 24, rInner: 30 }),
  },
];

/* ---- THE SHORTLIST, rendered big / medium / favicon --------------------
 *
 * `node scripts/preview.mjs final`. Four marks, one row each, at the three
 * sizes that decide it. Everything above is the working; this is the choice.
 */
const CUT = cutElbow();
const CUT_TILE = cutElbow({ pad: 17, width: 17, plate: 16, gap: 3, seam: 2.4 });

export const FINALISTS = [
  {
    name: "1 · Sheet 1's CUT icon — flange plates + 45° mitre seams",
    d: CUT.body,
    holes: CUT.cuts,
  },
  {
    name: "2 · The same with the seams closed — what it becomes when small",
    d: CUT.body,
  },
  {
    name: "3 · The cut icon knocked out of sheet 2's tile — the app icon",
    ground: TILE,
    d: CUT_TILE.body,
    holes: CUT_TILE.cuts,
  },
  {
    name: "4 · Sheet 2, for comparison — the same bend mirrored, which is an r",
    ground: TILE,
    d: band(13, 20, { legs: 30 }),
  },
];
