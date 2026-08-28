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
 * every dimension labelled — across all ten fittings, all three views, both
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

/**
 * `strictLabels` is off for the degenerate inputs, and that is a stated rule
 * rather than a dodge: a fitting with a zero length or a one-degree sweep is
 * not a drawing anybody reads, and it has no tidy annotation layout to have.
 * What those cases must do is not CRASH — every other assertion here still
 * runs on them. Geometries that are awkward but real — a 180° U-bend, a small
 * branch off a large main — are checked strictly, in their own section.
 */
function audit(fitting, view, us, label, strictLabels = true) {
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

  if (!strictLabels) return;

  const labels = labelsOf(scene);
  const clashes = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (overlaps(labels[i].box, labels[j].box)) {
        clashes.push(`${labels[i].what} over ${labels[j].what}`);
      }
    }
  }
  check(
    clashes.length === 0,
    `${label}: ${labels.length} labels, none overlapping${
      clashes.length ? ` — ${clashes.slice(0, 3).join("; ")}` : ""
    }`,
  );
}

/* THE BUG THIS EXISTS TO CATCH, and it shipped once.
 *
 * Labels are sized in VIEW pixels — 16px text, offset 30px from the geometry —
 * while the scenes that place them are laid out in MODEL millimetres. A flat
 * pattern's gap between blanks was a fraction of the model's own size, so on
 * any drawing that scaled down, two facing dimension lines and a caption all
 * landed in a gap worth twenty pixels and printed over one another. Nothing
 * threw, nothing looked wrong to any other check, and the numbers were
 * unreadable.
 *
 * The box is estimated rather than measured — there is no text engine here —
 * so it is deliberately a little narrower than the real glyphs to keep this
 * from crying wolf. It catches labels ON each other, not labels merely close.
 */
const CHAR_W = 8.4;
const LINE_H = 17;

function labelBox(text, x, y, angle = 0) {
  let w = String(text).length * CHAR_W + 4;
  let h = LINE_H;
  /* A rotated label occupies the other axis. Anything past 45° is closer to
   * vertical than horizontal. */
  const a = Math.abs(((angle % 180) + 180) % 180);
  if (a > 45 && a < 135) [w, h] = [h, w];
  /* Shrink slightly: the estimate is crude and touching is not overlapping. */
  return { x0: x - w / 2 + 2, x1: x + w / 2 - 2, y0: y - h / 2 + 2, y1: y + h / 2 - 2 };
}

