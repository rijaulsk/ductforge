import type { PrintOptions } from "../export/printOptions";
import type { UnitSystem } from "./units";

/* The fittings, as data.
 *
 * Every dimension below is MILLIMETRES and every angle DEGREES, regardless of
 * what the user is typing — see units.ts for why. A stored project is
 * therefore unit-agnostic: switching a job from metric to imperial changes the
 * boxes, never the geometry.
 */

export type Mode = "billing" | "shop";

/* NAMES ARE TRADE NAMES, checked against a manufacturer catalogue rather than
 * chosen. Two were wrong until 28 Aug 2026 and both are aliased for old saved
 * files in `lib/project.ts` — see KIND_ALIASES there before renaming anything.
 *
 *   `offset` was called `dropper`. It never was one: a dropper drops air down
 *   to a grille, and this is a constant section displaced sideways — an offset,
 *   catalogued as a rectangular ogee.
 *
 *   `transition` was called `reducer`. A rectangular size change is a
 *   transition; a reducer is the round cone, which keeps the name.
 */
export type FittingKind =
  | "straight"
  | "flat"
  | "transition"
  | "elbow"
  | "offset"
  | "collar"
  | "wye"
  | "round-straight"
  | "round-elbow"
  | "round-reducer"
  | "square-to-round"
  | "flat-circle"
  | "flat-ring"
  | "flat-holed"
  | "flat-frame"
  | "flat-triangle"
  | "flat-trapezoid"
  | "flat-oval";

/** W × H duct, L long. */
export type Straight = { kind: "straight"; w: number; h: number; l: number };

/**
 * One flat piece, W × H — an end cap, a blank-off plate, a panel.
 *
 * TWO DIMENSIONS AND NOTHING ELSE, which is the whole point of it being its own
 * fitting. The owner asked for it on 18 Sep 2026 as "one piece, width and height
 * only", and the question that settled it was which area a 600 × 400 piece
 * should give: 0.24 m² (a flat sheet, one face) and not 2.4 m² (a hollow duct
 * section at some standard length). So it has no length, occupies no length of
 * a run, and is never a flanged end or a hung section — see `isFlat` in
 * formulas.ts and its use in compute.ts.
 */
export type Flat = { kind: "flat"; w: number; h: number };

/* ---- the other flat pieces (18 Sep 2026) ----------------------------------
 *
 * Asked for the same day as the rectangle: "what if it's a different shape".
 * Every one is ONE FACE of sheet, measured as its own area, and none of them is
 * a run — same rules as `Flat`. Keys reuse the existing FieldKeys; the symbol
 * each shows is set per fitting in formulas.ts.
 *
 * Where an input could describe something impossible — a hole wider than its
 * plate, an opening bigger than its frame — the formulas and the drawings use
 * the same clamped value and the working line prints that value, so what is
 * computed, what is drawn and what is shown are always the same number.
 */

/** A round end cap or blank: diameter D. */
export type FlatCircle = { kind: "flat-circle"; d: number };

/** A round flange or a round plate with a hole: outer D (d1), inner d (d2). */
export type FlatRing = { kind: "flat-ring"; d1: number; d2: number };

/** A rectangular plate with a round hole (a spigot plate): W × H, hole d. */
export type FlatHoled = { kind: "flat-holed"; w: number; h: number; d: number };

/** A rectangular frame or flange: outer W × H, opening w (w2) × h (h2). */
export type FlatFrame = { kind: "flat-frame"; w: number; h: number; w2: number; h2: number };

/** A triangle: base B (w) and height H (h). Any triangle with that base and
 * height has that area; the drawing shows it isosceles. */
export type FlatTriangle = { kind: "flat-triangle"; w: number; h: number };

/** A trapezoid: top T (w1), bottom B (w2), height H (h). Drawn isosceles. */
export type FlatTrapezoid = { kind: "flat-trapezoid"; w1: number; w2: number; h: number };

/** A flat-oval end cap: the long side W and the short side H, the short side
 * being the diameter of the two round ends. */
export type FlatOval = { kind: "flat-oval"; w: number; h: number };

export type FlatFitting =
  | Flat
  | FlatCircle
  | FlatRing
  | FlatHoled
  | FlatFrame
  | FlatTriangle
  | FlatTrapezoid
  | FlatOval;

/** Rectangular size change from W1×H1 to W2×H2 over length L. CONCENTRIC — the
 * shop formula's half-offset terms assume the two openings share a centreline. */
export type Transition = {
  kind: "transition";
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

/** Offset: the run steps sideways by O over a straight-line run L, keeping the
 * SAME W × H section throughout. Two opposed bends in practice; measured as the
 * sheared parallelogram it is. */
export type Offset = {
  kind: "offset";
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
  | FlatFitting
  | Transition
  | Elbow
  | Offset
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

/* ---- extras: dampers, terminals, accessories, custom lines ----------------
 *
 * Asked for on 19 Sep 2026: "a separate place to add VCD and other
 * calculations that can get added to the doc". Everything on a duct job that
 * is not sheet metal cut by this app — a volume control damper, a grille, an
 * access door, labour. Each is COUNTED, not calculated: a type, a size, a
 * quantity, a unit and, if the estimator gives one, a rate. No formula, and
 * never added to the sheet-metal area or weight. See lib/extras.ts.
 */
export type ExtraCategory = "damper" | "terminal" | "accessory" | "custom";

/** How the item's size is given. `none` for things with no duct size. */
export type ExtraShape = "rect" | "round" | "none";

export type ExtraUnit = "nos" | "m" | "m²" | "set" | "lot";

export type Extra = {
  id: string;
  category: ExtraCategory;
  /** What it is: a preset name ("Volume control damper (VCD)") or free text. */
  item: string;
  shape: ExtraShape;
  /** Millimetres, like every other dimension here. `d` for round. */
  w: number;
  h: number;
  d: number;
  /** A count for `nos`, `set` and `lot`; may be fractional for `m` and `m²`. */
  qty: number;
  unit: ExtraUnit;
  /** Price per unit in the project's currency label. 0 = no rate given. */
  rate: number;
  zone: string;
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
  material: MaterialKey;
  ancillaries: Ancillaries;
  rates: Rates;
  entries: Entry[];
  /** Dampers, terminals, accessories and custom lines — see `Extra`. */
  extras: Extra[];
  /** What the printed sheet shows and how it is laid out. Saved with the job so
   * a reprint comes out the same — see lib/export/printOptions.ts. */
  print: PrintOptions;
  updatedAt: number;
};
