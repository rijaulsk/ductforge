import type {
  Collar,
  Offset,
  Elbow,
  FieldSpec,
  Fitting,
  FittingKind,
  Transition,
  RoundElbow,
  RoundReducer,
  RoundStraight,
  SquareToRound,
  Straight,
  Wye,
} from "./types";
import {
  type CalcStep,
  PRECISION,
  type UnitSystem,
  fmtExact,
  fromMm,
  printsExactly,
  squareLengthFromMm2,
  workingDecimals,
} from "./units";

/* THE FORMULA REGISTRY — the single source of truth for the arithmetic.
 *
 * Everything that talks about a formula reads from here: the calculator, the
 * "show your working" line under the result, the ancillary quantities and the
 * /standards page. There is no second copy of a formula anywhere in this repo,
 * because the day there is, one of them starts being wrong.
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
  /**
   * The working, one line at a time, ending with the net area of ONE piece in
   * square-length units.
   *
   * These are DERIVED FROM THE SAME NUMBERS `compute` uses, not reconstructed
   * from anything formatted. Each step carries its value at full precision and
   * says whether the operands as shown reproduce it — the renderer turns that
   * into `=` or `≈`. Nothing downstream ever reads a step's text back as a
   * number; the text is for a human to check by hand.
   */
  steps: (f: T, c: StepCtx) => CalcStep[];
};

/**
 * What a step builder is handed so it never has to know about unit systems.
 *
 * `L` formats a length for the working line; `lv` is that length as a NUMBER,
 * for the step's own value. The pair exists so a builder cannot accidentally
 * put a formatted string where a value belongs.
 */
export type StepCtx = {
  us: UnitSystem;
  /** A length in display units, formatted for a working line. */
  L: (mm: number) => string;
  /** The same length as a number. */
  lv: (mm: number) => number;
  /** An area in display square-length units, as a number. */
  sv: (mm2: number) => number;
  /** The same, formatted. */
  S: (mm2: number) => string;
  /**
   * Did `L` print that length without losing anything?
   *
   * A step may only claim `=` if the operands it SHOWS reproduce the value it
   * shows, and `L` prints at three decimals. In metric, with whole-millimetre
   * inputs, that is always lossless and the claim is free. In imperial it is
   * not — 950 mm is 37.4015748 in, which prints as 37.402 — so a builder that
   * hard-codes `exact: true` is telling the truth on one unit system and
   * lying on the other. Hence a predicate rather than a constant.
   */
  exactL: (mm: number) => boolean;
  lenUnit: string;
  sqUnit: string;
};

export function stepCtx(us: UnitSystem): StepCtx {
  const lv = (mm: number) => fromMm(mm, us);
  const sv = (mm2: number) => squareLengthFromMm2(mm2, us);
  return {
    us,
    lv,
    sv,
    L: (mm) => fmtExact(lv(mm), PRECISION.step),
    S: (mm2) => fmtExact(sv(mm2), PRECISION.step),
    exactL: (mm) => printsExactly(lv(mm), PRECISION.step),
    lenUnit: us === "metric" ? "mm" : "in",
    sqUnit: us === "metric" ? "mm²" : "in²",
  };
}

/** Build one step. `exact` defaults to false — the safe direction to be wrong,
 * since claiming `=` on a rounded operand is the failure this guards. */
const step = (
  label: string,
  working: string,
  value: number,
  unit: string,
  exact = false,
): CalcStep => ({ label, working, value, unit, exact });

type Spec<T extends Fitting> = {
  kind: T["kind"];
  /** Which picker group it belongs to. */
  group: "rectangular" | "round";
  name: string;
  blurb: string;
  fields: FieldSpec[];
  defaults: T;
  /** Largest single duct dimension — what the gauge table is graded on. */
  maxDim: (f: T) => number;
  /**
   * Length along the duct this piece occupies. Drives the hanger count and,
   * for straight runs, how many standard-length pieces it is made from.
   */
  centreline: (f: T) => number;
  /** Mean end perimeter — the flange material one end connection needs. */
  perimeter: (f: T) => number;
  /**
   * The same fitting with every CROSS-SECTION dimension grown by `delta`,
   * used to measure insulation on its outer face.
   *
   * Radii shrink by half the delta and lengths do not move, which is what
   * keeps the duct's centreline where it is: an elbow of inside radius R and
   * width W has centreline radius R + W/2, and lagging it gives (R − t) with
   * width (W + 2t) — the same R + W/2. Get this wrong and insulating a bend
   * silently lengthens it.
   */
  inflate: (f: T, delta: number) => T;
  billing: Formula<T>;
  shop: Formula<T>;
  /** One honest sentence about a non-obvious behaviour, shown beside the result. */
  note?: string;
};

/* Formatting for the substituted lines.
 *
 * THESE ARE NOT THE DISPLAY FORMATTERS, and the difference is the whole point.
 * A working line has one job: to multiply out. It used to render lengths with
 * `fmtLength`, which gives whole millimetres — so an elbow whose centreline arc
 * is 1217.3671 mm printed "2 × (950 + 800) × 1217", next to an answer computed
 * from the real arc. The equation was arithmetic nobody could check, and worse,
 * arithmetic that was visibly WRONG if you did check it.
 *
 * Nothing about the calculation changed; the numbers were always full
 * precision. What changed is that the line now shows enough of them. */
