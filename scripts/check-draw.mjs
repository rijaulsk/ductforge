/* Drawing geometry verification. Run with `npm run check:draw`.
 *
 * WHY THIS IS SEPARATE FROM THE ENGINE CHECK. A wrong AREA is a number you can
 * assert against. A wrong DRAWING is not — but a BROKEN drawing very much is,
 * and it fails in one specific way: a NaN leaks into a coordinate, SVG rejects
 * the whole path, and the fitting renders as an empty box. Nothing throws,
 * nothing logs, and a build passes with a blank viewer.
 *
 * So this asserts the properties a drawing must have to exist at all — every
 * coordinate finite, every view non-empty, the geometry inside its own viewBox,
 * every dimension labelled — across all six fittings, all three views, both
 * unit systems, and a set of degenerate inputs (zero angle, zero offset, equal
 * ends) that have no business crashing the viewer.
 *
 * It does not claim the drawings are CORRECT. That is a visual review.
 */

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

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

const { buildView, VIEW_W, VIEW_H } = await import("../lib/draw/index.ts");
const { SPECS, FITTING_KINDS } = await import("../lib/duct/formulas.ts");

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  FAIL  ${label}`);
  }
};

const VIEWS = ["blueprint", "flat", "iso"];
const UNITS = ["metric", "imperial"];

/** Pull every number out of an SVG path string. */
function numbersIn(d) {
  return (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
}

function audit(fitting, view, us, label) {
  let scene;
  try {
    scene = buildView(fitting, view, us);
  } catch (err) {
    check(false, `${label}: threw ${String(err)}`);
    return;
  }

  check(scene.shapes.length > 0, `${label}: draws something`);

  /* The failure mode this whole file exists for. */
  let bad = 0;
  let outside = 0;
  for (const s of scene.shapes) {
    if (/NaN|Infinity|undefined/.test(s.d)) bad++;
    for (const n of numbersIn(s.d)) {
      if (!Number.isFinite(n)) bad++;
      /* A generous margin: dimension text lives outside the geometry, but a
       * coordinate hundreds of units off-canvas means the fit failed. */
      if (n < -400 || n > Math.max(VIEW_W, VIEW_H) + 400) outside++;
    }
  }
  check(bad === 0, `${label}: no NaN or Infinity in any path (${bad} found)`);
  check(outside === 0, `${label}: geometry fits the viewBox (${outside} stray coordinates)`);

  for (const d of scene.dims) {
    if (d.d !== undefined) {
      check(!/NaN|Infinity/.test(d.d), `${label}: dimension line is finite`);
    }
    check(
      Number.isFinite(d.x) && Number.isFinite(d.y),
      `${label}: dimension label is positioned`,
    );
    check(typeof d.text === "string" && d.text.length > 0, `${label}: dimension is labelled`);
    check(!/NaN|undefined/.test(d.text), `${label}: label reads "${d.text}"`);
  }

  for (const c of scene.captions) {
    check(Number.isFinite(c.x) && Number.isFinite(c.y), `${label}: caption is positioned`);
  }
}

console.log("1. every fitting, every view, both unit systems");
for (const kind of FITTING_KINDS) {
  for (const view of VIEWS) {
    for (const us of UNITS) {
      audit(SPECS[kind].defaults, view, us, `${kind}/${view}/${us}`);
    }
  }
}

console.log("\n2. every dimension of the drawing is a dimension of the formula");
for (const kind of FITTING_KINDS) {
  const spec = SPECS[kind];
  const scene = buildView(spec.defaults, "blueprint", "metric");
  const labels = [...scene.dims.map((d) => d.text)].join(" ");
  for (const field of spec.fields) {
    const value = spec.defaults[field.key];
    const shown = field.angle ? `${value}°` : String(value);
    check(
      labels.includes(shown),
      `${kind}: the blueprint calls out ${field.symbol} (${shown})`,
    );
  }
}

console.log("\n3. degenerate geometry does not break the viewer");
const DEGENERATE = [
  ["straight, zero length", { kind: "straight", w: 600, h: 400, l: 0 }],
  ["straight, everything zero", { kind: "straight", w: 0, h: 0, l: 0 }],
  ["reducer, no reduction", { kind: "reducer", w1: 500, h1: 400, w2: 500, h2: 400, l: 600 }],
  ["reducer, growing not shrinking", { kind: "reducer", w1: 200, h1: 200, w2: 900, h2: 700, l: 400 }],
  ["reducer, zero length", { kind: "reducer", w1: 800, h1: 400, w2: 500, h2: 300, l: 0 }],
  ["elbow, 1 degree", { kind: "elbow", w: 600, h: 400, r: 300, theta: 1 }],
  ["elbow, 180 degrees", { kind: "elbow", w: 600, h: 400, r: 300, theta: 180 }],
  ["elbow, zero throat radius", { kind: "elbow", w: 600, h: 400, r: 0, theta: 90 }],
  ["elbow, 359 degrees", { kind: "elbow", w: 300, h: 300, r: 400, theta: 359 }],
  ["dropper, no offset", { kind: "dropper", w: 600, h: 400, l: 900, o: 0 }],
  ["dropper, offset only", { kind: "dropper", w: 600, h: 400, l: 0, o: 500 }],
  ["collar, no flange", { kind: "collar", w: 300, h: 300, l: 250, f: 0 }],
  ["collar, flange larger than neck", { kind: "collar", w: 100, h: 100, l: 40, f: 90 }],
  ["wye, equal branches", { kind: "wye", w1: 800, h: 400, w2: 400, w3: 400, r: 250, theta: 45 }],
  ["wye, 90 degree branches", { kind: "wye", w1: 800, h: 400, w2: 400, w3: 400, r: 200, theta: 90 }],
  ["wye, zero radius", { kind: "wye", w1: 800, h: 400, w2: 500, w3: 400, r: 0, theta: 45 }],
  ["wye, tiny branch", { kind: "wye", w1: 2000, h: 400, w2: 100, w3: 100, r: 100, theta: 30 }],
];
for (const [label, fitting] of DEGENERATE) {
  for (const view of VIEWS) {
    audit(fitting, view, "metric", `${label} (${view})`);
  }
}

console.log("\n4. the frame is filled, whatever the fitting's size");

/* Endpoints of every M, L and A command — a real bounding box rather than the
 * min and max of every number in the path, which would fold arc radii and
 * sweep flags in with the coordinates. */
function pointsIn(d) {
  const pts = [];
  for (const seg of d.match(/[MLA][^MLAZ]*/g) ?? []) {
    const n = numbersIn(seg.slice(1));
    if (n.length >= 2) pts.push([n[n.length - 2], n[n.length - 1]]);
  }
  return pts;
}

function fillRatio(scene) {
  const pts = scene.shapes.flatMap((s) => pointsIn(s.d));
  if (pts.length === 0) return 0;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  /* 54 px of padding per side is reserved for dimension lines. */
  return Math.max(
    (Math.max(...xs) - Math.min(...xs)) / (VIEW_W - 108),
    (Math.max(...ys) - Math.min(...ys)) / (VIEW_H - 108),
  );
}

const SIZES = [
  ["a 150 mm collar of a duct", { kind: "straight", w: 100, h: 100, l: 150 }],
  ["a 12 m riser", { kind: "straight", w: 2400, h: 1800, l: 12000 }],
  ["a tight elbow", { kind: "elbow", w: 200, h: 150, r: 100, theta: 90 }],
  ["a large elbow", { kind: "elbow", w: 2000, h: 1500, r: 1200, theta: 90 }],
];
for (const view of VIEWS) {
  for (const [label, fitting] of SIZES) {
    const ratio = fillRatio(buildView(fitting, view, "metric"));
    check(
      ratio > 0.55 && ratio < 1.02,
      `${view}: ${label} fills the frame (${(ratio * 100).toFixed(0)}% of the available axis)`,
    );
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
