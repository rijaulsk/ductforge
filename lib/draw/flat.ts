import type { Fitting } from "../duct/types";
import {
  type Dim,
  type Pt,
  type Scene,
  type Shape,
  at,
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

    case "round-straight":
      return layout([blank(Math.PI * f.d, f.l, "wrapper ×1", L)]);

    case "round-elbow":
      return layout(gores(f.d, f.r, f.theta, f.gores, L));

    case "round-reducer":
      return layout([cone(f.d1, f.d2, f.l, L)]);
  }
}

/* ---- the gored bend ------------------------------------------------------
 *
 * The one development in this app that is worth the trouble of drawing.
 *
 * A gore is a cylinder cut by two planes, and a cut cylinder unrolls with a
 * COSINE edge — so the blank is a wave, not a trapezoid. At a point ψ around
 * the tube the segment's axial length is 2·tan(φ/2)·(R + (D/2)·cos ψ): longest
 * at the heel, shortest at the throat.
 *
 * The piece count follows the standard construction rather than dividing the
 * angle evenly. A bend of n pieces is two HALF gores at the ends — cut square
 * so the elbow's openings are perpendicular to the duct, which is the whole
 * point — and n−2 full gores between them, each turning φ = θ/(n−1).
 *
 * Worth knowing: these blanks total slightly MORE than the surface area
 * printed beside them, because a gored bend is a chain of mitred cylinders and
 * the area formula is a smooth torus. It is about 1% on a four-piece 90°, and
 * it is part of what the waste allowance is for.
 */
function goreEdge(d: number, r: number, phiDeg: number, half: boolean): Pt[] {
  const steps = 60;
  const k = (half ? 1 : 2) * Math.tan(deg(phiDeg) / 2);
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = (Math.PI * d * i) / steps;
    const psi = (2 * u) / d;
    pts.push([u, -k * (r + (d / 2) * Math.cos(psi))]);
  }
  return pts;
}

function gorePiece(
  d: number,
  r: number,
  phiDeg: number,
  half: boolean,
  caption: string,
  L: Label,
): Piece {
  const edge = goreEdge(d, r, phiDeg, half);
  const width = Math.PI * d;
  const tallest = -Math.min(...edge.map((p) => p[1]));
  const shortest = -Math.max(...edge.map((p) => p[1]));
  return {
    caption,
    shapes: [
      /* Square edge along the bottom, wave along the top. A half gore is the
       * same wave at half amplitude — that square edge is the elbow's opening. */
      poly([[0, 0], ...edge.map((p): Pt => [p[0], p[1]]), [width, 0]], "cut", true),
      line([0, 0], [width, 0], "fold"),
    ],
    dims: [
      { t: "len", a: [0, 0], b: [width, 0], text: L(width), off: 30 },
      { t: "len", a: [0, 0], b: [0, -tallest], text: L(tallest), off: 30 },
      {
        t: "note",
        at: [width / 2, -shortest],
        text: `throat ${L(shortest)}`,
        dy: -12,
      },
    ],
  };
}

function gores(d: number, r: number, theta: number, count: number, L: Label): Piece[] {
  const n = Math.max(2, Math.round(count));
  /* n pieces means n−1 mitred joints, so each full gore turns θ/(n−1) and the
   * two end pieces turn half that. */
  const phi = theta / (n - 1);
  const pieces: Piece[] = [gorePiece(d, r, phi, true, "end gore ×2", L)];
  if (n > 2) {
    pieces.push(gorePiece(d, r, phi, false, `full gore ×${n - 2}`, L));
  }
  return pieces;
}

/* ---- the cone ------------------------------------------------------------
 *
 * A frustum develops to an annular sector, and the arithmetic falls out
 * exactly: sector area = π(r₁+r₂)·slant, which is the shop formula to the
 * digit. When the two diameters are equal there is no cone at all and the
 * development degenerates to the cylinder's rectangle — handled, because a
 * reducer with nothing to reduce is a thing people type.
 */
function cone(d1: number, d2: number, l: number, L: Label): Piece {
  const r1 = Math.max(d1, d2) / 2;
  const r2 = Math.min(d1, d2) / 2;
  const dr = r1 - r2;
  const slant = Math.hypot(l, dr);

  if (dr < 1e-6 || slant < 1e-6) {
    return blank(Math.PI * d1, l, "wrapper ×1 — no taper", L);
  }

  /* Distances from the apex along the slant to each opening. */
  const big = (slant * r1) / dr;
  const small = (slant * r2) / dr;
  const sweep = (360 * dr) / slant;
  const c: Pt = [0, 0];
  const a0 = -sweep / 2;
  const a1 = sweep / 2;

  return {
    caption: "cone blank ×1",
    shapes: [
      sector(c, small, big, a0, a1),
      line(c, at(c, big * 1.06, a0), "hidden"),
      line(c, at(c, big * 1.06, a1), "hidden"),
    ],
    dims: [
      { t: "len", a: at(c, small, a1), b: at(c, big, a1), text: `${L(slant)} slant`, off: 30 },
      { t: "rad", c, r: big, at: 0, text: `R ${L(big)}` },
      { t: "ang", c, a0, a1, text: `${Math.round(sweep)}°`, vr: 34 },
    ],
  };
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
