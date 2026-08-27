/* The DuctForge mark, defined once.
 *
 * Both generators import it — the logo lockup and the favicon set — so the tab
 * icon and the wordmark's mark cannot drift apart. They did once: the favicon
 * was a stroked path and the logo was a filled band, and at a glance they were
 * two different symbols.
 *
 * A SQUARE-BACKED ELBOW: mitred heel, radiused throat. Arrived at by drawing
 * the alternatives and looking at them — see scripts/mark-candidates.mjs for
 * the ones that were rejected and why.
 *
 * The short version. A fully radiused bend is a CURVE, and a curve is the most
 * generic mark there is: a swoosh, a lowercase r, half a hundred other logos.
 * A square-to-round transition is more descriptive on paper and reads as a
 * megaphone in the eye. What separates duct from pipe is that duct is
 * rectangular, and a rectangular bend is mitred on the outside while it sweeps
 * on the inside — an asymmetry a round pipe cannot produce. That asymmetry is
 * the mark: it says sheet metal, it cannot be mistaken for a swoosh, and it is
 * still solid at sixteen pixels, where the flanged variants turned to mush.
 *
 * Everything is in a 100 × 100 box, so it places at any size. It deliberately
 * fills the box corner to corner: a mark that occupies only a diagonal band
 * looks small beside its own wordmark.
 */

/** Radius of the inside (throat) sweep. */
export const R_INNER = 20;
/** Wall-to-wall width of the duct. */
export const BAND = 30;

export const MARK_PATH = [
  "M0 100",
  "L0 0",
  "L100 0",
  `L100 ${BAND}`,
  `L50 ${BAND}`,
  `A${R_INNER} ${R_INNER} 0 0 0 ${BAND} 50`,
  `L${BAND} 100`,
  "Z",
].join("");

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
