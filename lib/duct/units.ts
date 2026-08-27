/* Unit handling.
 *
 * THE RULE THAT KEEPS THIS APP CORRECT: every dimension in the engine is in
 * MILLIMETRES and every angle is in DEGREES. Imperial exists only at the two
 * boundaries — the input box converts in, the display converts out. No formula
 * in lib/duct/formulas.ts branches on unit system, and none ever should: a
 * duplicated formula is a formula that will drift, and a duct area that is
 * wrong by a factor of 25.4 does not look wrong on screen.
 *
 * Areas and masses are a separate matter. They are held as INTEGER minor units
 * of whatever the user is looking at (thousandths of m²/ft², hundredths of
 * kg/lb) so that a schedule's printed total is exactly the sum of its printed
 * rows. Floating-point m² summed and then rounded gives a total that disagrees
 * with the visible lines by a gram or a millimetre, and an estimator who spots
 * that stops trusting every other number on the page.
 */

export type UnitSystem = "metric" | "imperial";

export const MM_PER_INCH = 25.4;
export const MM2_PER_M2 = 1_000_000;
/** 144 in² × 25.4² — exact, not rounded. */
export const MM2_PER_FT2 = 92_903.04;
export const KG_PER_LB = 0.453_592_37;

/** Precision the app rounds to, and therefore the precision it sums at. */
export const AREA_DECIMALS = 3; // 0.001 m² / ft²
export const MASS_DECIMALS = 2; // 0.01 kg / lb

export const AREA_SCALE = 1000; // minor units per display area unit
export const MASS_SCALE = 100; // minor units per display mass unit
export const RUN_SCALE = 100; // minor units per metre / foot
export const VALUE_SCALE = 100; // minor units per whatever the rate is in

export function lengthUnit(us: UnitSystem): string {
  return us === "metric" ? "mm" : "in";
}

export function areaUnit(us: UnitSystem): string {
  return us === "metric" ? "m²" : "ft²";
}

export function squareLengthUnit(us: UnitSystem): string {
  return us === "metric" ? "mm²" : "in²";
}

export function massUnit(us: UnitSystem): string {
  return us === "metric" ? "kg" : "lb";
}

export function densityUnit(us: UnitSystem): string {
  return us === "metric" ? "kg/m²" : "lb/ft²";
}

/** Running length — flange material, duct run. Metres or feet, never mm: a
 * flange schedule reading "184,000 mm" is a number nobody can price. */
export function runUnit(us: UnitSystem): string {
  return us === "metric" ? "m" : "ft";
}

export function runFromMm(mm: number, us: UnitSystem): number {
  return us === "metric" ? mm / 1000 : mm / (12 * MM_PER_INCH);
}

/** A length the user typed, in their units → millimetres. */
export function toMm(value: number, us: UnitSystem): number {
  return us === "metric" ? value : value * MM_PER_INCH;
}

/** Millimetres → a length in the user's units. */
export function fromMm(mm: number, us: UnitSystem): number {
  return us === "metric" ? mm : mm / MM_PER_INCH;
}

/** mm² → the user's area unit (m² or ft²). */
export function areaFromMm2(mm2: number, us: UnitSystem): number {
  return mm2 / (us === "metric" ? MM2_PER_M2 : MM2_PER_FT2);
}

/** mm² → the user's SQUARE LENGTH unit (mm² or in²) — what the substituted
 * arithmetic line is denominated in, before the step to m²/ft². */
export function squareLengthFromMm2(mm2: number, us: UnitSystem): number {
  return us === "metric" ? mm2 : mm2 / (MM_PER_INCH * MM_PER_INCH);
}

/** kg/m² → the user's density unit. 1 kg/m² = 0.204816 lb/ft² exactly. */
export function densityFromKgM2(kgm2: number, us: UnitSystem): number {
  return us === "metric" ? kgm2 : (kgm2 * MM2_PER_FT2) / (MM2_PER_M2 * KG_PER_LB);
}

/** kg → the user's mass unit. */
export function massFromKg(kg: number, us: UnitSystem): number {
  return us === "metric" ? kg : kg / KG_PER_LB;
}

/* ---- integer minor units --------------------------------------------- */

export function toAreaMinor(area: number): number {
  return Math.round(area * AREA_SCALE);
}

export function fromAreaMinor(minor: number): number {
  return minor / AREA_SCALE;
}

export function toMassMinor(mass: number): number {
  return Math.round(mass * MASS_SCALE);
}

export function fromMassMinor(minor: number): number {
  return minor / MASS_SCALE;
}

/* ---- formatting ------------------------------------------------------- */

/** Thousands-separated, fixed decimals. Every figure on screen goes through
 * one of these so the app never shows 6.000000000000001. */
