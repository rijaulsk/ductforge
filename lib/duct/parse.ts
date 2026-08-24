/* Turning what someone typed into a number.
 *
 * Inputs in this app hold the RAW STRING the user typed and are parsed only at
 * compute time. Parsing on every keystroke and writing the result back rewrites
 * "1." to "1" the moment someone tries to type "1.5", and makes an empty box
 * unreachable — you delete the last digit and it becomes 0.
 *
 * These parsers are total: every string maps to a number, nothing throws, and
 * nothing returns NaN. A field that cannot be read is zero, and a zero-sized
 * fitting simply produces zero area rather than a page of "NaN m²".
 *
 * FRACTIONS ARE THE POINT OF THIS FILE. An estimator working in imperial types
 * 1 1/2, not 1.5, and a sheet metal shop's drawings are dimensioned in eighths.
 * The previous version handed the whole string to `Number()`, which returns NaN
 * for every one of those — and NaN became 0, so "2 3/8" was silently a
 * zero-inch duct. Silently, because a zero dimension produces a zero area and
 * not an error.
 *
 * Nothing here rounds. A parsed dimension goes into the geometry at full
 * precision and is rounded only where it is displayed.
 */

/** A duct dimension in the user's own units. 100 m / 4000 in of duct in one
 * entry is already absurd; the cap exists so a pasted phone number cannot
 * print a quantity in scientific notation. */
const MAX_DIMENSION = 100_000;
const MAX_QTY = 100_000;

/** Whole number, then a fraction: "1 1/2", "1-1/2", "2 3/8". */
const MIXED = /^(\d+(?:\.\d+)?)[\s-]+(\d+)\s*\/\s*(\d+)$/;
/** Bare fraction: "1/2", "3 / 4". */
const FRACTION = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/;
/** Plain decimal: "950", "950.5", ".5" — and "1.2e+03", which is what a
 * spreadsheet hands you when a column has been formatted badly. Accepting it
 * costs nothing; the clamp still catches an absurd magnitude. */
const DECIMAL = /^\d*\.?\d+(?:e[+-]?\d+)?$/;

/**
 * Strip what people type around a number without touching the number.
 *
 * Thousands separators and unit marks go; INTERNAL SPACES DO NOT, because the
 * space in "1 1/2" is load-bearing — removing it first, as the old version
 * did, turns one and a half into eleven halves.
 */
function clean(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    /* Inch and foot marks, straight and typographic. */
    .replace(/["”″'’′]/g, "")
    /* A trailing unit someone copied in with the figure. */
    .replace(/\s*(mm|cm|in|ft|m)\.?$/, "")
    .trim();
}

/** The numeric value of a cleaned string, or null if it is not a number. */
function readNumber(c: string): number | null {
  const mixed = MIXED.exec(c);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denominator;
  }

  const fraction = FRACTION.exec(c);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  if (DECIMAL.test(c)) return Number(c);
  return null;
}

/**
 * A length, angle or any other non-negative numeric field, at FULL PRECISION.
 *
 * Clamped at the top only. No rounding, no truncation: what comes out of here
 * is what goes into the geometry.
 */
export function toNumber(input: string, max = MAX_DIMENSION): number {
  const c = clean(input);
  if (!c) return 0;
  const n = readNumber(c);
  if (n === null || !Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/** Piece count: a whole number, never zero — a line of nothing is not a line.
 * The floor here is deliberate and is not a precision loss: you cannot make
 * three and a half elbows. */
export function toQty(input: string): number {
  const n = Math.floor(toNumber(input, MAX_QTY));
  return n < 1 ? 1 : n;
}

/** A count of segments, gores or similar. Also legitimately an integer. */
export function toCount(input: string, min: number, max: number): number {
  const n = Math.round(toNumber(input, max));
  return Math.min(max, Math.max(min, n));
}

/** Waste allowance percentage. Capped at 100: an allowance above "double the
 * material" is a data-entry accident, not an estimate. Fractional allowances
 * are legitimate — 12.5% is a real figure — so this does not round. */
export function toWaste(input: string): number {
  return toNumber(input, 100);
}

/** An angle in degrees, at full precision. Clamped to a real sweep — a 0° or
 * 360° elbow is not a fitting, and the drawing engine cannot render one. */
export function toAngle(input: string): number {
  const n = toNumber(input, 359);
  return n < 1 ? 1 : n;
}
