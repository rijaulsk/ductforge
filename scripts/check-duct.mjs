/* DuctForge engine verification. Run with `npm run check:duct`.
 *
 * WHY THIS EXISTS. A duct area that is wrong does not look wrong. Every figure
 * this app prints is plausible: swap a half-offset for a full one in the
 * reducer, grade an imperial job against the metric gauge bands, or round a
 * density from 4.3175 to 4.32 at the wrong moment, and the screen still shows
 * a tidy number with three decimals that somebody will put on an invoice.
 * Inspection cannot catch that. So correctness here is established three ways:
 *
 *   1. AN INDEPENDENT ORACLE. All twelve formulas are transcribed a second
 *      time below, straight from the specification table, and fuzzed against
 *      the engine over 240 random geometries. A typo in lib/duct/formulas.ts
 *      has to be made identically twice to survive.
 *   2. HAND-COMPUTED ANCHORS. Literal values worked out by hand, so that both
 *      transcriptions being wrong the same way still fails.
 *   3. IDENTITIES AND INVARIANTS. Things that must hold for reasons other than
 *      arithmetic: Pappus's theorem making the elbow's two standards agree,
 *      the dropper's shop blank being smaller than its billing area, gauge
 *      band edges, the published density table, and the rounding rule that
 *      makes a schedule's total equal the sum of its printed rows.
 *
 * Zero dependencies. Exits non-zero on any failure.
 */

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

/* The app's imports are extensionless (`./gauge`) because that is what the
 * bundler wants; Node's ESM resolver requires a full specifier. One resolve
 * hook bridges the two, so the engine can stay written the way Next.js needs
 * it and still be imported here with nothing but node. */