const mk = (us: UnitSystem) => {
  const d = workingDecimals(us);
  const L = (mm: number) => fmtExact(fromMm(mm, us), d);
  const S = (mm2: number) => fmtExact(squareLengthFromMm2(mm2, us), 2);
  return { L, S };
};

/** Insulation must never drive a radius negative. */
const shrink = (r: number, delta: number) => Math.max(0, r - delta / 2);

/* ---- straight duct ---------------------------------------------------- */

/** Mean perimeter of a rectangular section — the step four fittings share.
 *
 * Exact when both sides printed exactly and the sum does: adding two numbers
 * you can see in full gives an answer you can check. In imperial neither half
 * of that is guaranteed, so it is asked rather than assumed. */
const perimeterStep = (w: number, h: number, c: StepCtx): CalcStep =>
  step(
    "Mean perimeter",
    `2 × (${c.L(w)} + ${c.L(h)})`,
    c.lv(2 * (w + h)),
    c.lenUnit,
    c.exactL(w) && c.exactL(h) && printsExactly(c.lv(2 * (w + h)), PRECISION.step),
  );

const areaStep = (working: string, mm2: number, c: StepCtx, exact = false): CalcStep =>
  step("Net area", working, c.sv(mm2), c.sqUnit, exact);

/* Exactness, asked rather than assumed — see StepCtx.exactL.
 *
 * A builder that wants to claim `=` names the lengths and areas it PRINTED,
 * and these say whether printing them lost anything. Passing the step's own
 * result as well is what stops "operands you can check, answer you cannot". */
const exactLengths = (c: StepCtx, ...mm: number[]): boolean => mm.every((v) => c.exactL(v));

const exactAreas = (c: StepCtx, ...mm2: number[]): boolean =>
  mm2.every((v) => printsExactly(c.sv(v), PRECISION.step));

function straightSteps(f: Straight, c: StepCtx): CalcStep[] {
  const perimeter = 2 * (f.w + f.h);
  return [
    perimeterStep(f.w, f.h, c),
    areaStep(
      `${c.L(perimeter)} × ${c.L(f.l)}`,
      perimeter * f.l,
      c,
      /* Both operands shown in full, and their product printable in full:
       * this one genuinely is `=` — in metric. Ask, don't assume. */
      c.exactL(perimeter) && c.exactL(f.l) && printsExactly(c.sv(perimeter * f.l), PRECISION.step),
    ),
  ];
}

const straight: Spec<Straight> = {
  kind: "straight",
  group: "rectangular",
  name: "Straight duct",
  blurb: "A plain rectangular run.",
  fields: [
    { key: "w", symbol: "W", label: "Width" },
    { key: "h", symbol: "H", label: "Height" },
    { key: "l", symbol: "L", label: "Length" },
  ],
  defaults: { kind: "straight", w: 600, h: 400, l: 3000 },
  maxDim: (f) => Math.max(f.w, f.h),
  centreline: (f) => f.l,
  perimeter: (f) => 2 * (f.w + f.h),
  inflate: (f, d) => ({ ...f, w: f.w + d, h: f.h + d }),
  billing: {
    expression: "A = 2(W + H) × L",
    compute: (f) => 2 * (f.w + f.h) * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(f.l)}`;
    },
    steps: (f, c) => straightSteps(f, c),
  },
  shop: {
    expression: "A = 2(W + H) × L",
    compute: (f) => 2 * (f.w + f.h) * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(f.l)}`;
    },
    steps: (f, c) => straightSteps(f, c),
  },
  note: "A straight duct has no slant and no arc, so both standards give exactly the same area.",
};

/* ---- transition --------------------------------------------------------
 *
 * Called "Reducer" until 28 Aug 2026, which is the round cone's name. A
 * rectangular size change is a transition, and it need not reduce — a
 * transition that grows is still a transition. Old files carry the old kind;
 * see KIND_ALIASES in lib/project.ts. */

