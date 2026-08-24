import type { Fitting } from "../duct/types";
import {
  type Pt,
  type Scene,
  type Shape,
  arc,
  at,
  deg,
  line,
  poly,
  rect,
  sector,
} from "./scene";

/* The dimensioned orthographic view — the drawing an estimator checks the
 * numbers against.
 *
 * Every dimension that appears in the fitting's formula appears on the
 * drawing, and nothing appears on the drawing that is not in the formula.
 * That is the whole discipline of this file: if the area depends on H, the
 * view has to show H, which is why fittings whose main view cannot carry the
 * depth get a small section drawn beside it.
 *
 * Labels are bare numbers; the unit is stated once, under the drawing.
 */

export type Label = (mm: number) => string;

/** Straight-line stub drawn at a bend's ends so an elbow reads as ductwork
 * rather than as a slice of doughnut. Not a modelled dimension. */
const stubOf = (w: number) => w * 0.55;

/** An open U — two parallel walls and an end cap, so a stub joins the bend it
 * grows out of without drawing a line across the joint. */
function stub(a: Pt, b: Pt, dir: Pt, len: number): Shape {
  const ax: Pt = [a[0] + dir[0] * len, a[1] + dir[1] * len];
  const bx: Pt = [b[0] + dir[0] * len, b[1] + dir[1] * len];
  return poly([a, ax, bx, b], "cut", false);
}

export function blueprint(f: Fitting, L: Label): Scene {
  switch (f.kind) {
    case "straight":
      return straight(f.w, f.h, f.l, L);
    case "reducer":
      return reducer(f.w1, f.h1, f.w2, f.h2, f.l, L);
    case "elbow":
      return elbow(f.w, f.h, f.r, f.theta, L);
    case "dropper":
      return dropper(f.w, f.h, f.l, f.o, L);
    case "collar":
      return collar(f.w, f.h, f.l, f.f, L);
    case "wye":
      return wye(f.w1, f.h, f.w2, f.w3, f.r, f.theta, L);
    case "round-straight":
      return roundStraight(f.d, f.l, L);
    case "round-elbow":
      return roundElbow(f.d, f.r, f.theta, f.gores, L);
    case "round-reducer":
      return roundReducer(f.d1, f.d2, f.l, L);
  }
}

/* ---- round straight ------------------------------------------------------ */

function roundStraight(d: number, l: number, L: Label): Scene {
  const gap = Math.max(l * 0.18, d * 1.2);
  const sx = l + gap;
  return {
    shapes: [
      rect(0, 0, l, d),
      line([-l * 0.04, d / 2], [l * 1.04, d / 2], "centre"),
      /* The end view is what tells a reader this is round rather than a
       * rectangle drawn without its second dimension. */
      arc([sx + d / 2, d / 2], d / 2, 0, 180),
      arc([sx + d / 2, d / 2], d / 2, 180, 360),
      line([sx + d / 2, -d * 0.08], [sx + d / 2, d * 1.08], "centre"),
      line([sx - d * 0.08, d / 2], [sx + d * 1.08, d / 2], "centre"),
    ],
    dims: [
      { t: "len", a: [0, d], b: [l, d], text: L(l), off: 34 },
      { t: "len", a: [0, 0], b: [0, d], text: `⌀ ${L(d)}`, off: 34 },
      { t: "len", a: [sx, d], b: [sx + d, d], text: `⌀ ${L(d)}`, off: 34 },
    ],
    captions: [
      { at: [l / 2, -d * 0.22 - 14], text: "elevation" },
      { at: [sx + d / 2, -d * 0.22 - 14], text: "end view" },
    ],
  };
}

/* ---- round elbow --------------------------------------------------------- */

