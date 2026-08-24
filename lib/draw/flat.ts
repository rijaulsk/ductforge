import type { Fitting } from "../duct/types";
import {
  type Dim,
  type Pt,
  type Scene,
  type Shape,
  bounds,
  deg,
  line,
  moveDims,
  moveShapes,
  poly,
  rect,
  sector,
} from "./scene";
import type { Label } from "./blueprint";

/* The flat pattern — what actually gets cut.
 *
 * Solid line = cut. Dashed = fold. Each blank is drawn at true relative size
 * and laid out side by side the way they would be nested on a sheet, so the
 * overall extents tell a fabricator at a glance whether a piece fits across
 * 1200 mm.
 *
 * WHAT IS DELIBERATELY NOT DRAWN: seam laps, Pittsburgh allowance and flange
 * lip material. Those are covered numerically by the waste allowance, and
 * drawing them here would double-count them against the area on the left of
 * the screen. The panel says so under the drawing rather than leaving a
 * fabricator to discover it.
 *
 * Where a development would have to invent geometry the specification does not
 * give — the four panels of a transition meet along corner seams at angles
 * that depend on how the shop breaks it — the pieces are drawn as separate
 * blanks rather than as a made-up joined figure.
 */

type Piece = {
  caption: string;
  shapes: Shape[];
  dims: Dim[];
};

/** Lay pieces left to right with a common baseline and one gap. */
function layout(pieces: Piece[]): Scene {
  const measured = pieces.map((p) => ({ ...p, b: bounds(p.shapes) }));
  const widest = Math.max(...measured.map((m) => m.b.maxX - m.b.minX), 1);
  const tallest = Math.max(...measured.map((m) => m.b.maxY - m.b.minY), 1);
  const gap = Math.max(widest, tallest) * 0.16;

  const shapes: Shape[] = [];
  const dims: Dim[] = [];
  const captions: { at: Pt; text: string }[] = [];
  let x = 0;

  for (const m of measured) {
    const dx = x - m.b.minX;
    const dy = -m.b.minY;
    shapes.push(...moveShapes(m.shapes, dx, dy));
    dims.push(...moveDims(m.dims, dx, dy));
    const w = m.b.maxX - m.b.minX;
    captions.push({
      at: [x + w / 2, m.b.maxY - m.b.minY + tallest * 0.14 + 26],
      text: m.caption,
    });
    x += w + gap;
  }

  return { shapes, dims, captions };
}

/** A rectangular blank with its two extents dimensioned. */
function blank(w: number, h: number, caption: string, L: Label, folds: number[] = []): Piece {
  return {
    caption,
    shapes: [
      rect(0, 0, w, h),
      ...folds.map((fx) => line([fx, 0], [fx, h], "fold")),
    ],
    dims: [
      { t: "len", a: [0, h], b: [w, h], text: L(w), off: 30 },
      { t: "len", a: [w, h], b: [w, 0], text: L(h), off: 30 },
    ],
  };
}