const transition: Spec<Transition> = {
  kind: "transition",
  group: "rectangular",
  name: "Transition",
  blurb: "Changes one rectangular size to another.",
  fields: [
    { key: "w1", symbol: "W₁", label: "Inlet width" },
    { key: "h1", symbol: "H₁", label: "Inlet height" },
    { key: "w2", symbol: "W₂", label: "Outlet width" },
    { key: "h2", symbol: "H₂", label: "Outlet height" },
    { key: "l", symbol: "L", label: "Length" },
  ],
  defaults: { kind: "transition", w1: 800, h1: 400, w2: 500, h2: 300, l: 600 },
  maxDim: (f) => Math.max(f.w1, f.h1, f.w2, f.h2),
  centreline: (f) => f.l,
  perimeter: (f) => f.w1 + f.h1 + f.w2 + f.h2,
  inflate: (f, d) => ({
    ...f,
    w1: f.w1 + d,
    h1: f.h1 + d,
    w2: f.w2 + d,
    h2: f.h2 + d,
  }),
  billing: {
    expression: "A = (W₁ + H₁ + W₂ + H₂) × L",
    compute: (f) => (f.w1 + f.h1 + f.w2 + f.h2) * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `(${L(f.w1)} + ${L(f.h1)} + ${L(f.w2)} + ${L(f.h2)}) × ${L(f.l)}`;
    },
    steps: (f, c) => {
      const mean = f.w1 + f.h1 + f.w2 + f.h2;
      return [
        step(
          "Mean perimeter",
          `${c.L(f.w1)} + ${c.L(f.h1)} + ${c.L(f.w2)} + ${c.L(f.h2)}`,
          c.lv(mean),
          c.lenUnit,
          exactLengths(c, f.w1, f.h1, f.w2, f.h2, mean),
        ),
        areaStep(
          `${c.L(mean)} × ${c.L(f.l)}`,
          mean * f.l,
          c,
          exactLengths(c, mean, f.l) && exactAreas(c, mean * f.l),
        ),
      ];
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
    steps: (f, c) => {
      const top = Math.hypot(f.l, (f.h1 - f.h2) / 2);
      const side = Math.hypot(f.l, (f.w1 - f.w2) / 2);
      const area = (f.w1 + f.w2) * top + (f.h1 + f.h2) * side;
      return [
        /* A slant is a hypotenuse, so these are almost always `≈` — but a
         * 3-4-5 duct exists and would be `=`, and the honest answer is to ask
         * the numbers rather than assume either way. */
        step(
          "Top and bottom slant",
          `√(${c.L(f.l)}² + ((${c.L(f.h1)} − ${c.L(f.h2)}) ÷ 2)²)`,
          c.lv(top),
          c.lenUnit,
          exactLengths(c, f.l, f.h1, f.h2, top),
        ),
        step(
          "Side slant",
          `√(${c.L(f.l)}² + ((${c.L(f.w1)} − ${c.L(f.w2)}) ÷ 2)²)`,
          c.lv(side),
          c.lenUnit,
          exactLengths(c, f.l, f.w1, f.w2, side),
        ),
        areaStep(
          `(${c.L(f.w1)} + ${c.L(f.w2)}) × ${c.L(top)} + (${c.L(f.h1)} + ${c.L(f.h2)}) × ${c.L(side)}`,
          area,
          c,
          exactLengths(c, f.w1, f.w2, top, f.h1, f.h2, side) && exactAreas(c, area),
        ),
      ];
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
  group: "rectangular",
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
  centreline: (f) => rad(f.theta) * (f.r + f.w / 2),
  perimeter: (f) => 2 * (f.w + f.h),
  inflate: (f, d) => ({ ...f, w: f.w + d, h: f.h + d, r: shrink(f.r, d) }),
  billing: {
    expression: "A = 2(W + H) × [θπ/180 × (R + W/2)]",
    compute: (f) => 2 * (f.w + f.h) * rad(f.theta) * (f.r + f.w / 2),
    substitute: (f, us) => {
      const { L } = mk(us);
      const centreline = rad(f.theta) * (f.r + f.w / 2);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(centreline)} centreline`;
    },
    /* The audit case, step by step: R + W/2, then the arc, then the mean
     * perimeter, then the product. The arc is marked inexact because π makes
     * it so — its printed 1217.367 is a view of 1217.3671532660449, and the
     * area is computed from the latter. Saying `=` there would be the exact
     * claim this whole structure exists to stop. */
    steps: (f, c) => {
      const rcl = f.r + f.w / 2;
      const arc = rad(f.theta) * rcl;
      const perimeter = 2 * (f.w + f.h);
      return [
        step(
          "Centreline radius",
          `${c.L(f.r)} + ${c.L(f.w)} ÷ 2`,
          c.lv(rcl),
          c.lenUnit,
          true,
        ),
        step(
          "Centreline arc",
          `${f.theta}° × π ÷ 180 × ${c.L(rcl)}`,
          c.lv(arc),
          c.lenUnit,
        ),
        perimeterStep(f.w, f.h, c),
        areaStep(`${c.L(perimeter)} × ${c.L(arc)}`, perimeter * arc, c),
      ];
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
    steps: (f, c) => {
      const cheek = elbowCheek(f);
      const heel = elbowHeel(f);
      const throat = elbowThroat(f);
      return [
        step(
          "Cheek",
          `${f.theta}° × π ÷ 360 × ((${c.L(f.r)} + ${c.L(f.w)})² − ${c.L(f.r)}²)`,
          c.sv(cheek),
          c.sqUnit,
        ),
        step(
          "Heel",
          `${f.theta}° × π ÷ 180 × (${c.L(f.r)} + ${c.L(f.w)}) × ${c.L(f.h)}`,
          c.sv(heel),
          c.sqUnit,
        ),
        step(
          "Throat",
          `${f.theta}° × π ÷ 180 × ${c.L(f.r)} × ${c.L(f.h)}`,
          c.sv(throat),
          c.sqUnit,
        ),
        /* The three panels each carry a π, so in practice this sums three
         * rounded areas and prints `≈`. Derived anyway, so the marker follows
         * the numbers instead of a guess about them. */
        areaStep(
          `2 × ${c.S(cheek)} + ${c.S(heel)} + ${c.S(throat)}`,
          2 * cheek + heel + throat,
          c,
          exactAreas(c, cheek, heel, throat, 2 * cheek + heel + throat),
        ),
      ];
    },
  },
  note: "R is the inside (throat) radius, so the centreline radius the billing formula uses is R + W/2. Both standards give the same area here, and that is not a coincidence: 2·cheek + heel + throat simplifies to θπ/180·(2R + W)(W + H), which is the mean perimeter times the centreline arc. A swept constant section develops exactly to its mean perimeter (Pappus), so an elbow bills what it cuts.",
};

/* ---- offset -------------------------------------------------------------
 *
 * Called "Dropper" until 28 Aug 2026, and that was simply wrong. A dropper
 * drops air DOWN out of a main and carries a grille at its end; this fitting
 * steps a run sideways and keeps the same section all the way through. The
 * catalogue name is a rectangular ogee, the site name is an offset.
 *
 * The error was visible in the picker before it was visible anywhere else: the
 * icon drew two walls on different slopes, so the shape tapered. A ten-year
 * ductworker took one look and called it a taper. He was right. */

const offset: Spec<Offset> = {
  kind: "offset",
  group: "rectangular",
  name: "Offset",
  blurb: "Steps the run sideways, same section throughout.",
  fields: [
    { key: "w", symbol: "W", label: "Width" },
    { key: "h", symbol: "H", label: "Height" },
    { key: "l", symbol: "L", label: "Run", hint: "Straight-line run of the offset" },
    { key: "o", symbol: "O", label: "Offset", hint: "Lateral displacement" },
  ],
  defaults: { kind: "offset", w: 600, h: 400, l: 900, o: 300 },
  maxDim: (f) => Math.max(f.w, f.h),
  centreline: (f) => Math.hypot(f.l, f.o),
  perimeter: (f) => 2 * (f.w + f.h),
  inflate: (f, d) => ({ ...f, w: f.w + d, h: f.h + d }),
  billing: {
    expression: "A = 2(W + H) × √(L² + O²)",
    compute: (f) => 2 * (f.w + f.h) * Math.hypot(f.l, f.o),
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(Math.hypot(f.l, f.o))} slant`;
    },
    steps: (f, c) => {
      const slant = Math.hypot(f.l, f.o);
      const perimeter = 2 * (f.w + f.h);
      return [
        step("Slant", `√(${c.L(f.l)}² + ${c.L(f.o)}²)`, c.lv(slant), c.lenUnit),
        perimeterStep(f.w, f.h, c),
        areaStep(`${c.L(perimeter)} × ${c.L(slant)}`, perimeter * slant, c),
      ];
    },
  },
  shop: {
    expression: "A = 2(L × H) + 2(W × √(L² + O²))",
    compute: (f) => 2 * (f.l * f.h) + 2 * (f.w * Math.hypot(f.l, f.o)),
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.l)} × ${L(f.h)}) cheeks  +  2 × (${L(f.w)} × ${L(Math.hypot(f.l, f.o))} slant)`;
    },
    steps: (f, c) => {
      const slant = Math.hypot(f.l, f.o);
      const cheeks = 2 * (f.l * f.h);
      const faces = 2 * (f.w * slant);
      return [
        step("Slant", `√(${c.L(f.l)}² + ${c.L(f.o)}²)`, c.lv(slant), c.lenUnit),
        step(
          "Cheeks",
          `2 × (${c.L(f.l)} × ${c.L(f.h)})`,
          c.sv(cheeks),
          c.sqUnit,
          true,
        ),
        step("Faces", `2 × (${c.L(f.w)} × ${c.L(slant)})`, c.sv(faces), c.sqUnit),
        areaStep(`${c.S(cheeks)} + ${c.S(faces)}`, cheeks + faces, c),
      ];
    },
  },
  note: "The only fitting where the shop blank comes out SMALLER than the billing area: the two side cheeks are parallelograms, and shearing a parallelogram does not add area. Both figures are correct — they answer different questions.",
};

/* ---- collar / takeoff -------------------------------------------------- */

const collar: Spec<Collar> = {
  kind: "collar",
  group: "rectangular",
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
  centreline: (f) => f.l,
  perimeter: (f) => 2 * (f.w + f.h),
  inflate: (f, d) => ({ ...f, w: f.w + d, h: f.h + d }),
  billing: {
    expression: "A = 2(W + H) × (L + F)",
    compute: (f) => 2 * (f.w + f.h) * (f.l + f.f),
    substitute: (f, us) => {
      const { L } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × (${L(f.l)} + ${L(f.f)})`;
    },
    steps: (f, c) => {
      const perimeter = 2 * (f.w + f.h);
      return [
        perimeterStep(f.w, f.h, c),
        areaStep(
          `${c.L(perimeter)} × (${c.L(f.l)} + ${c.L(f.f)})`,
          perimeter * (f.l + f.f),
          c,
          exactLengths(c, perimeter, f.l, f.f) && exactAreas(c, perimeter * (f.l + f.f)),
        ),
      ];
    },
  },
  shop: {
    expression: "A = 2(W + H)·L + 2(W + H)·F + 4F²",
    compute: (f) => 2 * (f.w + f.h) * f.l + 2 * (f.w + f.h) * f.f + 4 * f.f * f.f,
    substitute: (f, us) => {
      const { L, S } = mk(us);
      return `2 × (${L(f.w)} + ${L(f.h)}) × ${L(f.l)}  +  2 × (${L(f.w)} + ${L(f.h)}) × ${L(f.f)}  +  4 corner squares ${S(f.f * f.f)}`;
    },
    steps: (f, c) => {
      const perimeter = 2 * (f.w + f.h);
      const neck = perimeter * f.l;
      const band = perimeter * f.f;
      const corners = 4 * f.f * f.f;
      return [
        perimeterStep(f.w, f.h, c),
        step(
          "Neck",
          `${c.L(perimeter)} × ${c.L(f.l)}`,
          c.sv(neck),
          c.sqUnit,
          exactLengths(c, perimeter, f.l) && exactAreas(c, neck),
        ),
        step(
          "Flange band",
          `${c.L(perimeter)} × ${c.L(f.f)}`,
          c.sv(band),
          c.sqUnit,
          exactLengths(c, perimeter, f.f) && exactAreas(c, band),
        ),
        step(
          "Corner squares",
          `4 × ${c.L(f.f)}²`,
          c.sv(corners),
          c.sqUnit,
          exactLengths(c, f.f) && exactAreas(c, corners),
        ),
        areaStep(
          `${c.S(neck)} + ${c.S(band)} + ${c.S(corners)}`,
          neck + band + corners,
          c,
          exactAreas(c, neck, band, corners, neck + band + corners),
        ),
      ];
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
  group: "rectangular",
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
  centreline: (f) => rad(f.theta) * (f.r + Math.max(f.w2, f.w3) / 2),
  perimeter: (f) => 2 * (f.w1 + f.h),
  inflate: (f, d) => ({
    ...f,
    w1: f.w1 + d,
    h: f.h + d,
    w2: f.w2 + d,
    w3: f.w3 + d,
    r: shrink(f.r, d),
  }),
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
    steps: (f, c) => {
      const b1 = wyeBranchBilling(f.w1, f.h, f.w2, f.r, f.theta);
      const b2 = wyeBranchBilling(f.w1, f.h, f.w3, f.r, f.theta);
      const branch = (wn: number, n: number) =>
        step(
          `Branch ${n}`,
          `(${c.L(f.w1)} ÷ 2 + ${c.L(f.h)} + ${c.L(wn)} + ${c.L(f.h)}) × ${f.theta}° × π ÷ 180 × (${c.L(f.r)} + ${c.L(wn)} ÷ 2)`,
          c.sv(n === 1 ? b1 : b2),
          c.sqUnit,
        );
      return [
        branch(f.w2, 1),
        branch(f.w3, 2),
        areaStep(`${c.S(b1)} + ${c.S(b2)}`, b1 + b2, c),
      ];
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
    steps: (f, c) => {
      const b1 = wyeBranchShop(f.h, f.w2, f.r, f.theta);
      const b2 = wyeBranchShop(f.h, f.w3, f.r, f.theta);
      const branch = (wn: number, v: number, n: number) =>
        step(
          `Branch ${n}, developed as an elbow on ${c.L(wn)} ${c.lenUnit}`,
          `2 × cheek + heel + throat, R ${c.L(f.r)}, θ ${f.theta}°`,
          c.sv(v),
          c.sqUnit,
        );
      return [
        branch(f.w2, b1, 1),
        branch(f.w3, b2, 2),
        areaStep(`${c.S(b1)} + ${c.S(b2)}`, b1 + b2, c),
      ];
    },
  },
  note: "OUR STATED INTERPRETATION, not a published formula: the source specification gives the Y-piece shop area only as “sectors + heels + throats” with no sub-formulas, so each branch is developed as an elbow on its own width. The crotch (splitter) plate is NOT included — add it as a separate straight entry if your shop cuts one. Note also that the two standards cross over at Wₙ = W₁/2: a branch narrower than half the main duct bills for more than it cuts, because the billing perimeter averages in the main's half width.",
};

/* ---- round straight ------------------------------------------------------ */

/** Circumference — the step every round fitting starts from. */
const circumferenceStep = (d: number, c: StepCtx): CalcStep =>
  step("Circumference", `π × ${c.L(d)}`, c.lv(Math.PI * d), c.lenUnit);

function roundStraightSteps(f: RoundStraight, c: StepCtx): CalcStep[] {
  const circ = Math.PI * f.d;
  return [
    circumferenceStep(f.d, c),
    areaStep(`${c.L(circ)} × ${c.L(f.l)}`, circ * f.l, c),
  ];
}

const roundStraight: Spec<RoundStraight> = {
  kind: "round-straight",
  group: "round",
  name: "Round duct",
  blurb: "A plain round or spiral run.",
  fields: [
    { key: "d", symbol: "D", label: "Diameter" },
    { key: "l", symbol: "L", label: "Length" },
  ],
  defaults: { kind: "round-straight", d: 400, l: 3000 },
  maxDim: (f) => f.d,
  centreline: (f) => f.l,
  perimeter: (f) => Math.PI * f.d,
  inflate: (f, d) => ({ ...f, d: f.d + d }),
  billing: {
    expression: "A = πD × L",
    compute: (f) => Math.PI * f.d * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `π × ${L(f.d)} × ${L(f.l)}`;
    },
    steps: (f, c) => roundStraightSteps(f, c),
  },
  shop: {
    expression: "A = πD × L",
    compute: (f) => Math.PI * f.d * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `π × ${L(f.d)} × ${L(f.l)}`;
    },
    steps: (f, c) => roundStraightSteps(f, c),
  },
  note: "A cylinder unrolls flat with no distortion at all, so the blank is exactly πD wide by L long and both standards agree. Spiral-wound duct is made from a continuous strip rather than this blank — the AREA is the same, the cutting is not.",
};

