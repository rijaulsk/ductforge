import type { UnitSystem } from "./units";

/* The six fittings, as data.
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
  | "wye";

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

export type Fitting = Straight | Reducer | Elbow | Dropper | Collar | Wye;

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
  | "w3";

export type FieldSpec = {
  key: FieldKey;
  /** Symbol as it appears on the drawing and in the formula. */
  symbol: string;
  label: string;
  /** Degrees rather than a length — no unit conversion, different input step. */
  angle?: boolean;
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
  note: string;
};

export type Project = {
  id: string;
  name: string;
  reference: string;
  units: UnitSystem;
  mode: Mode;
  /** Default waste for newly added entries. */
  waste: number;
  entries: Entry[];
  updatedAt: number;
};