const ROOT = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith(".");
    const aliased = specifier.startsWith("@/");
    if ((relative || aliased) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const base = aliased
        ? new URL(specifier.slice(2), ROOT)
        : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) {
          return { url: candidate.href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const { SPECS } = await import("../lib/duct/formulas.ts");
const gauge = await import("../lib/duct/gauge.ts");
const units = await import("../lib/duct/units.ts");
const { computeEntry, computeTotals } = await import("../lib/duct/compute.ts");
const parse = await import("../lib/duct/parse.ts");

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  FAIL  ${label}`);
  }
};
const near = (a, b, tol, label) =>
  check(Math.abs(a - b) <= tol, `${label}  (got ${a}, want ${b} ±${tol})`);
const eq = (a, b, label) => check(a === b, `${label}  (got ${a}, want ${b})`);

const section = (name) => console.log(`\n${name}`);

/* ---- 1. the independent oracle ---------------------------------------- */

const rad = (d) => (d * Math.PI) / 180;
const hyp = (a, b) => Math.sqrt(a * a + b * b);

/* Transcribed from the specification's fitting matrix, not from the engine. */
const ORACLE = {
  straight: {
    billing: (f) => 2 * (f.w + f.h) * f.l,
    shop: (f) => 2 * (f.w + f.h) * f.l,
  },
  reducer: {
    billing: (f) => (f.w1 + f.h1 + f.w2 + f.h2) * f.l,
    shop: (f) =>
      (f.w1 + f.w2) * hyp(f.l, (f.h1 - f.h2) / 2) +
      (f.h1 + f.h2) * hyp(f.l, (f.w1 - f.w2) / 2),
  },
  elbow: {
    billing: (f) => 2 * (f.w + f.h) * (rad(f.theta) * (f.r + f.w / 2)),
    shop: (f) => {
      const cheek = ((f.theta * Math.PI) / 360) * ((f.r + f.w) ** 2 - f.r ** 2);
      const heel = rad(f.theta) * (f.r + f.w) * f.h;
      const throat = rad(f.theta) * f.r * f.h;
      return 2 * cheek + heel + throat;
    },
  },
  dropper: {
    billing: (f) => 2 * (f.w + f.h) * hyp(f.l, f.o),
    shop: (f) => 2 * (f.l * f.h) + 2 * (f.w * hyp(f.l, f.o)),
  },
  collar: {
    billing: (f) => 2 * (f.w + f.h) * (f.l + f.f),
    shop: (f) => 2 * (f.w + f.h) * f.l + 2 * (f.w + f.h) * f.f + 4 * f.f ** 2,
  },
  wye: {
    billing: (f) =>
      (f.w1 / 2 + f.h + f.w2 + f.h) * rad(f.theta) * (f.r + f.w2 / 2) +
      (f.w1 / 2 + f.h + f.w3 + f.h) * rad(f.theta) * (f.r + f.w3 / 2),
    shop: (f) => {
      const branch = (wn) =>
        2 * (((f.theta * Math.PI) / 360) * ((f.r + wn) ** 2 - f.r ** 2)) +
        rad(f.theta) * (f.r + wn) * f.h +
        rad(f.theta) * f.r * f.h;
      return branch(f.w2) + branch(f.w3);
    },
  },
};

/* Deterministic pseudo-random geometry, so a failure is reproducible. */
let seed = 20260824;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const dim = (lo, hi) => Math.round(lo + rnd() * (hi - lo));

function randomFitting(kind) {
  switch (kind) {
    case "straight":
      return { kind, w: dim(100, 2500), h: dim(100, 2500), l: dim(300, 6000) };
    case "reducer":
      return {
        kind,
        w1: dim(200, 2500),
        h1: dim(200, 2500),
        w2: dim(100, 2000),
        h2: dim(100, 2000),
        l: dim(200, 2000),
      };
    case "elbow":
      return { kind, w: dim(100, 2000), h: dim(100, 2000), r: dim(50, 1200), theta: dim(15, 180) };
    case "dropper":
      return { kind, w: dim(100, 2000), h: dim(100, 2000), l: dim(200, 3000), o: dim(50, 1500) };
    case "collar":
      return { kind, w: dim(100, 900), h: dim(100, 900), l: dim(100, 800), f: dim(20, 50) };
    default:
      return {
        kind: "wye",
        w1: dim(300, 2500),
        h: dim(150, 1500),
        w2: dim(150, 1500),
        w3: dim(150, 1500),
        r: dim(50, 900),
        theta: dim(15, 90),
      };
  }
}

section("1. engine vs independent transcription (240 random geometries)");
const KINDS = ["straight", "reducer", "elbow", "dropper", "collar", "wye"];
for (const kind of KINDS) {
  let worst = 0;
  for (let i = 0; i < 20; i++) {
    const f = randomFitting(kind);
    for (const mode of ["billing", "shop"]) {
      const mine = SPECS[kind][mode].compute(f);
      const theirs = ORACLE[kind][mode](f);
      worst = Math.max(worst, Math.abs(mine - theirs));
    }
  }
  check(worst < 1e-6, `${kind}: both transcriptions agree (worst delta ${worst})`);
}

/* ---- 2. hand-computed anchors ----------------------------------------- */

section("2. hand-computed anchors (mm²)");
const A = {
  straight: { kind: "straight", w: 600, h: 400, l: 3000 },
  reducer: { kind: "reducer", w1: 800, h1: 400, w2: 500, h2: 300, l: 600 },
  elbow: { kind: "elbow", w: 600, h: 400, r: 300, theta: 90 },
  dropper: { kind: "dropper", w: 600, h: 400, l: 900, o: 300 },
  collar: { kind: "collar", w: 300, h: 300, l: 250, f: 35 },
  wye: { kind: "wye", w1: 800, h: 400, w2: 500, w3: 400, r: 250, theta: 45 },
};
const area = (kind, mode) => SPECS[kind][mode].compute(A[kind]);

near(area("straight", "billing"), 6_000_000, 1e-9, "straight billing 2(600+400)×3000");
near(area("straight", "shop"), 6_000_000, 1e-9, "straight shop");
near(area("reducer", "billing"), 1_200_000, 1e-9, "reducer billing (800+400+500+300)×600");
near(area("reducer", "shop"), 1_215_629.739, 0.01, "reducer shop 1300×√362500 + 700×√382500");
near(area("elbow", "billing"), 600_000 * Math.PI, 1e-6, "elbow billing 2000×(π/2)×600");
near(area("elbow", "shop"), 600_000 * Math.PI, 1e-6, "elbow shop 2 cheeks + heel + throat");
near(area("dropper", "billing"), 1_897_366.596, 0.01, "dropper billing 2000×√900000");
near(area("dropper", "shop"), 1_858_419.958, 0.01, "dropper shop 720000 + 1200×√900000");
near(area("collar", "billing"), 342_000, 1e-9, "collar billing 1200×285");
near(area("collar", "shop"), 346_900, 1e-9, "collar shop 300000 + 42000 + 4900");
near(area("wye", "billing"), (Math.PI / 4) * 1_570_000, 1e-6, "wye billing (π/4)×1,570,000");
near(area("wye", "shop"), (Math.PI / 4) * 1_620_000, 1e-6, "wye shop (π/4)×1,620,000");

/* ---- 3. identities and invariants -------------------------------------- */

section("3. identities between the two standards");

/* Pappus's theorem: a swept constant section's wall area IS mean perimeter ×
 * centreline arc, so the elbow's "true" development can only equal its billing
 * area. If this ever fails, one of the two formulas has been mistyped. */
for (let i = 0; i < 25; i++) {
  const f = randomFitting("elbow");
  const b = SPECS.elbow.billing.compute(f);
  const s = SPECS.elbow.shop.compute(f);
  check(Math.abs(b - s) < 1e-6, `elbow billing === shop (Pappus) at W${f.w} R${f.r} θ${f.theta}`);
}
for (let i = 0; i < 10; i++) {
  const f = randomFitting("straight");
  check(
    SPECS.straight.billing.compute(f) === SPECS.straight.shop.compute(f),
    "straight billing === shop",
  );
}

section("4. which standard reads larger, and why");
let droppersChecked = 0;
for (let i = 0; i < 40; i++) {
  const f = randomFitting("dropper");
  const b = SPECS.dropper.billing.compute(f);
  const s = SPECS.dropper.shop.compute(f);
  /* The documented case: the side cheeks are parallelograms, and shearing a
   * parallelogram adds no area, so the blank is SMALLER than the billed area
   * whenever there is any offset at all. */
  if (f.o > 0) {
    check(s < b, `dropper shop < billing at O${f.o}`);
    droppersChecked++;
  }
}
check(droppersChecked > 30, `dropper inequality actually exercised (${droppersChecked} cases)`);
for (const kind of ["reducer", "collar"]) {
  let ok = true;
  for (let i = 0; i < 25; i++) {
    const f = randomFitting(kind);
    if (SPECS[kind].shop.compute(f) < SPECS[kind].billing.compute(f) - 1e-9) ok = false;
  }
  check(ok, `${kind} shop >= billing`);
}

/* The Y-piece crosses over, and exactly where the algebra says it must.
 *
 * Per branch the two standards reduce to the same factor θπ/180·(R + Wₙ/2)
 * multiplied by 2(Wₙ + H) for the shop development and by (W₁/2 + Wₙ + 2H)
 * for the mean perimeter the billing standard uses. So shop ≥ billing exactly
 * when Wₙ ≥ W₁/2: a branch narrower than half the main duct bills for more
 * than it cuts, because the billing perimeter averages in the main's half
 * width. Asserting the crossover pins both formulas far harder than asserting
 * an inequality would. */
{
  let wide = 0;
  let narrow = 0;
  for (let i = 0; i < 60; i++) {
    const f = randomFitting("wye");
    const delta = SPECS.wye.shop.compute(f) - SPECS.wye.billing.compute(f);
    if (f.w2 >= f.w1 / 2 && f.w3 >= f.w1 / 2) {
      check(delta >= -1e-9, `wye shop >= billing when both branches >= W1/2`);
      wide++;
    } else if (f.w2 <= f.w1 / 2 && f.w3 <= f.w1 / 2) {
      check(delta <= 1e-9, `wye shop <= billing when both branches <= W1/2`);
      narrow++;
    }
  }
  check(wide > 3 && narrow > 3, `wye crossover exercised both ways (${wide} wide, ${narrow} narrow)`);
  const balanced = { kind: "wye", w1: 800, h: 400, w2: 400, w3: 400, r: 250, theta: 45 };
  near(
    SPECS.wye.shop.compute(balanced),
    SPECS.wye.billing.compute(balanced),
    1e-6,
    "wye: the two standards meet exactly at Wₙ = W₁/2",
  );
}

section("5. scaling laws");
{
  const base = { kind: "straight", w: 600, h: 400, l: 3000 };
  const twiceSection = { kind: "straight", w: 1200, h: 800, l: 3000 };
  const twiceLong = { kind: "straight", w: 600, h: 400, l: 6000 };
  near(
    SPECS.straight.billing.compute(twiceSection),
    2 * SPECS.straight.billing.compute(base),
    1e-9,
    "doubling W and H doubles a straight duct's area",
  );
  near(
    SPECS.straight.billing.compute(twiceLong),
    2 * SPECS.straight.billing.compute(base),
    1e-9,
    "doubling L doubles a straight duct's area",
  );
  const half = { kind: "elbow", w: 600, h: 400, r: 300, theta: 45 };
  near(
    SPECS.elbow.billing.compute(half) * 2,
    SPECS.elbow.billing.compute(A.elbow),
    1e-6,
    "a 45° elbow is exactly half a 90° elbow",
  );
}

/* ---- 6. gauge bands ---------------------------------------------------- */

section("6. gauge band edges");
const metricEdges = [
  [1, "26"], [300, "26"], [301, "24"], [750, "24"], [751, "22"],
  [1000, "22"], [1001, "20"], [1500, "20"], [1501, "18"],
  [2100, "18"], [2101, "16"], [5000, "16"],
];
for (const [mm, want] of metricEdges) {
  eq(gauge.selectGauge(mm, "metric"), want, `metric ${mm} mm → ${want} ga`);
}
const IN = units.MM_PER_INCH;
const imperialEdges = [
  [1, "26"], [12, "26"], [12.5, "24"], [30, "24"], [30.5, "22"],
  [40, "22"], [41, "20"], [60, "20"], [61, "18"],
  [84, "18"], [85, "16"], [200, "16"],
];
for (const [inches, want] of imperialEdges) {
  eq(gauge.selectGauge(inches * IN, "imperial"), want, `imperial ${inches}" → ${want} ga`);
}
/* The two tables are NOT conversions of each other and this is deliberate:
 * 12" is 304.8 mm, which the metric table grades one band heavier. */
eq(gauge.selectGauge(12 * IN, "metric"), "24", "304.8 mm is 24 ga on the metric table");
eq(gauge.selectGauge(12 * IN, "imperial"), "26", "the same duct is 26 ga on the imperial table");

section("7. the published density table, reproduced from thickness alone");
const PUBLISHED = {
  26: [0.55, 4.32, 0.885],
  24: [0.7, 5.5, 1.126],
  22: [0.85, 6.67, 1.366],
  20: [1.0, 7.85, 1.608],
  18: [1.2, 9.42, 1.929],
  16: [1.6, 12.56, 2.572],
};
for (const band of gauge.GAUGE_BANDS) {
  const [thickness, kgm2, lbft2] = PUBLISHED[band.gauge];
  eq(band.thicknessMm, thickness, `${band.gauge} ga is ${thickness} mm`);
  eq(gauge.densityDisplay(band.thicknessMm, "metric"), kgm2, `${band.gauge} ga = ${kgm2} kg/m²`);
  eq(gauge.densityDisplay(band.thicknessMm, "imperial"), lbft2, `${band.gauge} ga = ${lbft2} lb/ft²`);
  near(
    gauge.densityKgM2Exact(band.thicknessMm),
    (thickness / 1000) * 7850,
    1e-12,
    `${band.gauge} ga density is thickness × 7850 kg/m³`,
  );
}

/* ---- 8. units ---------------------------------------------------------- */

section("8. unit conversion round trips");
for (const value of [1, 12.5, 600, 2438.4, 99999]) {
  near(units.toMm(units.fromMm(value, "imperial"), "imperial"), value, 1e-9, `mm→in→mm ${value}`);
  eq(units.toMm(value, "metric"), value, `metric passes through untouched: ${value}`);
}
near(units.areaFromMm2(1_000_000, "metric"), 1, 1e-12, "1,000,000 mm² = 1 m²");
near(units.areaFromMm2(92_903.04, "imperial"), 1, 1e-12, "92,903.04 mm² = 1 ft²");
near(units.areaFromMm2(1e6, "imperial"), 10.763_910_416_709_722, 1e-9, "1 m² = 10.7639 ft²");
near(units.squareLengthFromMm2(645.16, "imperial"), 1, 1e-9, "645.16 mm² = 1 in²");

/* The same physical duct, entered in either system, must weigh the same. */
section("9. the same duct in both unit systems");
{
  const metricEntry = {
    id: "m",
    fitting: { kind: "straight", w: 609.6, h: 406.4, l: 3048 },
    qty: 1,
    waste: 0,
    gauge: null,
    note: "",
  };
  const m = computeEntry(metricEntry, "billing", "metric");
  const i = computeEntry(metricEntry, "billing", "imperial");
  /* Tolerance is one rounding step, not zero, and it has to be. Each system
   * rounds to 3 dp in ITS OWN unit, and 0.001 m² is 0.0108 ft² — so the two
   * answers can legitimately differ by up to about a hundredth of a square
   * foot. Anything larger than one rounding step would be a conversion bug. */
  near(
    units.fromAreaMinor(i.netAreaMinor),
    units.fromAreaMinor(m.netAreaMinor) * 10.763_910_416_709_722,
    0.011,
    "24×16×120 inch duct: m² and ft² agree to within one rounding step",
  );
  near(units.fromAreaMinor(m.netAreaMinor), 6.194, 0.001, "…= 6.194 m²");
  near(units.fromAreaMinor(i.netAreaMinor), 66.667, 0.001, "…= 66.667 ft²");
  eq(m.gauge, "24", "609.6 mm grades 24 ga on the metric table");
  eq(i.gauge, "24", "24 inches grades 24 ga on the imperial table");
}

/* ---- 10. rounding discipline ------------------------------------------- */

section("10. rounding: the printed total is the sum of the printed rows");
{
  const entry = (kind, qty, waste) => ({
    id: kind,
    fitting: A[kind],
    qty,
    waste,
    gauge: null,
    note: "",
  });
  const entries = [
    entry("straight", 3, 12),
    entry("elbow", 4, 15),
    entry("collar", 12, 8),
    entry("reducer", 2, 12),
    entry("dropper", 1, 20),
    entry("wye", 2, 15),
  ];
  for (const us of ["metric", "imperial"]) {
    for (const mode of ["billing", "shop"]) {
      const results = entries.map((e) => computeEntry(e, mode, us));
      const totals = computeTotals(entries, mode, us);
      const label = `${us}/${mode}`;
      eq(
        totals.netAreaMinor,
        results.reduce((s, r) => s + r.netAreaMinor, 0),
        `${label}: net total = Σ rows`,
      );
      eq(
        totals.grossAreaMinor,
        results.reduce((s, r) => s + r.grossAreaMinor, 0),
        `${label}: gross total = Σ rows`,
      );
      eq(
        totals.massMinor,
        results.reduce((s, r) => s + r.massMinor, 0),
        `${label}: weight total = Σ rows`,
      );
      eq(
        totals.grossAreaMinor,
        totals.netAreaMinor + totals.wasteAreaMinor,
        `${label}: net + waste = gross`,
      );
      eq(
        totals.massMinor,
        totals.byGauge.reduce((s, g) => s + g.massMinor, 0),
        `${label}: gauge groups carry every kilogram`,
      );
      eq(
        totals.grossAreaMinor,
        totals.byKind.reduce((s, k) => s + k.grossAreaMinor, 0),
        `${label}: fitting-type groups carry every square`,
      );
      eq(totals.pieces, 24, `${label}: piece count`);

      /* Every row must be re-derivable from the two numbers next to it. */
      for (const r of results) {
        const byHand = Math.round(units.fromAreaMinor(r.grossAreaMinor) * r.density * 100);
        eq(r.massMinor, byHand, `${label}: weight = gross area × printed density`);
      }
    }
  }
}

section("11. one line, checked by hand end to end");
{
  const e = {
    id: "x",
    fitting: A.straight,
    qty: 1,
    waste: 12,
    gauge: null,
    note: "",
  };
  const r = computeEntry(e, "billing", "metric");
  eq(r.gauge, "24", "600 mm max dimension → 24 ga");
  eq(r.thicknessMm, 0.7, "24 ga is 0.70 mm");
  eq(r.density, 5.5, "0.70 mm is 5.50 kg/m²");
  eq(units.fmtArea(r.netAreaMinor), "6.000", "net 6.000 m²");
  eq(units.fmtArea(r.grossAreaMinor), "6.720", "gross at 12% = 6.720 m²");
  eq(units.fmtMass(r.massMinor), "36.96", "6.720 × 5.50 = 36.96 kg");
  eq(gauge.sheetCount(6.72, "metric"), 3, "6.72 m² needs 3 of a 2.88 m² sheet");
  eq(gauge.sheetCount(2.88, "metric"), 1, "exactly one sheet is one sheet, not two");
  eq(gauge.sheetCount(32, "imperial"), 1, "one 4×8 sheet is 32 ft²");
}

section("12. gauge override");
{
  const e = { id: "o", fitting: A.straight, qty: 1, waste: 0, gauge: "16", note: "" };
  const r = computeEntry(e, "billing", "metric");
  eq(r.gauge, "16", "the estimator's override wins over the table");
  eq(r.gaugeAuto, false, "and is flagged as manual");
  eq(r.density, 12.56, "16 ga density follows the override");
  eq(units.fmtMass(r.massMinor), "75.36", "6.000 × 12.56 = 75.36 kg");
}

/* ---- 13. input parsing -------------------------------------------------- */

section("13. parsing what someone typed");
eq(parse.toNumber(""), 0, "empty is zero, not NaN");
eq(parse.toNumber("   "), 0, "whitespace is zero");
eq(parse.toNumber("abc"), 0, "letters are zero");
eq(parse.toNumber("-50"), 0, "negative is zero");
eq(parse.toNumber("1,200"), 1200, "thousands separators survive a paste");
eq(parse.toNumber("1e30"), 100000, "a paste accident is clamped, not printed");
eq(parse.toNumber("600.5"), 600.5, "decimals pass through");
eq(parse.toQty("0"), 1, "a line of nothing is one piece");
eq(parse.toQty("3.7"), 3, "part-pieces round down");
eq(parse.toWaste("500"), 100, "waste is capped at 100%");
eq(parse.toAngle("0"), 1, "a 0° elbow is not a fitting");
eq(parse.toAngle("400"), 359, "nor is a 400° one");

/* ---- 14. degenerate input doesn't produce NaN --------------------------- */

section("14. zeroed fields stay finite");
for (const kind of KINDS) {
  const zeroed = Object.fromEntries(
    Object.entries(A[kind]).map(([k, v]) => [k, k === "kind" ? v : 0]),
  );
  for (const mode of ["billing", "shop"]) {
    const v = SPECS[kind][mode].compute(zeroed);
    check(Number.isFinite(v) && v === 0, `${kind}/${mode} with every field zero → 0, not NaN`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
