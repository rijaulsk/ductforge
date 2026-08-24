/* Turning what someone typed into a number.
 *
 * Inputs in this app hold the RAW STRING the user typed and are parsed only at
 * compute time. Parsing on every keystroke and writing the result back rewrites
 * "1." to "1" under the cursor the moment they try to type "1.5", and makes an
 * empty box impossible to reach — you delete the last digit and it becomes 0.
 *
 * These parsers are total: every string maps to a number, nothing throws, and
 * nothing returns NaN. A field that cannot be read is zero, and a zero-sized
 * fitting simply produces zero area rather than a page of "NaN m²".
 */

/** A duct dimension in the user's own units. 100 m / 4000 in of duct in one
 * entry is already absurd; the cap exists so a pasted phone number cannot
 * print a quantity in scientific notation. */
const MAX_DIMENSION = 100_000;
const MAX_QTY = 100_000;

function clean(input: string): string {
  return input.trim().replace(/[,\s]/g, "");
}

/** A length, angle or any other non-negative numeric field. */
export function toNumber(input: string, max = MAX_DIMENSION): number {
  const c = clean(input);
  if (!c) return 0;
  const n = Number(c);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/** Piece count: a whole number, never zero — a line of nothing is not a line. */
export function toQty(input: string): number {
  const n = Math.floor(toNumber(input, MAX_QTY));
  return n < 1 ? 1 : n;
}

/** Waste allowance percentage. Capped at 100: an allowance above "double the
 * material" is a data-entry accident, not an estimate. */
export function toWaste(input: string): number {
  return toNumber(input, 100);
}

/** An angle in degrees. Clamped to a real sweep — a 0° or 360° elbow is not a
 * fitting, and the drawing engine cannot render one. */
export function toAngle(input: string): number {
  const n = toNumber(input, 359);
  return n < 1 ? 1 : n;
}
