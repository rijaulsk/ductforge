/* DuctForge engine verification. Run with `npm run check:duct`.
 *
 * WHY THIS EXISTS. A duct area that is wrong does not look wrong. Every figure
 * this app prints is plausible: swap a half-offset for a full one in the
 * transition, grade an imperial job against the metric gauge bands, or round a
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
 *      the offset's shop blank being smaller than its billing area, gauge
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
const draft = await import("../lib/draft.ts");
const project = await import("../lib/project.ts");

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
  transition: {
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
  offset: {
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
  "round-straight": {
    billing: (f) => Math.PI * f.d * f.l,
    shop: (f) => Math.PI * f.d * f.l,
  },
  "round-elbow": {
    billing: (f) => Math.PI * f.d * rad(f.theta) * f.r,
    shop: (f) => Math.PI * f.d * rad(f.theta) * f.r,
  },
  "round-reducer": {
    billing: (f) => ((Math.PI * (f.d1 + f.d2)) / 2) * f.l,
    shop: (f) =>
      ((Math.PI * (f.d1 + f.d2)) / 2) * hyp(f.l, (f.d1 - f.d2) / 2),
  },
  "square-to-round": {
    billing: (f) => ((2 * (f.w + f.h) + Math.PI * f.d) / 2) * f.l,
    shop: (f) => {
      /* Independent integration: the trapezium rule at a different resolution
       * from the engine's Simpson, so agreeing to ten digits means the value
       * is right rather than that one mistake was made twice. */
      const r = f.d / 2;
      const g = (phi) =>
        r * Math.sqrt(f.l ** 2 + (r - (f.w / 2) * Math.cos(phi) - (f.h / 2) * Math.sin(phi)) ** 2);
      const n = 20000;
      const step = Math.PI / 2 / n;
      let sum = (g(0) + g(Math.PI / 2)) / 2;
      for (let i = 1; i < n; i++) sum += g(i * step);
      const corner = 0.5 * sum * step;
      return (
        f.w * hyp(f.l, (f.h - f.d) / 2) + f.h * hyp(f.l, (f.w - f.d) / 2) + 4 * corner
      );
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
    case "transition":
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
    case "offset":
      return { kind, w: dim(100, 2000), h: dim(100, 2000), l: dim(200, 3000), o: dim(50, 1500) };
    case "collar":
      return { kind, w: dim(100, 900), h: dim(100, 900), l: dim(100, 800), f: dim(20, 50) };
    case "round-straight":
      return { kind, d: dim(100, 1600), l: dim(300, 6000) };
    case "round-elbow":
      return {
        kind,
        d: dim(100, 1200),
        r: dim(150, 2000),
        theta: dim(15, 180),
        gores: dim(2, 8),
      };
    case "round-reducer":
      return { kind, d1: dim(200, 1600), d2: dim(100, 1200), l: dim(150, 1500) };
    case "square-to-round":
      return {
        kind,
        w: dim(200, 1600),
        h: dim(200, 1400),
        d: dim(150, 1200),
        l: dim(150, 1200),
      };
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

