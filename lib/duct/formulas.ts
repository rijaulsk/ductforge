import type {
  Collar,
  Dropper,
  Elbow,
  FieldSpec,
  Fitting,
  FittingKind,
  Reducer,
  Straight,
  Wye,
} from "./types";
import {
  type UnitSystem,
  fmt,
  fmtLength,
  squareLengthFromMm2,
} from "./units";

/* THE FORMULA REGISTRY — the single source of truth for the arithmetic.
 *
 * Everything that talks about a formula reads from here: the calculator, the
 * "show your working" line under the result, and the /standards page. There is
 * no second copy of a formula anywhere in this repo, because the day there is,
 * one of them starts being wrong.
 *
 * TWO MEASUREMENT STANDARDS, deliberately kept apart:
 *
 *   billing — nominal mean perimeter × centreline length. What quantity
 *             surveyors, MEP consultants and clients accept on an invoice
 *             (BOQ / IS 655 / DW144 practice).
 *   shop    — the true unfolded blank: slant hypotenuses, heel arc expansion,
 *             wrapper triangulation. What a fabricator actually cuts.
 *
 * They are different numbers on purpose. Reporting one while labelling it the
 * other is the single most expensive mistake this app could make, so the mode
 * travels with every result, every export row and every printed sheet.
 *
 * All lengths are millimetres in, square millimetres out. `substitute` returns
 * the expression with the user's own numbers in it, in the user's own units —
 * a result the estimator can check by hand is a result they will trust.
 */

const rad = (deg: number) => (deg * Math.PI) / 180;

type Formula<T extends Fitting> = {
  /** The formula in symbols, as it appears in the standards and on /standards. */
  expression: string;
  /** mm² for ONE piece. */
  compute: (f: T) => number;
  /** The same expression with numbers in it, in display units. */
  substitute: (f: T, us: UnitSystem) => string;
};

type Spec<T extends Fitting> = {
  kind: T["kind"];
  name: string;
  blurb: string;
  fields: FieldSpec[];
  defaults: T;
  /** Largest single duct dimension — what the gauge table is graded on. */
  maxDim: (f: T) => number;
  billing: Formula<T>;
  shop: Formula<T>;
  /** One honest sentence about a non-obvious behaviour, shown beside the result. */
  note?: string;
};

/* Formatting helpers for the substituted lines. */
const mk = (us: UnitSystem) => {
  const L = (mm: number) => fmtLength(mm, us);
  const S = (mm2: number) => fmt(squareLengthFromMm2(mm2, us), 0);
  return { L, S };
};

/* ---- straight duct ---------------------------------------------------- */

const straight: Spec<Straight> = {
  kind: "straight",
  name: "Straight duct",
  blurb: "A plain rectangular run.",
  fields: [
    { key: "w", symbol: "W", label: "Width" },
    { key: "h", symbol: "H", label: "Height" },
    { key: "l", symbol: "L", label: "Length" },
  ],
  defaults: { kind: "straight", w: 600, h: 400, l: 3000 },
  maxDim: (f) => Math.max(f.w, f.h),
  billing: {
    expression: "A = 2(W + H) × L",
    compute: (f) => 2 * (f.w + f.h) * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(f.l)}`;
    },
  },
  shop: {
    expression: "A = 2(W + H) × L",
    compute: (f) => 2 * (f.w + f.h) * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(f.l)}`;
    },
  },
  note: "A straight duct has no slant and no arc, so both standards give exactly the same area.",
};

/* ---- reducer / transition --------------------------------------------- */

const reducer: Spec<Reducer> = {
  kind: "reducer",
  name: "Reducer",
  blurb: "Transition between two rectangular sizes.",
  fields: [
    { key: "w1", symbol: "W₁", label: "Inlet width" },
    { key: "h1", symbol: "H₁", label: "Inlet height" },
    { key: "w2", symbol: "W₂", label: "Outlet width" },
    { key: "h2", symbol: "H₂", label: "Outlet height" },
    { key: "l", symbol: "L", label: "Length" },
  ],
  defaults: { kind: "reducer", w1: 800, h1: 400, w2: 500, h2: 300, l: 600 },
  maxDim: (f) => Math.max(f.w1, f.h1, f.w2, f.h2),
  billing: {
    expression: "A = (W₁ + H₁ + W₂ + H₂) × L",
    compute: (f) => (f.w1 + f.h1 + f.w2 + f.h2) * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `(${L(f.w1)} + ${L(f.h1)} + ${L(f.w2)} + ${L(f.h2)}) × ${L(f.l)}`;
    },
  },
  shop: {
    expression:
      "A = (W₁ + W₂)·√(L² + ((H₁−H₂)/2)²) + (H₁ + H₂)·√(L² + ((W₁−W₂)/2)²)",
    compute: (f) =>
      (f.w1 + f.w2) * Math.hypot(f.l, (f.h1 - f.h2) / 2) +
      (f.h1 + f.h2) * Math.hypot(f.l, (f.w1 - f.w2) / 2),
    substitute: (f, us) => {
      const { L } = mk(us);
      const top = Math.hypot(f.l, (f.h1 - f.h2) / 2);
      const side = Math.hypot(f.l, (f.w1 - f.w2) / 2);
      return (
        `(${L(f.w1)} + ${L(f.w2)}) × ${L(top)} slant` +
        `  +  (${L(f.h1)} + ${L(f.h2)}) × ${L(side)} slant`
      );
    },
  },
  note: "Concentric transition — both openings on one centreline. An eccentric (flat-on-one-side) reducer has a larger slant on the offset face and is not modelled here.",
};