function roundElbow(
  d: number,
  r: number,
  theta: number,
  gores: number,
  L: Label,
): Scene {
  /* R is the CENTRELINE radius for round duct, so the walls sit half a
   * diameter either side of it — the opposite of the rectangular elbow, where
   * R is the throat. */
  const ri = Math.max(0, r - d / 2);
  const ro = r + d / 2;
  const C: Pt = [0, 0];
  const a1 = 180;
  const a0 = 180 - theta;
  const s = stubOf(d);

  const inDir: Pt = [0, -1];
  const outDir: Pt = [Math.sin(deg(a0)), -Math.cos(deg(a0))];

  /* One line per gore seam, drawn across the bend at each division. */
  const seams: Shape[] = [];
  for (let i = 1; i < Math.max(1, gores); i++) {
    const a = a0 + ((a1 - a0) * i) / Math.max(1, gores);
    seams.push(line(at(C, ri, a), at(C, ro, a), "fold"));
  }

  return {
    shapes: [
      sector(C, ri, ro, a0, a1),
      stub([-ro, 0], [-ri, 0], inDir, s),
      stub(at(C, ro, a0), at(C, ri, a0), outDir, s),
      arc(C, r, a0, a1, "centre"),
      ...seams,
      line(C, at(C, ro * 1.08, a1), "hidden"),
      line(C, at(C, ro * 1.08, a0), "hidden"),
    ],
    dims: [
      { t: "len", a: [-ro, 0], b: [-ri, 0], text: `⌀ ${L(d)}`, off: -30 },
      { t: "rad", c: C, r, at: a0 + theta / 2, text: `R ${L(r)}` },
      { t: "ang", c: C, a0, a1, text: `${theta}°` },
      {
        t: "note",
        at: at(C, ro * 0.72, a0 + theta / 2),
        text: `${gores} gores`,
        dy: 4,
      },
    ],
  };
}

/* ---- round reducer ------------------------------------------------------- */

function roundReducer(d1: number, d2: number, l: number, L: Label): Scene {
  return {
    shapes: [
      poly([
        [0, -d1 / 2],
        [l, -d2 / 2],
        [l, d2 / 2],
        [0, d1 / 2],
      ]),
      line([-l * 0.05, 0], [l * 1.05, 0], "centre"),
      /* The two openings, seen edge-on: a round reducer's elevation is the
       * same trapezoid as a rectangular one, so the end ellipses are what
       * distinguish them. */
      line([0, -d1 / 2], [0, d1 / 2], "hidden"),
      line([l, -d2 / 2], [l, d2 / 2], "hidden"),
    ],
    dims: [
      { t: "len", a: [0, -d1 / 2], b: [0, d1 / 2], text: `⌀ ${L(d1)}`, off: 34 },
      { t: "len", a: [l, d2 / 2], b: [l, -d2 / 2], text: `⌀ ${L(d2)}`, off: 34 },
      { t: "len", a: [0, d1 / 2], b: [l, d1 / 2], text: L(l), off: 40 },
    ],
    captions: [{ at: [l / 2, -d1 / 2 - 22], text: "elevation" }],
  };
}

/* ---- straight ----------------------------------------------------------- */

function straight(w: number, h: number, l: number, L: Label): Scene {
  const gap = Math.max(l * 0.18, w * 1.2);
  const sx = l + gap;
  return {
    shapes: [
      rect(0, 0, l, h),
      line([-l * 0.04, h / 2], [l * 1.04, h / 2], "centre"),
      rect(sx, 0, w, h),
    ],
    dims: [
      { t: "len", a: [0, h], b: [l, h], text: L(l), off: 34 },
      { t: "len", a: [0, 0], b: [0, h], text: L(h), off: 34 },
      { t: "len", a: [sx, h], b: [sx + w, h], text: L(w), off: 34 },
      { t: "len", a: [sx + w, h], b: [sx + w, 0], text: L(h), off: 34 },
    ],
    captions: [
      { at: [l / 2, -h * 0.22 - 14], text: "elevation" },
      { at: [sx + w / 2, -h * 0.22 - 14], text: "section" },
    ],
  };
}

/* ---- reducer ------------------------------------------------------------ */