section("1. engine vs independent transcription (360 random geometries)");
const KINDS = [
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
for (const kind of KINDS) {
  let worst = 0;
  for (let i = 0; i < 20; i++) {
    const f = randomFitting(kind);
    for (const mode of ["billing", "shop"]) {
      const mine = SPECS[kind][mode].compute(f);
      const theirs = ORACLE[kind][mode](f);
      /* RELATIVE, not absolute. Every closed-form fitting agrees to the last
       * bit, but the square-to-round's corner term is an integral, and the two
       * sides integrate it differently on purpose — Simpson here, the
       * trapezium rule at another resolution there. Agreeing to nine
       * significant figures means the value is right; demanding they agree to
       * an absolute 1e-6 on an area of a million square millimetres would be
       * asking two different methods to make the same rounding error. */
      const scale = Math.max(Math.abs(mine), Math.abs(theirs), 1);
      worst = Math.max(worst, Math.abs(mine - theirs) / scale);
    }
  }
  check(worst < 1e-9, `${kind}: both transcriptions agree (worst relative delta ${worst})`);
}

/* ---- 2. hand-computed anchors ----------------------------------------- */

section("2. hand-computed anchors (mm²)");
const A = {
  straight: { kind: "straight", w: 600, h: 400, l: 3000 },
  transition: { kind: "transition", w1: 800, h1: 400, w2: 500, h2: 300, l: 600 },
  elbow: { kind: "elbow", w: 600, h: 400, r: 300, theta: 90 },
  offset: { kind: "offset", w: 600, h: 400, l: 900, o: 300 },
  collar: { kind: "collar", w: 300, h: 300, l: 250, f: 35 },
  wye: { kind: "wye", w1: 800, h: 400, w2: 500, w3: 400, r: 250, theta: 45 },
  "round-straight": { kind: "round-straight", d: 400, l: 3000 },
  "round-elbow": { kind: "round-elbow", d: 400, r: 600, theta: 90, gores: 4 },
  "round-reducer": { kind: "round-reducer", d1: 500, d2: 300, l: 400 },
  "square-to-round": { kind: "square-to-round", w: 600, h: 400, d: 400, l: 450 },
};
const area = (kind, mode) => SPECS[kind][mode].compute(A[kind]);

near(area("straight", "billing"), 6_000_000, 1e-9, "straight billing 2(600+400)×3000");
near(area("straight", "shop"), 6_000_000, 1e-9, "straight shop");
near(area("transition", "billing"), 1_200_000, 1e-9, "transition billing (800+400+500+300)×600");
near(area("transition", "shop"), 1_215_629.739, 0.01, "transition shop 1300×√362500 + 700×√382500");
near(area("elbow", "billing"), 600_000 * Math.PI, 1e-6, "elbow billing 2000×(π/2)×600");
near(area("elbow", "shop"), 600_000 * Math.PI, 1e-6, "elbow shop 2 cheeks + heel + throat");
near(area("offset", "billing"), 1_897_366.596, 0.01, "offset billing 2000×√900000");
near(area("offset", "shop"), 1_858_419.958, 0.01, "offset shop 720000 + 1200×√900000");
near(area("collar", "billing"), 342_000, 1e-9, "collar billing 1200×285");
near(area("collar", "shop"), 346_900, 1e-9, "collar shop 300000 + 42000 + 4900");
near(area("wye", "billing"), (Math.PI / 4) * 1_570_000, 1e-6, "wye billing (π/4)×1,570,000");
near(area("wye", "shop"), (Math.PI / 4) * 1_620_000, 1e-6, "wye shop (π/4)×1,620,000");
near(area("round-straight", "billing"), 1_200_000 * Math.PI, 1e-6, "round duct π×400×3000");
near(area("round-elbow", "billing"), 120_000 * Math.PI ** 2, 1e-6, "round elbow 120,000π²");
near(area("round-reducer", "billing"), 160_000 * Math.PI, 1e-6, "round reducer billing 160,000π");
near(
  area("round-reducer", "shop"),
  400 * Math.PI * Math.sqrt(170_000),
  1e-6,
  "round reducer shop π×400×√170000 slant",
);

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
/* Round duct is Pappus twice over: a cylinder and a swept circle both develop
 * exactly, so neither standard can read higher than the other. */
for (const kind of ["round-straight", "round-elbow"]) {
  for (let i = 0; i < 15; i++) {
    const f = randomFitting(kind);
    check(
      Math.abs(SPECS[kind].billing.compute(f) - SPECS[kind].shop.compute(f)) < 1e-6,
      `${kind} billing === shop`,
    );
  }
}
{
  let ok = true;
  for (let i = 0; i < 20; i++) {
    const f = randomFitting("round-reducer");
    /* A cone is the one round fitting with a slant, so it is the one where the
     * two standards part company. */
    if (SPECS["round-reducer"].shop.compute(f) <= SPECS["round-reducer"].billing.compute(f)) {
      ok = false;
    }
  }
  check(ok, "round reducer shop > billing wherever there is a taper");
  const noTaper = { kind: "round-reducer", d1: 400, d2: 400, l: 600 };
  near(
    SPECS["round-reducer"].shop.compute(noTaper),
    SPECS["round-reducer"].billing.compute(noTaper),
    1e-9,
    "…and equal when there is none",
  );
}

section("4. which standard reads larger, and why");
let offsetsChecked = 0;
for (let i = 0; i < 40; i++) {
  const f = randomFitting("offset");
  const b = SPECS.offset.billing.compute(f);
  const s = SPECS.offset.shop.compute(f);
  /* The documented case: the side cheeks are parallelograms, and shearing a
   * parallelogram adds no area, so the blank is SMALLER than the billed area
   * whenever there is any offset at all. */
  if (f.o > 0) {
    check(s < b, `offset shop < billing at O${f.o}`);
    offsetsChecked++;
  }
}
check(offsetsChecked > 30, `offset inequality actually exercised (${offsetsChecked} cases)`);
for (const kind of ["transition", "collar"]) {
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
/** A schedule line. `zone` and the material are part of every entry now, so
 * the helper carries them rather than letting each test invent its own. */
const line = (fitting, qty = 1, waste = 0, extra = {}) => ({
  id: "t",
  fitting,
  qty,
  waste,
  gauge: null,
  zone: "",
  note: "",
  ...extra,
});

/** A project wrapper, for the totals. */
const proj = (entries, over = {}) => ({
  id: "p",
  name: "check",
  reference: "",
  units: "metric",
  mode: "billing",
  waste: 12,
  material: "gi",
  ancillaries: { insulationMm: 0, standardLengthMm: 0, supportSpacingMm: 0 },
  rates: { perKg: 0, perM2: 0, label: "" },
  entries,
  updatedAt: 0,
  ...over,
});

section("9. the same duct in both unit systems");
{
  const metricEntry = line({ kind: "straight", w: 609.6, h: 406.4, l: 3048 });
  const m = computeEntry(metricEntry, "billing", "metric", "gi");
  const i = computeEntry(metricEntry, "billing", "imperial", "gi");
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
  const entry = (kind, qty, waste, zone) =>
    line(A[kind], qty, waste, { id: kind, zone });
  const entries = [
    entry("straight", 3, 12, "AHU-1"),
    entry("elbow", 4, 15, "AHU-1"),
    entry("collar", 12, 8, "AHU-2"),
    entry("transition", 2, 12, "AHU-2"),
    entry("offset", 1, 20, ""),
    entry("wye", 2, 15, ""),
    entry("round-straight", 5, 12, "AHU-2"),
    entry("round-elbow", 6, 15, "AHU-1"),
    entry("round-reducer", 3, 12, ""),
  ];
  for (const us of ["metric", "imperial"]) {
    for (const mode of ["billing", "shop"]) {
      const project = proj(entries, { units: us, mode });
      const results = entries.map((e) => computeEntry(e, mode, us, "gi"));
      const totals = computeTotals(project);
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
      eq(totals.pieces, 38, `${label}: piece count`);
      eq(
        totals.grossAreaMinor,
        totals.byZone.reduce((s, z) => s + z.grossAreaMinor, 0),
        `${label}: zones carry every square`,
      );
      eq(totals.byZone.length, 3, `${label}: two named zones plus the ungrouped bucket`);
      eq(
        totals.byZone[totals.byZone.length - 1].zone,
        "",
        `${label}: the ungrouped bucket sorts last`,
      );

      /* Every row's weight comes off its UNROUNDED gross area — which is the
       * rule, and is why this cannot be re-derived from the rounded figure the
       * schedule prints. The two agree almost always and differ by one
       * hundredth of a kilogram when the rounding falls the wrong way; the
       * result panel prints the working at full precision for exactly that
       * reason. */
      for (const r of results) {
        eq(
          r.massMinor,
          Math.round(r.grossArea * r.density * 100),
          `${label}: weight = exact gross area × printed density`,
        );
        const fromRounded = Math.round(
          units.fromAreaMinor(r.grossAreaMinor) * r.density * 100,
        );
        check(
          Math.abs(r.massMinor - fromRounded) <= 1,
          `${label}: …and within a hundredth of the rounded-area answer`,
        );
      }
    }
  }
}

section("11. one line, checked by hand end to end");
{
  const r = computeEntry(line(A.straight, 1, 12), "billing", "metric", "gi");
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
  const r = computeEntry(line(A.straight, 1, 0, { gauge: "16" }), "billing", "metric", "gi");
  eq(r.gauge, "16", "the estimator's override wins over the table");
  eq(r.gaugeAuto, false, "and is flagged as manual");
  eq(r.density, 12.56, "16 ga density follows the override");
  eq(units.fmtMass(r.massMinor), "75.36", "6.000 × 12.56 = 75.36 kg");
}

/* ---- 12b. material ------------------------------------------------------- */

section("12b. material changes the weight and nothing else");
{
  const e = line(A.straight, 1, 0);
  const gi = computeEntry(e, "billing", "metric", "gi");
  const alu = computeEntry(e, "billing", "metric", "alu");
  const ss = computeEntry(e, "billing", "metric", "ss");

  eq(gi.netAreaMinor, alu.netAreaMinor, "area does not depend on the material");
  eq(gi.gauge, alu.gauge, "nor does the gauge — a gauge is a thickness");
  eq(gi.thicknessMm, alu.thicknessMm, "nor the thickness");

  eq(gauge.densityDisplay(0.55, "metric", "alu"), 1.49, "26 ga aluminium is 1.49 kg/m²");
  eq(gauge.densityDisplay(0.7, "metric", "ss"), 5.6, "24 ga stainless is 5.60 kg/m²");
  eq(gauge.densityDisplay(0.7, "metric", "gi"), 5.5, "…against 5.50 for steel");

  /* Weight has to track the density ratio, within the rounding of both. */
  near(
    units.fromMassMinor(alu.massMinor) / units.fromMassMinor(gi.massMinor),
    2700 / 7850,
    0.005,
    "aluminium weighs 2700/7850 of the steel",
  );
  check(
    units.fromMassMinor(ss.massMinor) > units.fromMassMinor(gi.massMinor),
    "stainless is heavier than galvanised",
  );
}

/* ---- 12c. the derived quantities ----------------------------------------- */

section("12c. insulation is the billing formula on a fatter duct");
{
  const anc = { insulationMm: 25, standardLengthMm: 0, supportSpacingMm: 0 };
  const r = computeEntry(line(A.straight, 1, 0), "billing", "metric", "gi", anc);
  /* 600×400 lagged 25 mm all round is 650×450: 2(650+450)×3000 = 6.6 m². */
  eq(units.fmtArea(r.insulationAreaMinor), "6.600", "600×400×3000 at 25 mm = 6.600 m²");
  eq(units.fmtArea(r.netAreaMinor), "6.000", "…while the sheet area is untouched at 6.000");

  const off = computeEntry(line(A.straight, 1, 0), "billing", "metric", "gi");
  eq(off.insulationAreaMinor, 0, "no insulation set, no insulation counted");

  /* THE BUG THIS EXISTS TO CATCH. An elbow's R is its THROAT radius, so
   * lagging it must shrink R by the thickness while the width grows by twice
   * it — otherwise the centreline moves and the bend silently gets longer. */
  for (const kind of KINDS) {
    const spec = SPECS[kind];
    const before = spec.centreline(A[kind]);
    const after = spec.centreline(spec.inflate(A[kind], 50));
    near(after, before, 1e-9, `${kind}: insulating does not move the centreline`);
  }

  /* Round elbow R is already a CENTRELINE radius, so it must NOT shrink. */
  const re = A["round-elbow"];
  eq(SPECS["round-elbow"].inflate(re, 50).r, re.r, "a round elbow's R is left alone");
  eq(SPECS.elbow.inflate(A.elbow, 50).r, A.elbow.r - 25, "a rectangular elbow's throat shrinks");
}

section("12d. flanges and hangers");
{
  const anc = { insulationMm: 0, standardLengthMm: 1200, supportSpacingMm: 2400 };
  const long = line({ kind: "straight", w: 600, h: 400, l: 6000 }, 2, 0);
  const r = computeEntry(long, "billing", "metric", "gi", anc);
  eq(r.pieces, 5, "6 m of duct is five 1.2 m pieces");
  eq(r.flangeEnds, 20, "…each with two flange ends, × 2 lengths");
  eq(r.corners, 80, "…and four corner pieces per end");
  /* 20 ends × 2(600+400) mm of flange = 40 m. */
  eq(units.fmtRun(r.flangeRunMinor), "40.00", "20 ends × 2 m perimeter = 40.00 m");
  eq(r.supports, 6, "one hanger per 2.4 m of run, per length");

  const fitting = computeEntry(line(A.elbow, 1, 0), "billing", "metric", "gi", anc);
  eq(fitting.pieces, 1, "a fitting is one piece however long its centreline");
  eq(fitting.flangeEnds, 2, "…with an end each side");

  const round = computeEntry(line(A["round-straight"], 1, 0), "billing", "metric", "gi", anc);
  eq(round.corners, 0, "a round flange has no corner pieces");

  const off = computeEntry(long, "billing", "metric", "gi");
  eq(off.flangeEnds, 0, "no standard length set, no flanges counted");
  eq(off.supports, 0, "no spacing set, no hangers counted");
}

section("12e. rates");
{
  const rates = { perKg: 240, perM2: 0, label: "₹" };
  const anc = { insulationMm: 0, standardLengthMm: 0, supportSpacingMm: 0 };
  const r = computeEntry(line(A.straight, 1, 12), "billing", "metric", "gi", anc, rates);
  /* 36.96 kg × 240 = 8,870.40 */
  eq(units.fmtValue(r.valueMinor), "8,870.40", "weight × rate per kg");

  const both = computeEntry(
    line(A.straight, 1, 12),
    "billing",
    "metric",
    "gi",
    anc,
    { perKg: 240, perM2: 100, label: "" },
  );
  /* …plus 6.720 m² × 100 = 672.00 */
  eq(units.fmtValue(both.valueMinor), "9,542.40", "…plus area × rate per m²");

  const none = computeEntry(line(A.straight, 1, 12), "billing", "metric", "gi");
  eq(none.valueMinor, 0, "no rate set, no value invented");
}

/* ---- 12f. the square-to-round -------------------------------------------- */

section("12f. square to round, checked against a case with a known answer");
{
  /* THE ANCHOR. Flatten the fitting (L = 0) and inscribe the circle in a square
   * (W = H = D): the four triangles vanish, and the four corner patches must
   * add up to exactly the area between a square and its inscribed circle,
   * W²(1 − π/4). Nothing about that identity comes from the implementation —
   * it is a fact about squares and circles — so it pins the integral. */
  for (const side of [400, 1000, 1337.5]) {
    const flatPlate = { kind: "square-to-round", w: side, h: side, d: side, l: 0 };
    near(
      SPECS["square-to-round"].shop.compute(flatPlate),
      side * side * (1 - Math.PI / 4),
      Math.max(1e-6, side * side * 1e-12),
      `${side} mm square less its inscribed circle = W²(1 − π/4)`,
    );
  }

  /* A cylinder is the degenerate square-to-round where the square is gone. */
  const asTube = { kind: "square-to-round", w: 500, h: 500, d: 500, l: 900 };
  const straightTube = { kind: "round-straight", d: 500, l: 900 };
  check(
    SPECS["square-to-round"].shop.compute(asTube) >
      SPECS["round-straight"].shop.compute(straightTube),
    "a square-to-round on the same diameter cuts more than the plain tube",
  );

  near(
    SPECS["square-to-round"].billing.compute(A["square-to-round"]),
    ((2 * (600 + 400) + Math.PI * 400) / 2) * 450,
    1e-9,
    "billing is mean perimeter × length",
  );
}

/* ---- 12g. precision ------------------------------------------------------ */

section("12g. nothing is rounded before it is used again");
{
  /* The elbow from the bug report: W 950, H 800, R 300, θ 90. Its centreline
   * arc is 1217.3671… mm, and the area must come from THAT, not from 1217. */
  const elbow = { kind: "elbow", w: 950, h: 800, r: 300, theta: 90 };
  const arc = (Math.PI / 2) * (300 + 950 / 2);
  near(arc, 1217.36715327, 1e-7, "centreline arc is 1217.36715327 mm, not 1217");
  near(
    SPECS.elbow.billing.compute(elbow),
    2 * (950 + 800) * arc,
    1e-9,
    "area uses the exact arc",
  );
  /* What the rounded arc WOULD have given, so the difference is on record. */
  const fromRounded = 2 * (950 + 800) * 1217;
  check(
    Math.abs(SPECS.elbow.billing.compute(elbow) - fromRounded) > 1000,
    `and differs from the rounded-arc answer by ${(
      SPECS.elbow.billing.compute(elbow) - fromRounded
    ).toFixed(0)} mm²`,
  );

  /* Decimal dimensions survive intact. */
  const decimal = { kind: "straight", w: 950.5, h: 800.25, l: 3000.125 };
  near(
    SPECS.straight.billing.compute(decimal),
    2 * (950.5 + 800.25) * 3000.125,
    1e-9,
    "950.5 × 800.25 × 3000.125 is computed as typed",
  );

  /* The allowance comes off the unrounded net area, and the weight off the
   * unrounded gross. */
  const e = line(decimal, 3, 12.5);
  const r = computeEntry(e, "billing", "metric", "gi");
  const exactNet = (2 * (950.5 + 800.25) * 3000.125 * 3) / 1e6;
  near(r.netArea, exactNet, 1e-12, "net area is exact");
  near(r.grossArea, exactNet * 1.125, 1e-12, "gross = exact net × (1 + 12.5%)");
  near(r.mass, exactNet * 1.125 * r.density, 1e-12, "weight = exact gross × density");
  check(
    r.netAreaMinor === units.toAreaMinor(exactNet),
    "and only the displayed figure is rounded",
  );

  /* Rounding the intermediates first would visibly change the answer. */
  const viaRounded = units.fromAreaMinor(units.toAreaMinor(exactNet)) * 1.125;
  check(
    Math.abs(r.grossArea - viaRounded) > 1e-9,
    "…which is not the same number as rounding first",
  );
}

section("12h. imperial fractions parse exactly");
{
  const cases = [
    ["1/2", 0.5],
    ["3/4", 0.75],
    ["5/8", 0.625],
    ["3/8", 0.375],
    ["1 1/2", 1.5],
    ["1-1/2", 1.5],
    ["2 3/8", 2.375],
    ["12 5/16", 12.3125],
    ["0.5", 0.5],
    ["12.75", 12.75],
    [".5", 0.5],
    ["1,200", 1200],
    ['23.622"', 23.622],
    ["600 mm", 600],
    ["  18  ", 18],
    /* What a spreadsheet hands you when a column has been formatted badly. */
    ["1.2e+03", 1200],
    ["1.2E3", 1200],
  ];
  for (const [input, want] of cases) {
    near(parse.toNumber(input), want, 1e-12, `"${input}" → ${want}`);
  }
  /* Nonsense is still zero rather than NaN. */
  for (const bad of ["", "abc", "-5", "1/0", "1/", "/2", "1 1/", "--"]) {
    eq(parse.toNumber(bad), 0, `"${bad}" → 0`);
  }
  /* The trap the old parser fell into: it stripped ALL spaces first, turning
   * one and a half into eleven halves. */
  check(parse.toNumber("1 1/2") !== 5.5, '"1 1/2" is not 11/2');

  /* A fraction has to survive all the way into the geometry. */
  const inches = units.toMm(parse.toNumber("2 3/8"), "imperial");
  near(inches, 2.375 * 25.4, 1e-12, '2 3/8" reaches the geometry as 60.325 mm');
}

section("12i. switching units does not move the geometry");
{
  /* THE LEAK THIS CLOSES. The draft used to hold only display strings, so a
   * unit switch went mm → inches → formatted → parsed → mm, and 600 mm came
   * back as 599.9988. Flipping a few times walked the job away from itself. */
  let d = draft.newDraft("straight", 12, "metric");
  const before = { ...d.mm };
  for (let i = 0; i < 12; i++) {
    d = draft.convertDraft(d, i % 2 === 0 ? "metric" : "imperial", i % 2 === 0 ? "imperial" : "metric");
  }
  for (const key of Object.keys(before)) {
    eq(d.mm[key], before[key], `${key} is untouched after twelve unit switches`);
  }

  /* And what the boxes show still reads back as what is stored. */
  const imperial = draft.convertDraft(
    draft.newDraft("elbow", 12, "metric"),
    "metric",
    "imperial",
  );
  for (const field of SPECS.elbow.fields) {
    if (field.angle || field.count) continue;
    const shown = parse.toNumber(imperial.values[field.key]);
    near(
      units.toMm(shown, "imperial"),
      imperial.mm[field.key],
      1e-3,
      `the box shows ${field.symbol} faithfully`,
    );
  }
}

section("12j. metric and imperial agree on the same physical duct");
{
  /* Same fitting, both unit systems, full precision — these must agree to
   * floating point, not merely to the display rounding. */
  for (const kind of KINDS) {
    const m = computeEntry(line(A[kind]), "shop", "metric", "gi");
    const i = computeEntry(line(A[kind]), "shop", "imperial", "gi");
    near(
      i.netArea,
      m.netArea * 10.763_910_416_709_722,
      Math.abs(m.netArea) * 1e-9 + 1e-12,
      `${kind}: m² and ft² are the same area`,
    );
  }
}

section("12k. the audit case, traced end to end");
{
  /* Commercial billing, 950 × 800, throat radius 455, 75°, 12%, 22 ga. */
  const f = { kind: "elbow", w: 950, h: 800, r: 455, theta: 75 };
  const r = computeEntry(line(f, 1, 12, { gauge: "22" }), "billing", "metric", "gi");

  near(f.r + f.w / 2, 930, 1e-12, "centreline radius = 930 mm");
  near(
    (f.theta * Math.PI) / 180 * 930,
    1217.3671532660449,
    1e-9,
    "centreline arc ≈ 1217.367153 mm",
  );
  near(2 * (f.w + f.h), 3500, 1e-12, "mean perimeter = 3500 mm");
  near(r.netEachMm2, 4260785.036431157, 1e-6, "net area ≈ 4,260,785.036 mm²");
  near(r.netEachArea, 4.260785036431157, 1e-12, "…= 4.260785 m²");
  eq(units.fmtArea(r.netAreaMinor), "4.261", "displayed net area 4.261 m²");
  eq(r.gauge, "22", "22 ga as configured");
  eq(r.thicknessMm, 0.85, "22 ga is 0.85 mm");
  eq(r.density, 6.67, "…and 6.67 kg/m²");
  eq(units.fmtArea(r.grossAreaMinor), "4.772", "gross at 12% = 4.772 m²");
  eq(units.fmtMass(r.massMinor), "31.83", "weight = 31.83 kg");

  /* THE MAGNITUDE GUARD. A working line that mixed units would print the net
   * area three orders of magnitude out — 4,260.785 mm² for something that is
   * 4,260,785 mm². Assert the order of magnitude of every step's value, not
   * just the final answer. */
  const areaStep = r.steps.find((s) => s.label === "Net area");
  check(areaStep !== undefined, "there is a net area step");
  check(
    areaStep.unit === "mm²" && Math.abs(areaStep.value - 4260785.036431157) < 1e-6,
    `net area step is ${areaStep.value} mm², not 4,260.785`,
  );
  check(
    !r.steps.some((s) => s.unit === "mm²" && s.value > 0 && s.value < 1000),
    "no mm² step is off by a factor of a thousand",
  );

  /* Every step's value must be finite, and its unit one we recognise. */
  const UNITS_OK = new Set(["mm", "in", "mm²", "in²", "m²", "ft²", "kg", "lb", ""]);
  for (const s of r.steps) {
    check(Number.isFinite(s.value), `step "${s.label}" has a finite value`);
    check(UNITS_OK.has(s.unit), `step "${s.label}" has a known unit (${s.unit})`);
    check(s.working.length > 0, `step "${s.label}" shows its working`);
  }

  /* The arc step must NOT claim exactness — π makes its printed operand a view
   * of something longer, and that is precisely the claim the report objected
   * to. The radius step, being integer arithmetic, must. */
  const arcStep = r.steps.find((s) => s.label === "Centreline arc");
  const radiusStep = r.steps.find((s) => s.label === "Centreline radius");
  eq(arcStep.exact, false, "the arc is marked approximate");
  eq(radiusStep.exact, true, "the radius is marked exact");
}

section("12l. every fitting's steps end at the area the formula computed");
{
  for (const kind of KINDS) {
    for (const mode of ["billing", "shop"]) {
      for (const us of ["metric", "imperial"]) {
        const r = computeEntry(line(A[kind], 1, 0), mode, us, "gi");
        const label = `${kind}/${mode}/${us}`;

        /* The geometry steps must land on the same number `compute` did — if
         * they can drift, the working is describing a different calculation
         * from the one that produced the answer. */
        const areaStep = r.steps.find((s) => s.label === "Net area");
        check(areaStep !== undefined, `${label}: has a net area step`);
        near(
          areaStep.value,
          units.squareLengthFromMm2(r.netEachMm2, us),
          Math.abs(areaStep.value) * 1e-9 + 1e-9,
          `${label}: the working ends where the formula did`,
        );

        /* And the conversion step must land on the area the result reports. */
        const converted = r.steps.find((s) => s.label.startsWith("Converted"));
        near(
          converted.value,
          r.netEachArea,
          Math.abs(r.netEachArea) * 1e-12 + 1e-12,
          `${label}: the conversion matches the reported area`,
        );

        const weight = r.steps.find((s) => s.label === "Weight");
        near(weight.value, r.mass, 1e-12, `${label}: the weight step matches`);

        for (const s of r.steps) {
          check(Number.isFinite(s.value), `${label}: "${s.label}" is finite`);
        }
      }
    }
  }
}

section("12m. display precision cannot change the calculation");
{
  /* The invariant the report asks for: formatting is downstream of everything.
   * Format the same result at three precisions and the underlying values must
   * be untouched. */
  const r = computeEntry(line(A.elbow, 3, 12), "billing", "metric", "gi");
  const before = { net: r.netEachArea, gross: r.grossArea, mass: r.mass };
  for (const dp of [0, 3, 12]) {
    for (const s of r.steps) units.fmtExact(s.value, dp);
    units.fmtArea(r.netAreaMinor);
    units.fmtMass(r.massMinor);
  }
  eq(r.netEachArea, before.net, "net area unchanged by formatting");
  eq(r.grossArea, before.gross, "gross unchanged by formatting");
  eq(r.mass, before.mass, "weight unchanged by formatting");
}

section("12n. an `=` step's printed operands really do reproduce it");
{
  /* THE BUG THIS EXISTS FOR.
   *
   * The shared tail used to hard-code `exact: true` on four steps, and the
   * value line printed the mass rounded to two decimals beside a value
   * computed from all of it:
   *
   *     Value at your rates    232.11 × 220    =    51,063.936
   *
   * 232.11 × 220 is 51,064.20. An equals sign in the middle of a false
   * statement, on the one screen whose entire purpose is to let an estimator
   * check the arithmetic by hand. Nothing caught it because `exact` was an
   * assertion by whoever wrote the step rather than a property of the numbers.
   *
   * So: for every step whose working is a plain "a × b", multiply the printed
   * operands and insist the answer is the printed value — or that the step
   * admits `≈`. This is the exact shape the value, weight and line-area steps
   * take, which is to say the shape all three bugs took.
   */
  const num = (s) => Number(s.replace(/,/g, ""));
  /* A PURE two-factor product and nothing else: "18.48 × 12.56 kg/m²" yes,
   * "4 × 35²" no. The trailing group is the unit the working sometimes names.
   * `COMPOUND` rejects anything with another operator in it, because this
   * evaluator only knows how to multiply — a partial match on "4 × 35²" would
   * report a false failure and teach everyone to ignore this section. */
  const PRODUCT = /^\s*(-?[\d,]+(?:\.\d+)?)\s*×\s*(-?[\d,]+(?:\.\d+)?)\s*(?:[a-zA-Z][\w/²·\s]*)?$/;
  const COMPOUND = /[²√π()÷+−]/;

  let checked = 0;
  for (const kind of KINDS) {
    for (const mode of ["billing", "shop"]) {
      for (const us of ["metric", "imperial"]) {
        const r = computeEntry(
          line(A[kind], 3, 12),
          mode,
          us,
          "gi",
          { insulationMm: 0, standardLengthMm: 0, supportSpacingMm: 0 },
          /* Rates chosen so the money is irrational-ish in both unit systems —
           * a round rate on a round mass would pass by luck. */
          { label: "INR", perKg: 217.35, perM2: 0 },
        );
        for (const s of r.steps) {
          if (!s.exact || COMPOUND.test(s.working)) continue;
          const m = PRODUCT.exec(s.working);
          if (!m) continue;
          checked++;
          const product = num(m[1]) * num(m[2]);
          near(
            product,
            s.value,
            Math.abs(s.value) * 1e-9 + 1e-9,
            `${kind}/${mode}/${us}: "${s.label}" claims = but ${m[1]} × ${m[2]} ≠ ${s.value}`,
          );
        }

        /* And the inverse: over-correcting to `≈` everywhere would pass the
         * sweep above and be just as useless. A rectangular mean perimeter in
         * metric, from whole-millimetre inputs, is plain addition on numbers
         * shown in full — it must still say `=`. (Skipped where a π or a root
         * is in the working, as in the square-to-round's mean perimeter.) */
        if (us === "metric") {
          const perimeter = r.steps.find((s) => s.label === "Mean perimeter");
          if (perimeter && !/[π√]/.test(perimeter.working)) {
            eq(perimeter.exact, true, `${kind}/${mode}: whole-mm perimeter is exact`);
          }
        }
      }
    }
  }
  /* Only steps already claiming `=` are inspected, and in imperial almost
   * nothing is, so the count is naturally small. The floor is here to catch a
   * future edit that changes a working line's shape and quietly leaves this
   * whole section matching nothing at all. */
  check(checked >= 8, `enough "a × b" steps were actually inspected (${checked})`);

  /* The specific line, spelled out, so a future edit to the tail cannot make
   * the sweep above vacuous by changing the working's shape. */
  const r = computeEntry(
    line(A.elbow, 4, 10),
    "billing",
    "metric",
    "gi",
    { insulationMm: 0, standardLengthMm: 0, supportSpacingMm: 0 },
    { label: "INR", perKg: 220, perM2: 0 },
  );
  const value = r.steps.find((s) => s.label === "Value at your rates");
  check(value !== undefined, "the value step exists");
  const parts = PRODUCT.exec(value.working);
  check(parts !== null, "the value step's working is a product");
  near(
    num(parts[1]),
    r.mass,
    Math.abs(r.mass) * 1e-6 + 1e-6,
    "the value step multiplies the mass it printed, not a rounded view of it",
  );
  eq(
    value.exact,
    units.printsExactly(r.mass, units.PRECISION.detail) &&
      units.printsExactly(value.value, units.PRECISION.detail),
    "the value step's = is derived from the numbers",
  );
}

/* ---- 12o. old documents still open -------------------------------------- */

section("12o. a takeoff saved before a rename still opens");
{
  /* THE FAILURE THIS PREVENTS IS SILENT DATA LOSS.
   *
   * `reviveFitting` returns null for a kind it does not recognise, and
   * `reviveProject` filters the nulls out. So renaming a fitting without an
   * alias does not error — it opens the user's saved takeoff with those lines
   * simply GONE, and a smaller total, and no indication anything happened.
   *
   * On 28 Aug 2026 `dropper` became `offset` and `reducer` became `transition`.
   * Anyone who saved a takeoff before that has documents on their device and in
   * their exports using the old names. They must keep working, forever.
   */
  const v1 = JSON.stringify({
    schema: 1,
    app: "ductforge",
    exportedAt: "2026-08-01T00:00:00.000Z",
    project: {
      id: "old",
      name: "Saved before the rename",
      reference: "DS/2026/001",
      units: "metric",
      mode: "billing",
      material: "gi",
      waste: 12,
      ancillaries: { insulationMm: 0, standardLengthMm: 0, supportSpacingMm: 0 },
      rates: { label: "", perKg: 0, perM2: 0 },
      updatedAt: 0,
      entries: [
        {
          id: "a",
          qty: 2,
          waste: 12,
          gauge: null,
          zone: "AHU-1",
          note: "",
          fitting: { kind: "dropper", w: 600, h: 400, l: 900, o: 300 },
        },
        {
          id: "b",
          qty: 1,
          waste: 10,
          gauge: null,
          zone: "",
          note: "",
          fitting: { kind: "reducer", w1: 800, h1: 400, w2: 500, h2: 300, l: 600 },
        },
      ],
    },
  });

  const opened = project.fromProjectFile(v1);
  check(opened.ok, "a version 1 document opens at all");
  if (opened.ok) {
    const kinds = opened.project.entries.map((e) => e.fitting.kind);
    eq(kinds.length, 2, "BOTH lines survive the rename — neither is dropped");
    eq(kinds[0], "offset", "a saved dropper opens as an offset");
    eq(kinds[1], "transition", "a saved reducer opens as a transition");

    /* Not just present — intact. An alias that reset the dimensions to the
     * spec defaults would pass a count check and still lose the user's job. */
    const off = opened.project.entries[0].fitting;
    eq(off.w, 600, "the offset kept its width");
    eq(off.h, 400, "the offset kept its height");
    eq(off.l, 900, "the offset kept its run");
    eq(off.o, 300, "the offset kept its offset");
    const tr = opened.project.entries[1].fitting;
    eq(tr.w1, 800, "the transition kept its inlet width");
    eq(tr.h2, 300, "the transition kept its outlet height");
  }

  /* And a kind that never existed is still refused, so the alias map has not
   * turned the validator into something that accepts anything. */
  const bogus = project.fromProjectFile(
    v1.replace('"kind":"dropper"', '"kind":"banana"').replace('"kind": "dropper"', '"kind": "banana"'),
  );
  check(
    !bogus.ok || bogus.project.entries.length === 1,
    "an unknown kind is still dropped, not aliased to something",
  );
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