/* ---- elbow ------------------------------------------------------------ */

const elbowCheek = (f: Elbow) =>
  ((f.theta * Math.PI) / 360) * ((f.r + f.w) ** 2 - f.r ** 2);
const elbowHeel = (f: Elbow) => rad(f.theta) * (f.r + f.w) * f.h;
const elbowThroat = (f: Elbow) => rad(f.theta) * f.r * f.h;

const elbow: Spec<Elbow> = {
  kind: "elbow",
  name: "Elbow",
  blurb: "Radiused bend through an angle.",
  fields: [
    { key: "w", symbol: "W", label: "Width", hint: "In the plane of the bend" },
    { key: "h", symbol: "H", label: "Height", hint: "Depth of the cheeks" },
    {
      key: "r",
      symbol: "R",
      label: "Inside radius",
      hint: "Throat radius — commonly 0.5 to 1.5 × W",
    },
    { key: "theta", symbol: "θ", label: "Angle", angle: true },
  ],
  defaults: { kind: "elbow", w: 600, h: 400, r: 300, theta: 90 },
  maxDim: (f) => Math.max(f.w, f.h),
  billing: {
    expression: "A = 2(W + H) × [θπ/180 × (R + W/2)]",
    compute: (f) => 2 * (f.w + f.h) * rad(f.theta) * (f.r + f.w / 2),
    substitute: (f, us) => {
      const { L } = mk(us);
      const centreline = rad(f.theta) * (f.r + f.w / 2);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(centreline)} centreline`;
    },
  },
  shop: {
    expression:
      "A = 2·A_cheek + A_heel + A_throat,  A_cheek = θπ/360·[(R+W)² − R²],  A_heel = θπ/180·(R+W)·H,  A_throat = θπ/180·R·H",
    compute: (f) => 2 * elbowCheek(f) + elbowHeel(f) + elbowThroat(f),
    substitute: (f, us) => {
      const { S } = mk(us);
      return `2 cheeks 2 × ${S(elbowCheek(f))}  +  heel ${S(elbowHeel(f))}  +  throat ${S(elbowThroat(f))}`;
    },
  },
  note: "R is the inside (throat) radius, so the centreline radius the billing formula uses is R + W/2. Both standards give the same area here, and that is not a coincidence: 2·cheek + heel + throat simplifies to θπ/180·(2R + W)(W + H), which is the mean perimeter times the centreline arc. A swept constant section develops exactly to its mean perimeter (Pappus), so an elbow bills what it cuts.",
};

/* ---- dropper / offset -------------------------------------------------- */

const dropper: Spec<Dropper> = {
  kind: "dropper",
  name: "Dropper",
  blurb: "Offset or swan neck.",
  fields: [
    { key: "w", symbol: "W", label: "Width" },
    { key: "h", symbol: "H", label: "Height" },
    { key: "l", symbol: "L", label: "Run", hint: "Straight-line run of the offset" },
    { key: "o", symbol: "O", label: "Offset", hint: "Lateral displacement" },
  ],
  defaults: { kind: "dropper", w: 600, h: 400, l: 900, o: 300 },
  maxDim: (f) => Math.max(f.w, f.h),
  billing: {
    expression: "A = 2(W + H) × √(L² + O²)",
    compute: (f) => 2 * (f.w + f.h) * Math.hypot(f.l, f.o),
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(Math.hypot(f.l, f.o))} slant`;
    },
  },
  shop: {
    expression: "A = 2(L × H) + 2(W × √(L² + O²))",
    compute: (f) => 2 * (f.l * f.h) + 2 * (f.w * Math.hypot(f.l, f.o)),
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.l)} × ${L(f.h)}) cheeks  +  2 × (${L(f.w)} × ${L(Math.hypot(f.l, f.o))} slant)`;
    },
  },
  note: "The only fitting where the shop blank comes out SMALLER than the billing area: the two side cheeks are parallelograms, and shearing a parallelogram does not add area. Both figures are correct — they answer different questions.",
};

/* ---- collar / takeoff -------------------------------------------------- */

const collar: Spec<Collar> = {
  kind: "collar",
  name: "Collar",
  blurb: "Branch takeoff with a flange lip.",
  fields: [
    { key: "w", symbol: "W", label: "Width" },
    { key: "h", symbol: "H", label: "Height" },
    { key: "l", symbol: "L", label: "Neck length" },
    { key: "f", symbol: "F", label: "Flange", hint: "Lip on each side, commonly 25–35 mm" },
  ],
  defaults: { kind: "collar", w: 300, h: 300, l: 250, f: 35 },
  maxDim: (f) => Math.max(f.w, f.h),
  billing: {
    expression: "A = 2(W + H) × (L + F)",
    compute: (f) => 2 * (f.w + f.h) * (f.l + f.f),
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × (${L(f.l)} + ${L(f.f)})`;
    },
  },
  shop: {
    expression: "A = 2(W + H)·L + 2(W + H)·F + 4F²",
    compute: (f) => 2 * (f.w + f.h) * f.l + 2 * (f.w + f.h) * f.f + 4 * f.f * f.f,
    substitute: (f, us) => {
      const { L, S } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(f.l)}  +  2 × (${L(f.w)} + ${L(f.h)}) × ${L(f.f)}  +  4 corner squares ${S(f.f * f.f)}`;
    },
  },
  note: "The shop blank is the billing area plus the four corner squares at the flange — the material the billing standard treats as scrap.",
};

/* ---- Y-piece / trouser -------------------------------------------------- */

const wyeBranchBilling = (w1: number, h: number, wn: number, r: number, theta: number) =>
  (w1 / 2 + h + wn + h) * rad(theta) * (r + wn / 2);

const wyeBranchShop = (h: number, wn: number, r: number, theta: number) =>
  2 * (((theta * Math.PI) / 360) * ((r + wn) ** 2 - r ** 2)) +
  rad(theta) * (r + wn) * h +
  rad(theta) * r * h;

const wye: Spec<Wye> = {
  kind: "wye",
  name: "Y-piece",
  blurb: "Trouser splitting one duct into two.",
  fields: [
    { key: "w1", symbol: "W₁", label: "Main width" },
    { key: "h", symbol: "H", label: "Height", hint: "Common to both branches" },
    { key: "w2", symbol: "W₂", label: "Branch 1 width" },
    { key: "w3", symbol: "W₃", label: "Branch 2 width" },
    { key: "r", symbol: "R", label: "Inside radius" },
    { key: "theta", symbol: "θ", label: "Branch angle", angle: true },
  ],
  defaults: { kind: "wye", w1: 800, h: 400, w2: 500, w3: 400, r: 250, theta: 45 },
  maxDim: (f) => Math.max(f.w1, f.h, f.w2, f.w3),
  billing: {
    expression:
      "A = A_B1 + A_B2,  A_Bn = (W₁/2 + H + Wₙ + H) × θπ/180·(R + Wₙ/2)",
    compute: (f) =>
      wyeBranchBilling(f.w1, f.h, f.w2, f.r, f.theta) +
      wyeBranchBilling(f.w1, f.h, f.w3, f.r, f.theta),
    substitute: (f, us) => {
      const { S } = mk(us);
      return `branch 1 ${S(wyeBranchBilling(f.w1, f.h, f.w2, f.r, f.theta))}  +  branch 2 ${S(wyeBranchBilling(f.w1, f.h, f.w3, f.r, f.theta))}`;
    },
  },
  shop: {
    expression:
      "A = Σ branches [ 2·A_cheek + A_heel + A_throat ], each branch taken on its own width Wₙ",
    compute: (f) =>
      wyeBranchShop(f.h, f.w2, f.r, f.theta) + wyeBranchShop(f.h, f.w3, f.r, f.theta),
    substitute: (f, us) => {
      const { S } = mk(us);
      return `branch 1 ${S(wyeBranchShop(f.h, f.w2, f.r, f.theta))}  +  branch 2 ${S(wyeBranchShop(f.h, f.w3, f.r, f.theta))}`;
    },
  },
  note: "OUR STATED INTERPRETATION, not a published formula: the source specification gives the Y-piece shop area only as “sectors + heels + throats” with no sub-formulas, so each branch is developed as an elbow on its own width. The crotch (splitter) plate is NOT included — add it as a separate straight entry if your shop cuts one. Note also that the two standards cross over at Wₙ = W₁/2: a branch narrower than half the main duct bills for more than it cuts, because the billing perimeter averages in the main's half width.",
};

/* ---- the registry ------------------------------------------------------ */

/* The generic is erased exactly here, once. `SPECS[f.kind]` is the only way to
 * reach a spec, and the key IS the discriminant, so a spec can never be handed
 * a fitting of another kind. Writing the union into the Spec type instead would
 * make every `compute` contravariant and force six casts inside the formulas —
 * where a mistake would be a wrong number rather than a type error. */
type AnySpec = Spec<Fitting>;

export const SPECS: Record<FittingKind, AnySpec> = {
  straight: straight as unknown as AnySpec,
  reducer: reducer as unknown as AnySpec,
  elbow: elbow as unknown as AnySpec,
  dropper: dropper as unknown as AnySpec,
  collar: collar as unknown as AnySpec,
  wye: wye as unknown as AnySpec,
};

export const FITTING_KINDS: readonly FittingKind[] = [
  "straight",
  "reducer",
  "elbow",
  "dropper",
  "collar",
  "wye",
];

export function specFor(kind: FittingKind): AnySpec {
  return SPECS[kind];
}