/* ---- round elbow --------------------------------------------------------- */

const roundElbow: Spec<RoundElbow> = {
  kind: "round-elbow",
  group: "round",
  name: "Round elbow",
  blurb: "Gored bend in round duct.",
  fields: [
    { key: "d", symbol: "D", label: "Diameter" },
    {
      key: "r",
      symbol: "R",
      label: "Centreline radius",
      hint: "Round duct convention — commonly 1.5 × D",
    },
    { key: "theta", symbol: "θ", label: "Angle", angle: true },
    {
      key: "gores",
      symbol: "n",
      label: "Gores",
      count: true,
      hint: "Segments the bend is welded from. Changes the blanks, not the area.",
    },
  ],
  defaults: { kind: "round-elbow", d: 400, r: 600, theta: 90, gores: 4 },
  maxDim: (f) => f.d,
  centreline: (f) => rad(f.theta) * f.r,
  perimeter: (f) => Math.PI * f.d,
  /* R is already the CENTRELINE radius here, so lagging the duct does not move
   * it — unlike the rectangular elbow, whose R is the throat. */
  inflate: (f, d) => ({ ...f, d: f.d + d }),
  billing: {
    expression: "A = πD × [θπ/180 × R]",
    compute: (f) => Math.PI * f.d * rad(f.theta) * f.r,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `π × ${L(f.d)} × ${L(rad(f.theta) * f.r)} centreline`;
    },
    steps: (f, c) => {
      const arc = rad(f.theta) * f.r;
      const circ = Math.PI * f.d;
      return [
        step("Centreline arc", `${f.theta}° × π ÷ 180 × ${c.L(f.r)}`, c.lv(arc), c.lenUnit),
        circumferenceStep(f.d, c),
        areaStep(`${c.L(circ)} × ${c.L(arc)}`, circ * arc, c),
      ];
    },
  },
  shop: {
    expression: "A = πD × [θπ/180 × R]",
    compute: (f) => Math.PI * f.d * rad(f.theta) * f.r,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `π × ${L(f.d)} × ${L(rad(f.theta) * f.r)} centreline`;
    },
    steps: (f, c) => {
      const arc = rad(f.theta) * f.r;
      const circ = Math.PI * f.d;
      return [
        step("Centreline arc", `${f.theta}° × π ÷ 180 × ${c.L(f.r)}`, c.lv(arc), c.lenUnit),
        circumferenceStep(f.d, c),
        areaStep(`${c.L(circ)} × ${c.L(arc)}`, circ * arc, c),
      ];
    },
  },
  note: "Both standards agree, by Pappus's theorem: a constant section swept about an axis develops to exactly its perimeter times the path of its centroid. The gore count changes the BLANKS — each gore is a cylinder cut at an angle, so its edges unroll as sine curves — and therefore the cutting waste, but never the surface area.",
};