function reducer(
  w1: number,
  h1: number,
  w2: number,
  h2: number,
  l: number,
  L: Label,
): Scene {
  const yPlan = Math.max(h1, h2) / 2 + Math.max(w1, w2) / 2 + l * 0.22;
  return {
    shapes: [
      poly([
        [0, -h1 / 2],
        [l, -h2 / 2],
        [l, h2 / 2],
        [0, h1 / 2],
      ]),
      line([-l * 0.05, 0], [l * 1.05, 0], "centre"),
      poly([
        [0, yPlan - w1 / 2],
        [l, yPlan - w2 / 2],
        [l, yPlan + w2 / 2],
        [0, yPlan + w1 / 2],
      ]),
      line([-l * 0.05, yPlan], [l * 1.05, yPlan], "centre"),
    ],
    dims: [
      { t: "len", a: [0, -h1 / 2], b: [0, h1 / 2], text: L(h1), off: 34 },
      { t: "len", a: [l, h2 / 2], b: [l, -h2 / 2], text: L(h2), off: 34 },
      { t: "len", a: [0, yPlan - w1 / 2], b: [0, yPlan + w1 / 2], text: L(w1), off: 34 },
      { t: "len", a: [l, yPlan + w2 / 2], b: [l, yPlan - w2 / 2], text: L(w2), off: 34 },
      {
        t: "len",
        a: [0, yPlan + w1 / 2],
        b: [l, yPlan + w1 / 2],
        text: L(l),
        off: 40,
      },
    ],
    captions: [
      { at: [l / 2, -h1 / 2 - 22], text: "elevation" },
      { at: [l / 2, yPlan - Math.max(w1, w2) / 2 - 22], text: "plan" },
    ],
  };
}

/* ---- elbow -------------------------------------------------------------- */

function elbow(w: number, h: number, r: number, theta: number, L: Label): Scene {
  const C: Pt = [0, 0];
  const ro = r + w;
  const a1 = 180;
  const a0 = 180 - theta;
  const s = stubOf(w);

  /* Tangent at the inlet end (a1 = 180) points up the screen; at the outlet
   * end it points away from the sweep. Both are unit vectors. */
  const inDir: Pt = [0, -1];
  const outDir: Pt = [Math.sin(deg(a0)), -Math.cos(deg(a0))];

  const secW = w;
  const sectionX = s + ro * 0.55;

  return {
    shapes: [
      sector(C, r, ro, a0, a1),
      stub([-ro, 0], [-r, 0], inDir, s),
      stub(at(C, ro, a0), at(C, r, a0), outDir, s),
      arc(C, r + w / 2, a0, a1, "centre"),
      line(C, at(C, ro * 1.08, a1), "hidden"),
      line(C, at(C, ro * 1.08, a0), "hidden"),
      rect(sectionX, 0, secW, h),
    ],
    dims: [
      { t: "len", a: [-ro, 0], b: [-r, 0], text: L(w), off: -30 },
      { t: "rad", c: C, r, at: a0 + theta / 2, text: `R ${L(r)}` },
      { t: "ang", c: C, a0, a1, text: `${theta}°` },
      { t: "len", a: [sectionX, h], b: [sectionX + secW, h], text: L(w), off: 34 },
      { t: "len", a: [sectionX + secW, h], b: [sectionX + secW, 0], text: L(h), off: 34 },
    ],
    captions: [
      { at: [sectionX + secW / 2, -22], text: "section" },
    ],
  };
}

/* ---- dropper ------------------------------------------------------------ */

function dropper(w: number, h: number, l: number, o: number, L: Label): Scene {
  const yPlan = o + h / 2 + w / 2 + l * 0.2;
  return {
    shapes: [
      /* Sheared, not bent: the elevation IS the parallelogram whose area the
       * shop formula refuses to inflate. */
      poly([
        [0, -h / 2],
        [l, o - h / 2],
        [l, o + h / 2],
        [0, h / 2],
      ]),
      line([0, 0], [l, o], "centre"),
      line([0, 0], [l, 0], "hidden"),
      line([l, 0], [l, o], "hidden"),
      rect(0, yPlan - w / 2, l, w),
      line([-l * 0.05, yPlan], [l * 1.05, yPlan], "centre"),
    ],
    dims: [
      { t: "len", a: [0, -h / 2], b: [0, h / 2], text: L(h), off: 34 },
      { t: "len", a: [l, 0], b: [l, o], text: L(o), off: -34 },
      { t: "len", a: [0, yPlan + w / 2], b: [l, yPlan + w / 2], text: L(l), off: 38 },
      { t: "len", a: [0, yPlan + w / 2], b: [0, yPlan - w / 2], text: L(w), off: 34 },
    ],
    captions: [
      { at: [l / 2, Math.min(-h / 2, o - h / 2) - 22], text: "elevation" },
      { at: [l / 2, yPlan - w / 2 - 22], text: "plan" },
    ],
  };
}

/* ---- collar ------------------------------------------------------------- */