export function fmt(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtArea(minor: number): string {
  return fmt(fromAreaMinor(minor), AREA_DECIMALS);
}

export function fmtMass(minor: number): string {
  return fmt(fromMassMinor(minor), MASS_DECIMALS);
}

export function toRunMinor(run: number): number {
  return Math.round(run * RUN_SCALE);
}

export function fromRunMinor(minor: number): number {
  return minor / RUN_SCALE;
}

export function fmtRun(minor: number): string {
  return fmt(fromRunMinor(minor), 2);
}

export function toValueMinor(value: number): number {
  return Math.round(value * VALUE_SCALE);
}

export function fromValueMinor(minor: number): number {
  return minor / VALUE_SCALE;
}

export function fmtValue(minor: number): string {
  return fmt(fromValueMinor(minor), 2);
}

/**
 * A number at up to `maxDecimals`, with trailing zeros trimmed.
 *
 * This is the formatter for anything that has to REPRODUCE. A working line
 * that reads "2 × (950 + 800) × 1217 = 4,260,785 mm²" is not a piece of
 * arithmetic anybody can check — it is a rounded intermediate next to a
 * full-precision answer, and the two do not multiply out. The centreline arc
 * is 1217.3671 mm, and if the equation is going to show it, it has to show it.
 *
 * `fmt` remains the formatter for FIGURES — a headline area, a weight — where
 * a fixed number of decimals is what an estimator wants to read. This one is
 * for the numbers inside an equation, and for the input boxes, where being
 * faithful matters more than being tidy.
 */
export function fmtExact(value: number, maxDecimals = 6, group = true): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxDecimals,
    useGrouping: group,
  });
}

/**
 * Does printing `value` at `maxDecimals` lose anything?
 *
 * The test behind every `=` in a working line. Six decimals keeps 4,200,000
 * whole and does not keep 4,260,785.036431157.
 */
export function printsExactly(value: number, maxDecimals = 6): boolean {
  return Number.isFinite(value) && Number(value.toFixed(maxDecimals)) === value;
}

/**
 * An operand as it will be PRINTED, carrying whether printing it was lossless.
 *
 * `exact` on a CalcStep is a claim about the numbers, so it has to be derived
 * from them and never asserted by whoever wrote the step. Asserting it is how
 * the value line came to read "232.11 × 220 = 51,063.936" — an equals sign in
 * the middle of a false statement, because the mass was rounded to two
 * decimals in order to be SHOWN and not rounded in order to be USED.
 */
export function operand(value: number, maxDecimals = 6): { text: string; exact: boolean } {
  return { text: fmtExact(value, maxDecimals), exact: printsExactly(value, maxDecimals) };
}

/** Decimals a working line shows for a length, per unit system. */
export function workingDecimals(us: UnitSystem): number {
  return us === "metric" ? 4 : 5;
}

/* ---- display precision policy ------------------------------------------
 *
 * Deliberate figures, not whatever JavaScript prints. The rule is that a
 * DETAILED view may show more of a number than the normal one, but neither
 * ever changes it: `AREA_DECIMALS` and friends above are display settings, and
 * the calculation object they format has already been computed in full.
 *
 * Trailing zeros are trimmed by `fmtExact`, so 930 mm shows as 930 rather than
 * 930.000000 — a number padded to a precision it does not have is its own kind
 * of lie.
 */
export const PRECISION = {
  /** Intermediate lengths and areas in the ordinary result panel. */
  step: 3,
  /** The same values inside Calculation details. */
  detail: 6,
} as const;

/**
 * One line of a calculation's working.
 *
 * `working` is the arithmetic with this fitting's numbers in it; `value` is
 * what that arithmetic produced, at full precision. The renderer decides
 * whether to print `=` or `≈` from `exact` — which says whether the operands
 * as SHOWN reproduce the value as shown, or whether one of them is a rounded
 * view of something longer. Claiming `=` on a step that used more precision
 * than it displayed is the specific dishonesty this type exists to prevent.
 */
export type CalcStep = {
  label: string;
  working: string;
  value: number;
  unit: string;
  exact: boolean;
};

/**
 * A length in display units, trimmed: 600 not 600.00, 23.62 not 23.6220.
 *
 * Deliberately WITHOUT thousands separators, unlike every other formatter
 * here. These strings land on dimension lines, and engineering drawings write
 * a three-metre duct as 3000, never 3,000 — a comma on a drawing reads as a
 * decimal point to half the world.
 */
export function fmtLength(mm: number, us: UnitSystem): string {
  const value = fromMm(mm, us);
  const decimals = us === "metric" ? 0 : 2;
  return String(Number(value.toFixed(decimals)));
}