/* ---- round reducer ------------------------------------------------------- */

const roundReducer: Spec<RoundReducer> = {
  kind: "round-reducer",
  group: "round",
  name: "Round reducer",
  blurb: "Concentric cone between two diameters.",
  fields: [
    { key: "d1", symbol: "D₁", label: "Inlet diameter" },
    { key: "d2", symbol: "D₂", label: "Outlet diameter" },
    { key: "l", symbol: "L", label: "Length" },
  ],
  defaults: { kind: "round-reducer", d1: 500, d2: 300, l: 400 },
  maxDim: (f) => Math.max(f.d1, f.d2),
  centreline: (f) => f.l,
  perimeter: (f) => (Math.PI * (f.d1 + f.d2)) / 2,
  inflate: (f, d) => ({ ...f, d1: f.d1 + d, d2: f.d2 + d }),
  billing: {
    expression: "A = π(D₁ + D₂)/2 × L",
    compute: (f) => ((Math.PI * (f.d1 + f.d2)) / 2) * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      return `π × (${L(f.d1)} + ${L(f.d2)})/2 × ${L(f.l)}`;
    },
    steps: (f, c) => {
      const mean = (Math.PI * (f.d1 + f.d2)) / 2;
      return [
        step(
          "Mean circumference",
          `π × (${c.L(f.d1)} + ${c.L(f.d2)}) ÷ 2`,
          c.lv(mean),
          c.lenUnit,
        ),
        areaStep(`${c.L(mean)} × ${c.L(f.l)}`, mean * f.l, c),
      ];
    },
  },
  shop: {
    expression: "A = π(D₁ + D₂)/2 × √(L² + ((D₁−D₂)/2)²)",
    compute: (f) =>
      ((Math.PI * (f.d1 + f.d2)) / 2) * Math.hypot(f.l, (f.d1 - f.d2) / 2),
    substitute: (f, us) => {
      const { L } = mk(us);
      return `π × (${L(f.d1)} + ${L(f.d2)})/2 × ${L(Math.hypot(f.l, (f.d1 - f.d2) / 2))} slant`;
    },
    steps: (f, c) => {
      const mean = (Math.PI * (f.d1 + f.d2)) / 2;
      const slant = Math.hypot(f.l, (f.d1 - f.d2) / 2);
      return [
        step(
          "Mean circumference",
          `π × (${c.L(f.d1)} + ${c.L(f.d2)}) ÷ 2`,
          c.lv(mean),
          c.lenUnit,
        ),
        step(
          "Slant height",
          `√(${c.L(f.l)}² + ((${c.L(f.d1)} − ${c.L(f.d2)}) ÷ 2)²)`,
          c.lv(slant),
          c.lenUnit,
        ),
        areaStep(`${c.L(mean)} × ${c.L(slant)}`, mean * slant, c),
      ];
    },
  },
  note: "The blank is an annular sector — the classic cone development — so the shop area is the mean circumference times the SLANT height, not the length. Concentric only: an eccentric cone has a different development on each side and is not modelled here.",
};