function overlaps(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/* Declared before section 1 runs, because `audit` reaches for CHAR_W and a
 * `const` in the temporal dead zone throws rather than reading as undefined. */
function labelsOf(scene) {
  const boxes = [];
  for (const d of scene.dims) {
    boxes.push({
      what: `"${d.text}"`,
      box: labelBox(d.text, d.x, d.y, d.t === "len" ? d.angle : 0),
    });
  }
  for (const c of scene.captions) {
    boxes.push({ what: `caption "${c.text}"`, box: labelBox(c.text, c.x, c.y) });
  }
  return boxes;
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
  ["transition, no reduction", { kind: "transition", w1: 500, h1: 400, w2: 500, h2: 400, l: 600 }],
  ["transition, growing not shrinking", { kind: "transition", w1: 200, h1: 200, w2: 900, h2: 700, l: 400 }],
  ["transition, zero length", { kind: "transition", w1: 800, h1: 400, w2: 500, h2: 300, l: 0 }],
  ["elbow, 1 degree", { kind: "elbow", w: 600, h: 400, r: 300, theta: 1 }],
  ["elbow, 180 degrees", { kind: "elbow", w: 600, h: 400, r: 300, theta: 180 }],
  ["elbow, zero throat radius", { kind: "elbow", w: 600, h: 400, r: 0, theta: 90 }],
  ["elbow, 359 degrees", { kind: "elbow", w: 300, h: 300, r: 400, theta: 359 }],
  ["offset, straight through", { kind: "offset", w: 600, h: 400, l: 900, o: 0 }],
  ["offset, no run", { kind: "offset", w: 600, h: 400, l: 0, o: 500 }],
  ["collar, no flange", { kind: "collar", w: 300, h: 300, l: 250, f: 0 }],
  ["collar, flange larger than neck", { kind: "collar", w: 100, h: 100, l: 40, f: 90 }],
  ["wye, equal branches", { kind: "wye", w1: 800, h: 400, w2: 400, w3: 400, r: 250, theta: 45 }],
  ["wye, 90 degree branches", { kind: "wye", w1: 800, h: 400, w2: 400, w3: 400, r: 200, theta: 90 }],
  ["wye, zero radius", { kind: "wye", w1: 800, h: 400, w2: 500, w3: 400, r: 0, theta: 45 }],
  ["wye, tiny branch", { kind: "wye", w1: 2000, h: 400, w2: 100, w3: 100, r: 100, theta: 30 }],
  ["round duct, zero length", { kind: "round-straight", d: 400, l: 0 }],
  ["round elbow, two gores", { kind: "round-elbow", d: 400, r: 600, theta: 90, gores: 2 }],
  ["round elbow, sixteen gores", { kind: "round-elbow", d: 400, r: 600, theta: 90, gores: 16 }],
  ["round elbow, tight radius", { kind: "round-elbow", d: 600, r: 300, theta: 90, gores: 4 }],
  ["round elbow, 180 degrees", { kind: "round-elbow", d: 300, r: 450, theta: 180, gores: 6 }],
  /* The cone development divides by (r1 − r2), so a round reducer that reduces
   * nothing is a division by zero unless the degenerate branch catches it. */
  ["round reducer, no taper", { kind: "round-reducer", d1: 400, d2: 400, l: 600 }],
  ["round reducer, flat annulus", { kind: "round-reducer", d1: 800, d2: 300, l: 0 }],
  ["round reducer, growing", { kind: "round-reducer", d1: 200, d2: 900, l: 400 }],
  ["square to round, flat plate", { kind: "square-to-round", w: 500, h: 500, d: 500, l: 0 }],
  ["square to round, zero diameter", { kind: "square-to-round", w: 600, h: 400, d: 0, l: 400 }],
  ["square to round, round bigger", { kind: "square-to-round", w: 300, h: 300, d: 900, l: 400 }],
];
for (const [label, fitting] of DEGENERATE) {
  for (const view of VIEWS) {
    audit(fitting, view, "metric", `${label} (${view})`, false);
  }
}

console.log("\n3b. awkward but real geometries keep their labels apart");

/* These are fittings somebody will actually specify, and every one of them
 * found a label collision the default sizes did not: a U-bend puts its radius
 * callout on top of its angle, a small branch off a large main crowds its
 * width dimension into the same corner, and a Y-piece develops into six blanks
 * whose captions are wider than the blanks are. */
const AWKWARD = [
  ["180° U-bend", { kind: "elbow", w: 400, h: 300, r: 200, theta: 180 }],
  ["45° elbow", { kind: "elbow", w: 600, h: 400, r: 300, theta: 45 }],
  ["tight-radius elbow", { kind: "elbow", w: 800, h: 400, r: 150, theta: 90 }],
  ["small branch off a large main", { kind: "wye", w1: 2000, h: 400, w2: 150, w3: 150, r: 150, theta: 30 }],
  ["90° Y-piece", { kind: "wye", w1: 900, h: 400, w2: 450, w3: 450, r: 200, theta: 90 }],
  ["deep flange collar", { kind: "collar", w: 250, h: 250, l: 150, f: 50 }],
  ["big-ratio transition", { kind: "transition", w1: 1600, h1: 900, w2: 250, h2: 200, l: 500 }],
  ["two-gore round elbow", { kind: "round-elbow", d: 500, r: 750, theta: 90, gores: 2 }],
  ["six-gore round elbow", { kind: "round-elbow", d: 500, r: 750, theta: 90, gores: 6 }],
  ["steep cone", { kind: "round-reducer", d1: 900, d2: 150, l: 200 }],
  ["AHU square to round", { kind: "square-to-round", w: 1200, h: 700, d: 500, l: 500 }],
  ["shallow square to round", { kind: "square-to-round", w: 500, h: 500, d: 450, l: 150 }],
];
for (const [label, fitting] of AWKWARD) {
  for (const view of VIEWS) {
    for (const us of UNITS) {
      audit(fitting, view, us, `${label} (${view}/${us})`);
    }
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

console.log("\n5. the picker glyphs draw the right object");

/* THE BUG THIS EXISTS FOR, and it shipped and stayed shipped.
 *
 * The offset's glyph ran its top wall from y=6 to y=20 and its bottom from
 * y=15 to y=25 — two different slopes — so the duct narrowed along its length
 * and its end caps came out 9 units and 5. An offset keeps ONE section all the
 * way through; what the icon drew was a taper.
 *
 * Nothing in this file could see it. Every coordinate was finite, every path
 * inside its box, no label overlapped anything. It took a ductworker of ten
 * years glancing at the picker to say "that's a taper" — and he was right,
 * while the formula and the blueprint beside it were both correct.
 *
 * So the glyphs get asserted on the properties that define the object, not on
 * being well-formed. A drawing can be perfectly valid and still a lie.
 */
{
  const { GLYPH_PATHS } = await import("../lib/duct/glyphs.ts");

  for (const kind of FITTING_KINDS) {
    const d = GLYPH_PATHS[kind];
    check(typeof d === "string" && d.length > 0, `${kind}: has a glyph`);
    check(!/NaN|undefined/.test(d), `${kind}: glyph has no NaN`);
    for (const n of numbersIn(d)) {
      check(Number.isFinite(n) && n >= -2 && n <= 46, `${kind}: glyph point ${n} is in its box`);
    }
  }

  /* Vertical end caps, as `M x y1 V y2` or `M x y1 L x y2`. */
  const capsIn = (d) =>
    [...d.matchAll(/M\s*(-?[\d.]+)\s+(-?[\d.]+)V\s*(-?[\d.]+)/g)].map((m) =>
      Math.abs(Number(m[3]) - Number(m[2])),
    );

  const straightCaps = capsIn(GLYPH_PATHS.straight);
  check(straightCaps.length === 2, `straight: two end caps (${straightCaps.length})`);
  check(
    straightCaps.length === 2 && Math.abs(straightCaps[0] - straightCaps[1]) < 0.001,
    `straight: a plain duct does not change section (${straightCaps.join(" vs ")})`,
  );

  const offsetCaps = capsIn(GLYPH_PATHS.offset);
  check(offsetCaps.length === 2, `offset: two end caps (${offsetCaps.length})`);
  check(
    offsetCaps.length === 2 && Math.abs(offsetCaps[0] - offsetCaps[1]) < 0.001,
    `offset: SAME SECTION AT BOTH ENDS — it is an offset, not a taper (${offsetCaps.join(" vs ")})`,
  );

  /* And the transition must still taper, so the fix above cannot be "make
   * every glyph parallel" and pass. */
  const transitionCaps = capsIn(GLYPH_PATHS.transition);
  check(
    transitionCaps.length === 2 && Math.abs(transitionCaps[0] - transitionCaps[1]) > 2,
    `transition: DOES change section — it is a taper (${transitionCaps.join(" vs ")})`,
  );

  /* The square-to-round's round end is a FULL ellipse. Drawn as a far-end half
   * it was the identical sliver the round reducer uses, and the two marks were
   * indistinguishable at picker size — reported as "still looks like a
   * reducer". Two arc commands means a closed ellipse; one means a half. */
  const arcs = (d) => (d.match(/A/g) ?? []).length;
  check(
    arcs(GLYPH_PATHS["square-to-round"]) >= 2,
    `square-to-round: its round end is a closed ellipse, not a half (${arcs(GLYPH_PATHS["square-to-round"])} arcs)`,
  );
  check(
    GLYPH_PATHS["square-to-round"] !== GLYPH_PATHS["round-reducer"],
    "square-to-round and round reducer are different marks",
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