export function flat(f: Fitting, L: Label): Scene {
  switch (f.kind) {
    case "straight": {
      const girth = 2 * (f.w + f.h);
      return layout([
        blank(girth, f.l, "wrapper ×1", L, [f.w, f.w + f.h, 2 * f.w + f.h]),
      ]);
    }

    case "reducer": {
      const slantTop = Math.hypot(f.l, (f.h1 - f.h2) / 2);
      const slantSide = Math.hypot(f.l, (f.w1 - f.w2) / 2);
      return layout([
        trapezoid(f.w1, f.w2, slantTop, "top & bottom ×2", L),
        trapezoid(f.h1, f.h2, slantSide, "sides ×2", L),
      ]);
    }

    case "elbow": {
      const arcOuter = deg(f.theta) * (f.r + f.w);
      const arcInner = deg(f.theta) * f.r;
      return layout([
        cheek(f.r, f.w, f.theta, "cheek ×2", L),
        blank(arcOuter, f.h, "heel ×1", L),
        blank(arcInner, f.h, "throat ×1", L),
      ]);
    }

    case "dropper": {
      const slant = Math.hypot(f.l, f.o);
      return layout([
        {
          caption: "cheek ×2",
          shapes: [
            poly([
              [0, 0],
              [f.l, f.o],
              [f.l, f.o + f.h],
              [0, f.h],
            ]),
          ],
          dims: [
            { t: "len", a: [0, f.h], b: [f.l, f.o + f.h], text: L(slant), off: 30 },
            { t: "len", a: [0, f.h], b: [0, 0], text: L(f.h), off: 30 },
            { t: "len", a: [f.l, 0], b: [f.l, f.o], text: L(f.o), off: -30 },
          ],
        },
        blank(f.w, slant, "face ×2", L),
      ]);
    }

    case "collar": {
      const girth = 2 * (f.w + f.h);
      return layout([
        {
          caption: "wrapper + flange band ×1",
          shapes: [
            rect(0, 0, girth, f.l + f.f),
            line([0, f.l], [girth, f.l], "fold"),
            line([f.w, 0], [f.w, f.l + f.f], "fold"),
            line([f.w + f.h, 0], [f.w + f.h, f.l + f.f], "fold"),
            line([2 * f.w + f.h, 0], [2 * f.w + f.h, f.l + f.f], "fold"),
          ],
          dims: [
            { t: "len", a: [0, f.l + f.f], b: [girth, f.l + f.f], text: L(girth), off: 30 },
            { t: "len", a: [girth, f.l], b: [girth, 0], text: L(f.l), off: 30 },
            { t: "len", a: [girth, f.l + f.f], b: [girth, f.l], text: L(f.f), off: 30 },
          ],
        },
        blank(f.f, f.f, "corner square ×4", L),
      ]);
    }

    case "wye": {
      const branch = (wn: number, n: number): Piece[] => [
        cheek(f.r, wn, f.theta, `branch ${n} cheek ×2`, L),
        blank(deg(f.theta) * (f.r + wn), f.h, `branch ${n} heel ×1`, L),
        blank(deg(f.theta) * f.r, f.h, `branch ${n} throat ×1`, L),
      ];
      return layout([...branch(f.w2, 1), ...branch(f.w3, 2)]);
    }
  }
}

/** A transition panel: two parallel edges joined over a slant height. */
function trapezoid(a: number, b: number, slant: number, caption: string, L: Label): Piece {
  const dx = (a - b) / 2;
  return {
    caption,
    shapes: [
      poly([
        [0, 0],
        [a, 0],
        [a - dx, slant],
        [dx, slant],
      ]),
    ],
    dims: [
      { t: "len", a: [0, 0], b: [a, 0], text: L(a), off: -30 },
      { t: "len", a: [a - dx, slant], b: [dx, slant], text: L(b), off: -30 },
      { t: "len", a: [a, 0], b: [a - dx, slant], text: L(slant), off: -30 },
    ],
  };
}

/** An elbow cheek: the annular sector between throat and heel radii. */
function cheek(r: number, w: number, theta: number, caption: string, L: Label): Piece {
  const c: Pt = [0, 0];
  const ro = r + w;
  return {
    caption,
    shapes: [
      sector(c, r, ro, -theta, 0),
      line(c, [ro * 1.04, 0], "hidden"),
      line(c, [ro * 1.04 * Math.cos(deg(-theta)), ro * 1.04 * Math.sin(deg(-theta))], "hidden"),
    ],
    dims: [
      { t: "len", a: [r, 0], b: [ro, 0], text: L(w), off: 30 },
      { t: "rad", c, r, at: -theta / 2, text: `R ${L(r)}` },
      { t: "ang", c, a0: -theta, a1: 0, text: `${theta}°`, vr: 38 },
    ],
  };
}