/* ---- square to round ------------------------------------------------------
 *
 * The commonest fitting on any air-handling unit, and the only one here whose
 * true surface has no closed form.
 *
 * THE CONSTRUCTION. A rectangle W × H at one end, a circle of radius r = D/2 at
 * the other, L apart on one centreline. The surface that joins them is made of
 * eight pieces, and every one of them is exact:
 *
 *   · Each rectangle SIDE runs to the single circle point nearest it — a line
 *     and a point define a plane, so those four pieces are FLAT TRIANGLES.
 *     Base W, apex at (0, r): height √(L² + ((H−D)/2)²). Two of those, and two
 *     more on the other axis.
 *   · Each rectangle CORNER runs to a quarter arc — a point and a curve, so
 *     those four pieces are CONE PATCHES, and an oblique cone at that.
 *
 * The corner patch is where the closed form runs out. The lateral area of a
 * ruled surface between a point A and a curve P(φ) is ½∫|(P − A) × P′| dφ, and
 * for this geometry that cross product works out to
 *
 *     r · √(L² + (r − (W/2)cos φ − (H/2)sin φ)²)
 *
 * which does not integrate in elementary functions. So it is integrated
 * NUMERICALLY, by Simpson's rule, to about twelve digits — far past anything a
 * sheet of metal cares about, and exact enough that check-duct can pin it
 * against a case with a known answer: flatten the fitting (L = 0) on a circle
 * inscribed in a square (W = H = D) and the whole thing must equal the area
 * between a square and its inscribed circle, W²(1 − π/4). It does.
 *
 * This is derivation, not interpretation — unlike the Y-piece, nothing here is
 * a reading of an under-specified source. What it does assume is the standard
 * construction above; a shop that develops the corners by TRIANGULATION into
 * flat facets cuts marginally more than this, the same way a gored bend does.
 */

