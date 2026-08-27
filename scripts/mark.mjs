/* The DuctForge mark, defined once.
 *
 * Both generators import it — the logo lockup and the favicon set — so the tab
 * icon and the wordmark's mark cannot drift apart. They did once: the favicon
 * was a stroked path and the logo was a filled band, and at a glance they were
 * two different symbols.
 *
 * A 90° elbow with EQUAL LEGS, drawn as a band with a bore rather than as a
 * single stroke. The first version had a long vertical leg and a short
 * horizontal one, which is the shape of a lowercase r — not what a duct
 * calculator's mark should look like. Equal legs read as a bend.
 *
 * Everything is in a 100 × 100 box, so it places at any size.
 */

export const BAND = 26;
export const R_INNER = 18;
export const R_OUTER = R_INNER + BAND;
const CX = 50;
const CY = 50;

export const MARK_PATH = [
  `M${CX - R_OUTER} 100`,
  `L${CX - R_OUTER} ${CY}`,
  `A${R_OUTER} ${R_OUTER} 0 0 1 ${CX} ${CY - R_OUTER}`,
  `L100 ${CY - R_OUTER}`,
  `L100 ${CY - R_INNER}`,
  `L${CX} ${CY - R_INNER}`,
  `A${R_INNER} ${R_INNER} 0 0 0 ${CX - R_INNER} ${CY}`,
  `L${CX - R_INNER} 100`,
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
