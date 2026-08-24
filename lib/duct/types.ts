import type { UnitSystem } from "./units";

/* The fittings, as data.
 *
 * Every dimension below is MILLIMETRES and every angle DEGREES, regardless of
 * what the user is typing — see units.ts for why. A stored project is
 * therefore unit-agnostic: switching a job from metric to imperial changes the
 * boxes, never the geometry.
 */

export type Mode = "billing" | "shop";

export type FittingKind =
  | "straight"
  | "reducer"
  | "elbow"
  | "dropper"
  | "collar"
  | "wye"
  | "round-straight"
  | "round-elbow"
  | "round-reducer"
  | "square-to-round";

/** W × H duct, L long. */
export type Straight = { kind: "straight"; w: number; h: number; l: number };

/** Transition from W1×H1 to W2×H2 over length L. CONCENTRIC — the shop
 * formula's half-offset terms assume the two openings share a centreline. */
export type Reducer = {
  kind: "reducer";
  w1: number;
  h1: number;
  w2: number;
  h2: number;
  l: number;
};

/** Radiused bend. R is the INSIDE (throat) radius; the centreline radius is
 * therefore R + W/2. θ is the included angle in degrees. */
export type Elbow = {
  kind: "elbow";
  w: number;
  h: number;
  r: number;
  theta: number;
};

/** Offset / swan neck: run L, lateral offset O. */
export type Dropper = {
  kind: "dropper";
  w: number;
  h: number;
  l: number;
  o: number;
};

/** Branch takeoff, neck length L with a flange lip F on each side. */
export type Collar = {
  kind: "collar";
  w: number;
  h: number;
  l: number;
  f: number;
};

/** Y-piece / trouser. Main width W1 splits into W2 and W3, common depth H,
 * each branch swept through θ on inside radius R. */
export type Wye = {
  kind: "wye";
  w1: number;
  h: number;
  w2: number;
  w3: number;
  r: number;
  theta: number;
};

/* ---- round / spiral ------------------------------------------------------
 *
 * Round duct is measured on the same two standards, but its geometry is kinder:
 * a cylinder and a cone both develop exactly, so for every round fitting here
 * the billing and shop areas agree. See formulas.ts for why that is Pappus
 * rather than a coincidence, and gauge.ts for the one place round duct needs a
 * caveat the rectangular fittings do not.
 */

/** D diameter, L long. */
export type RoundStraight = { kind: "round-straight"; d: number; l: number };

/** Gored bend. R is the CENTRELINE radius — the convention for round duct,
 * where a bend is specified as a multiple of diameter (commonly 1.5 D). */
export type RoundElbow = {
  kind: "round-elbow";
  d: number;
  r: number;
  theta: number;
  /** Segments the bend is made from. Affects the flat pattern and the cutting
   * waste, never the surface area. */
  gores: number;
};

/** Concentric cone: D1 to D2 over length L. */
export type RoundReducer = {
  kind: "round-reducer";
  d1: number;
  d2: number;
  l: number;
};

/**
 * Square-to-round transition: a W × H rectangle at one end, a D circle at the
 * other, L apart, both on one centreline.
 *
 * The commonest fitting on any air-handling unit, and the only one here whose
 * true development is not a closed form — see formulas.ts.
 */
export type SquareToRound = {
  kind: "square-to-round";
  w: number;
  h: number;
  d: number;
  l: number;
};

export type Fitting =
  | Straight
  | Reducer
  | Elbow
  | Dropper
  | Collar
  | Wye
  | RoundStraight
  | RoundElbow
  | RoundReducer
  | SquareToRound;

/** Which numeric fields a fitting has, in the order the form shows them. */
export type FieldKey =
  | "w"
  | "h"
  | "l"
  | "r"
  | "theta"
  | "o"
  | "f"
  | "w1"
  | "h1"
  | "w2"
  | "h2"
  | "w3"
  | "d"
  | "d1"
  | "d2"
  | "gores";

export type FieldSpec = {
  key: FieldKey;
  /** Symbol as it appears on the drawing and in the formula. */
  symbol: string;
  label: string;
  /** Degrees rather than a length — no unit conversion, different input step. */
  angle?: boolean;
  /** A plain count, not a measurement. Never converted, never inflated. */
  count?: boolean;
  hint?: string;
};

export type GaugeName = "26" | "24" | "22" | "20" | "18" | "16";

export type Entry = {
  id: string;
  fitting: Fitting;
  qty: number;
  /** Waste allowance as a percentage: 12 means 12%. */
  waste: number;
  /** null = selected automatically from the largest dimension. */
  gauge: GaugeName | null;
  /** System, floor or area this line belongs to. "" = ungrouped. */
  zone: string;
  note: string;
};

/** Sheet metal the duct is made from. The gauge table is a table of
 * THICKNESSES, so it survives the material change; only the density moves. */
export type MaterialKey = "gi" | "ss" | "alu";

/** What an estimator wants counted alongside the sheet. All three are derived
 * from the same geometry the areas come from — none is a new measurement. */
export type Ancillaries = {
  /** Insulation thickness in mm. 0 = not insulated. */
  insulationMm: number;
  /** Length a straight duct is supplied in, which is what sets the joint
   * count. 0 = don't count joints. */
  standardLengthMm: number;
  /** Hanger spacing along a run. 0 = don't count supports. */
  supportSpacingMm: number;
};

/** The estimator's own rates. Never a price this app invented. */
export type Rates = {
  perKg: number;
  perM2: number;
  /** Free text: "₹", "AED", "GBP". The user typed the rate; they know what it
   * is denominated in, and we will not guess a currency for them. */
  label: string;
};

export type Project = {
  id: string;
  name: string;
  reference: string;
  units: UnitSystem;
  mode: Mode;
  /** Default waste for newly added entries. */
  waste: number;
  material: MaterialKey;
  ancillaries: Ancillaries;
  rates: Rates;
  entries: Entry[];
  updatedAt: number;
};