const SIMPSON_STEPS = 720;

/** One corner patch: a quarter of the transition, exactly. */
function cornerPatch(w: number, h: number, d: number, l: number): number {
  const r = d / 2;
  const f = (phi: number) =>
    r * Math.hypot(l, r - (w / 2) * Math.cos(phi) - (h / 2) * Math.sin(phi));

  const a = 0;
  const b = Math.PI / 2;
  const n = SIMPSON_STEPS; // even
  const step = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    sum += f(a + i * step) * (i % 2 === 0 ? 2 : 4);
  }
  return 0.5 * ((step / 3) * sum);
}

const strSideTriangles = (f: SquareToRound) =>
  f.w * Math.hypot(f.l, (f.h - f.d) / 2);
const strEndTriangles = (f: SquareToRound) =>
  f.h * Math.hypot(f.l, (f.w - f.d) / 2);
const strCorners = (f: SquareToRound) => 4 * cornerPatch(f.w, f.h, f.d, f.l);

const squareToRound: Spec<SquareToRound> = {
  kind: "square-to-round",
  group: "round",
  name: "Square to round",
  blurb: "Rectangular one end, round the other.",
  fields: [
    { key: "w", symbol: "W", label: "Width", hint: "Rectangular end" },
    { key: "h", symbol: "H", label: "Height", hint: "Rectangular end" },
    { key: "d", symbol: "D", label: "Diameter", hint: "Round end" },
    { key: "l", symbol: "L", label: "Length" },
  ],
  defaults: { kind: "square-to-round", w: 600, h: 400, d: 400, l: 450 },
  maxDim: (f) => Math.max(f.w, f.h, f.d),
  centreline: (f) => f.l,
  perimeter: (f) => (2 * (f.w + f.h) + Math.PI * f.d) / 2,
  inflate: (f, delta) => ({ ...f, w: f.w + delta, h: f.h + delta, d: f.d + delta }),
  billing: {
    expression: "A = [2(W + H) + πD]/2 × L",
    compute: (f) => ((2 * (f.w + f.h) + Math.PI * f.d) / 2) * f.l,
    substitute: (f, us) => {
      const { L } = mk(us);
      const mean = (2 * (f.w + f.h) + Math.PI * f.d) / 2;
      return `${L(mean)} mean perimeter × ${L(f.l)}`;
    },
    steps: (f, c) => {
      const mean = (2 * (f.w + f.h) + Math.PI * f.d) / 2;
      return [
        step(
          "Mean perimeter",
          `(2 × (${c.L(f.w)} + ${c.L(f.h)}) + π × ${c.L(f.d)}) ÷ 2`,
          c.lv(mean),
          c.lenUnit,
        ),
        areaStep(`${c.L(mean)} × ${c.L(f.l)}`, mean * f.l, c),
      ];
    },
  },
  shop: {
    expression:
      "A = W·√(L² + ((H−D)/2)²) + H·√(L² + ((W−D)/2)²) + 4 × ½∫₀^{π/2} r·√(L² + (r − (W/2)cos φ − (H/2)sin φ)²) dφ,  r = D/2",
    compute: (f) => strSideTriangles(f) + strEndTriangles(f) + strCorners(f),
    substitute: (f, us) => {
      const { S } = mk(us);
      return `2 side triangles ${S(strSideTriangles(f))}  +  2 end triangles ${S(strEndTriangles(f))}  +  4 corner patches ${S(strCorners(f))}`;
    },
    steps: (f, c) => {
      const sides = strSideTriangles(f);
      const ends = strEndTriangles(f);
      const corners = strCorners(f);
      return [
        step(
          "Side triangles (×2)",
          `${c.L(f.w)} × √(${c.L(f.l)}² + ((${c.L(f.h)} − ${c.L(f.d)}) ÷ 2)²)`,
          c.sv(sides),
          c.sqUnit,
        ),
        step(
          "End triangles (×2)",
          `${c.L(f.h)} × √(${c.L(f.l)}² + ((${c.L(f.w)} − ${c.L(f.d)}) ÷ 2)²)`,
          c.sv(ends),
          c.sqUnit,
        ),
        step(
          "Corner patches (×4)",
          "4 × ½∫ r·√(L² + (r − (W/2)cos φ − (H/2)sin φ)² ) dφ, integrated",
          c.sv(corners),
          c.sqUnit,
        ),
        areaStep(`${c.S(sides)} + ${c.S(ends)} + ${c.S(corners)}`, sides + ends + corners, c),
      ];
    },
  },
  note: "Four flat triangles and four conical corner patches — the exact surface of the standard construction, with the corner term integrated numerically because it has no closed form. Concentric only. A shop that develops the corners by triangulating them into flat facets cuts marginally more than this, the same way a gored bend does.",
};

