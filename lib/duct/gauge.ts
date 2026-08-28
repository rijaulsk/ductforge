import { material } from "./material";
import type { GaugeName, MaterialKey } from "./types";
import { MM_PER_INCH, type UnitSystem, densityFromKgM2 } from "./units";

/* Sheet gauge selection and sheet weight.
 *
 * WHAT IS STORED AND WHAT IS DERIVED. Only the thickness is stored. Every
 * density figure in the SMACNA table — 4.32, 5.50, 6.67, 7.85, 9.42,
 * 12.56 kg/m² — is exactly `7850 kg/m³ × thickness`, and every imperial figure
 * is exactly its metric one × 0.204816. Transcribing twelve constants by hand
 * is twelve chances to typo a number nobody would ever notice was wrong, so
 * they are computed. check-duct.mjs asserts the derivation reproduces the
 * published table.
 *
 * WHAT THIS SIMPLIFIES, STATED PLAINLY. Real SMACNA gauge selection depends on
 * duct pressure class and reinforcement spacing as well as size. This table is
 * the common size-only shortcut. It is a starting point, not a substitute for
 * the project specification — which is why every entry can override the gauge
 * by hand, and why /standards says all of this out loud.
 *
 * The metric and imperial bands are NOT conversions of each other: 12" is
 * 304.8 mm, not 300 mm. They are two published tables and a job is graded on
 * the one matching its own units.
 */

/** Kept as a named constant because it is the figure the published SMACNA
 * density column is derived from, and /standards says so. Other materials come
 * from material.ts. */
export const STEEL_DENSITY_KG_M3 = 7850;

/**
 * The caveat round duct carries and rectangular duct does not.
 *
 * SMACNA publishes a SEPARATE, generally lighter gauge table for round and
 * spiral duct, because a cylinder is far stiffer than a flat panel of the same
 * span. Grading round duct on the rectangular table — which is what this app
 * does, having only that table — therefore OVER-specifies it. That is the safe
 * direction to be wrong in, but it is still wrong, and an estimator pricing
 * spiral will notice the weight is high.
 *
 * Stated in the UI beside the gauge, on /standards, and in every export.
 */
export const ROUND_GAUGE_CAVEAT =
  "Round duct is graded on the rectangular table here, because that is the table this app has. SMACNA publishes a separate and generally lighter one for round and spiral duct — a cylinder is stiffer than a flat panel — so this over-specifies. Override the gauge on any line where your specification differs.";

/** Nominal commercial sheet: 1200 × 2400 mm / 4' × 8'. */
export const SHEET_AREA_M2 = 2.88;
export const SHEET_AREA_FT2 = 32;

export type GaugeBand = {
  gauge: GaugeName;
  thicknessMm: number;
  /** Upper bound of the band's largest-dimension range, null = no upper bound. */
  maxMm: number | null;
  maxIn: number | null;
};

export const GAUGE_BANDS: readonly GaugeBand[] = [
  { gauge: "26", thicknessMm: 0.55, maxMm: 300, maxIn: 12 },
  { gauge: "24", thicknessMm: 0.7, maxMm: 750, maxIn: 30 },
  { gauge: "22", thicknessMm: 0.85, maxMm: 1000, maxIn: 40 },
  { gauge: "20", thicknessMm: 1.0, maxMm: 1500, maxIn: 60 },
  { gauge: "18", thicknessMm: 1.2, maxMm: 2100, maxIn: 84 },
  { gauge: "16", thicknessMm: 1.6, maxMm: null, maxIn: null },
];

export const GAUGE_NAMES: readonly GaugeName[] = GAUGE_BANDS.map((b) => b.gauge);

export function bandFor(gauge: GaugeName): GaugeBand {
  const band = GAUGE_BANDS.find((b) => b.gauge === gauge);
  /* Unreachable via the type, but a corrupt imported project could ask for a
   * gauge that no longer exists; falling back beats throwing inside a render. */
  return band ?? GAUGE_BANDS[GAUGE_BANDS.length - 1];
}

/** Exact sheet mass per unit area before rounding, kg/m². */
export function densityKgM2Exact(thicknessMm: number, mat: MaterialKey = "gi"): number {
  return (thicknessMm / 1000) * material(mat).density;
}

/** The published metric figure: exact density rounded to 2 dp. At 7850 kg/m³,
 * 0.55 mm gives 4.3175, which is the table's 4.32. Internal — callers want
 * `densityDisplay`, which knows about unit systems. */
function densityKgM2(thicknessMm: number, mat: MaterialKey = "gi"): number {
  return Number(densityKgM2Exact(thicknessMm, mat).toFixed(2));
}

/**
 * Sheet mass per unit area in the user's units (kg/m² or lb/ft²).
 *
 * The imperial column is derived from the ROUNDED metric one, then rounded to
 * 3 dp — that is what reproduces the published 0.885 / 1.126 / 1.366 / 1.608 /
 * 1.929 / 2.572 exactly. Converting from the unrounded density instead gives
 * 0.884 for 26 ga, which is off the table by a digit nobody would ever trace.
 */
export function densityDisplay(
  thicknessMm: number,
  us: UnitSystem,
  mat: MaterialKey = "gi",
): number {
  const metric = densityKgM2(thicknessMm, mat);
  if (us === "metric") return metric;
  return Number(densityFromKgM2(metric, us).toFixed(3));
}

/**
 * The gauge the size-only table calls for, graded against the band table of
 * the project's own unit system.
 */
export function selectGauge(maxDimMm: number, us: UnitSystem): GaugeName {
  if (us === "imperial") {
    const inches = maxDimMm / MM_PER_INCH;
    /* 1e-9 absorbs the float noise of an exact 12" typed as 304.8 mm, which
     * would otherwise land one band heavier than the estimator expects. */
    const band = GAUGE_BANDS.find((b) => b.maxIn !== null && inches <= b.maxIn + 1e-9);
    return (band ?? GAUGE_BANDS[GAUGE_BANDS.length - 1]).gauge;
  }
  const band = GAUGE_BANDS.find((b) => b.maxMm !== null && maxDimMm <= b.maxMm + 1e-9);
  return (band ?? GAUGE_BANDS[GAUGE_BANDS.length - 1]).gauge;
}

/** How the band is described in the UI, in the user's own units. */
export function bandRange(band: GaugeBand, us: UnitSystem): string {
  const i = GAUGE_BANDS.indexOf(band);
  const prev = i > 0 ? GAUGE_BANDS[i - 1] : null;
  if (us === "imperial") {
    if (band.maxIn === null) return `over ${prev?.maxIn ?? 0}″`;
    return prev ? `${prev.maxIn! + 1}″ – ${band.maxIn}″` : `up to ${band.maxIn}″`;
  }
  if (band.maxMm === null) return `over ${prev?.maxMm ?? 0} mm`;
  return prev ? `${prev.maxMm! + 1} – ${band.maxMm} mm` : `up to ${band.maxMm} mm`;
}

/**
 * Commercial sheets a gauge group needs.
 *
 * ESTIMATE, and labelled as one everywhere it appears: it divides area by
 * sheet area and rounds up. Real nesting reuses offcuts across fittings and
 * loses area to blank shapes that do not tile, so the true figure moves in
 * both directions. It is computed per gauge and never on a grand total —
 * 22 ga cannot be cut from a 24 ga sheet.
 */
export function sheetCount(area: number, us: UnitSystem): number {
  const sheet = us === "metric" ? SHEET_AREA_M2 : SHEET_AREA_FT2;
  return Math.ceil(area / sheet - 1e-9);
}