function collar(w: number, h: number, l: number, f: number, L: Label): Scene {
  const gap = Math.max(w * 0.7, f * 6);
  const sx = w + f + gap;
  return {
    shapes: [
      rect(0, 0, w, l),
      /* The flange is a lip folded outward at the base: edge-on in elevation
       * it is a line, and drawing it as anything thicker would invent a
       * dimension the fitting does not have. */
      line([-f, l], [0, l]),
      line([w, l], [w + f, l]),
      line([0, l], [0, l], "fold"),
      line([w / 2, -l * 0.06], [w / 2, l * 1.06], "centre"),
      rect(sx, 0, w, h),
    ],
    dims: [
      { t: "len", a: [0, 0], b: [0, l], text: L(l), off: 40 },
      { t: "len", a: [0, 0], b: [w, 0], text: L(w), off: -32 },
      { t: "len", a: [-f, l], b: [0, l], text: L(f), off: 30 },
      { t: "len", a: [sx, h], b: [sx + w, h], text: L(w), off: 34 },
      { t: "len", a: [sx + w, h], b: [sx + w, 0], text: L(h), off: 34 },
    ],
    captions: [
      /* Pinned to the top edge and lifted in PIXELS: the W dimension sits 32 px
       * above this same edge, and a caption placed a few millimetres up landed
       * on it at any scale where 32 px was more than a few millimetres. */
      { at: [w / 2, 0], text: "elevation", dy: -58 },
      { at: [sx + w / 2, 0], text: "section", dy: -34 },
    ],
  };
}

/* ---- Y-piece ------------------------------------------------------------ */

function wye(
  w1: number,
  h: number,
  w2: number,
  w3: number,
  r: number,
  theta: number,
  L: Label,
): Scene {
  const mainLen = w1 * 0.85;
  /* Each branch turns about a centre one inside-radius clear of the main
   * duct's wall, so the branch's throat starts exactly on that wall. */
  const C1: Pt = [0, -w1 / 2 - r];
  const C2: Pt = [0, w1 / 2 + r];

  const b1Inner = at(C1, r, 90 - theta);
  const b1Outer = at(C1, r + w2, 90 - theta);
  const b2Inner = at(C2, r, -90 + theta);
  const b2Outer = at(C2, r + w3, -90 + theta);

  const s = stubOf(Math.max(w2, w3));
  const d1: Pt = [Math.cos(deg(-theta)), Math.sin(deg(-theta))];
  const d2: Pt = [Math.cos(deg(theta)), Math.sin(deg(theta))];

  const secY = Math.max(w1 / 2, C2[1] + r + w3) + h * 0.6 + w1 * 0.3;

  return {
    shapes: [
      poly([
        [-mainLen, -w1 / 2],
        [0, -w1 / 2],
        [0, w1 / 2],
        [-mainLen, w1 / 2],
      ], "cut", false),
      sector(C1, r, r + w2, 90 - theta, 90),
      sector(C2, r, r + w3, -90, -90 + theta),
      stub(b1Inner, b1Outer, d1, s),
      stub(b2Outer, b2Inner, d2, s),
      line([-mainLen * 1.06, 0], [0, 0], "centre"),
      line(C1, at(C1, (r + w2) * 1.06, 90), "hidden"),
      line(C1, at(C1, (r + w2) * 1.06, 90 - theta), "hidden"),
      rect(-w1 / 2, secY, w1, h),
    ],
    dims: [
      { t: "len", a: [-mainLen, -w1 / 2], b: [-mainLen, w1 / 2], text: L(w1), off: 34 },
      /* Pushed well clear: on a small branch off a large main these sit close
       * to the radius callout, and 28px was not enough room for both. */
      { t: "len", a: b1Inner, b: b1Outer, text: L(w2), off: -44 },
      { t: "len", a: b2Outer, b: b2Inner, text: L(w3), off: -44 },
      { t: "rad", c: C1, r, at: 90 - theta / 2, text: `R ${L(r)}` },
      { t: "ang", c: C1, a0: 90 - theta, a1: 90, text: `${theta}°`, vr: 40 },
      { t: "len", a: [-w1 / 2, secY + h], b: [w1 / 2, secY + h], text: L(w1), off: 34 },
      { t: "len", a: [w1 / 2, secY + h], b: [w1 / 2, secY], text: L(h), off: 34 },
    ],
    captions: [{ at: [0, secY - 22], text: "section" }],
  };
}