/* ---- the registry ------------------------------------------------------ */

/* The generic is erased exactly here, once. `SPECS[f.kind]` is the only way to
 * reach a spec, and the key IS the discriminant, so a spec can never be handed
 * a fitting of another kind. Writing the union into the Spec type instead would
 * make every `compute` contravariant and force casts inside the formulas —
 * where a mistake would be a wrong number rather than a type error. */
type AnySpec = Spec<Fitting>;

export const SPECS: Record<FittingKind, AnySpec> = {
  straight: straight as unknown as AnySpec,
  transition: transition as unknown as AnySpec,
  elbow: elbow as unknown as AnySpec,
  offset: offset as unknown as AnySpec,
  collar: collar as unknown as AnySpec,
  wye: wye as unknown as AnySpec,
  "round-straight": roundStraight as unknown as AnySpec,
  "round-elbow": roundElbow as unknown as AnySpec,
  "round-reducer": roundReducer as unknown as AnySpec,
  "square-to-round": squareToRound as unknown as AnySpec,
};

export const FITTING_KINDS: readonly FittingKind[] = [
  "straight",
  "transition",
  "elbow",
  "offset",
  "collar",
  "wye",
  "round-straight",
  "round-elbow",
  "round-reducer",
  "square-to-round",
];

export const RECTANGULAR_KINDS = FITTING_KINDS.filter(
  (k) => SPECS[k].group === "rectangular",
);
export const ROUND_KINDS = FITTING_KINDS.filter((k) => SPECS[k].group === "round");

export function specFor(kind: FittingKind): AnySpec {
  return SPECS[kind];
}

export function isRound(kind: FittingKind): boolean {
  return SPECS[kind].group === "round";
}
