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
];
