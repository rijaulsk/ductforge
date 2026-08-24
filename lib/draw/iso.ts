import type { Fitting } from "../duct/types";
import { type Dim, type Pt, type Role, type Scene, type Shape, deg, poly } from "./scene";
import type { Label } from "./blueprint";

/* The isometric view — the fitting as an object rather than as a drawing.
 *
 * This is a true axonometric projection of the same millimetres the formulas
 * use, not a decorative graphic. It exists because a reducer and a dropper are
 * two very different objects that look nearly identical in orthographic
 * elevation, and an estimator who has picked the wrong fitting should be able
 * to see it in one glance rather than find it in a total.
 *
 * Depth without shadows, as the design system requires: three flat tints of
 * one hue distinguish top, side and end, and hidden surfaces are resolved by
 * painting back to front. No gradients, no lighting, no drop shadow — the
 * geometry does the work.
 */

type P3 = [number, number, number];

const COS30 = Math.cos(deg(30));
const SIN30 = Math.sin(deg(30));

/** Model (x along the duct, y across, z up) → the 2D scene. */
const iso = ([x, y, z]: P3): Pt => [(x - y) * COS30, (x + y) * SIN30 - z];

type Face = { pts: P3[]; role: Role };

/**
 * Painter's algorithm. The projection collapses the (1,1,1) axis, so a point's
 * distance from the camera is exactly x + y + z: sort ascending, draw in that
 * order, and near faces cover far ones. It handles the concave fittings — an
 * elbow's throat hides behind its own heel — without a depth buffer.
 */
function paint(faces: Face[]): Shape[] {
  return faces
    .map((f) => ({
      f,
      depth: f.pts.reduce((s, [x, y, z]) => s + x + y + z, 0) / f.pts.length,
    }))
    .sort((a, b) => a.depth - b.depth)
    .map(({ f }) => poly(f.pts.map(iso), f.role));
}

const quad = (a: P3, b: P3, c: P3, d: P3, role: Role): Face => ({ pts: [a, b, c, d], role });

/** All six faces of an axis-aligned box. */
function box(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): Face[] {
  return [
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], "face-top"),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], "face-top"),
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], "face-side"),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], "face-side"),
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], "face-end"),
    quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], "face-end"),
  ];
}

/** A swept rectangular section: the shared body of the elbow and the Y-piece. */
function sweep(
  cx: number,
  cy: number,
  r: number,
  w: number,
  h: number,
  a0: number,
  a1: number,
  steps = 16,
): Face[] {
  const faces: Face[] = [];
  const at3 = (rad: number, a: number, z: number): P3 => [
    cx + rad * Math.cos(deg(a)),
    cy + rad * Math.sin(deg(a)),
    z,
  ];
  const ro = r + w;
  for (let i = 0; i < steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const b = a0 + ((a1 - a0) * (i + 1)) / steps;
    faces.push(quad(at3(r, a, h), at3(ro, a, h), at3(ro, b, h), at3(r, b, h), "face-top"));
    faces.push(quad(at3(r, a, 0), at3(ro, a, 0), at3(ro, b, 0), at3(r, b, 0), "face-top"));
    faces.push(quad(at3(ro, a, 0), at3(ro, a, h), at3(ro, b, h), at3(ro, b, 0), "face-side"));
    faces.push(quad(at3(r, a, 0), at3(r, a, h), at3(r, b, h), at3(r, b, 0), "face-side"));
  }
  faces.push(quad(at3(r, a0, 0), at3(ro, a0, 0), at3(ro, a0, h), at3(r, a0, h), "face-end"));
  faces.push(quad(at3(r, a1, 0), at3(ro, a1, 0), at3(ro, a1, h), at3(r, a1, h), "face-end"));
  return faces;
}

/**
 * A round duct as flat facets.
 *
 * `ring(x)` gives the circle of radius r(x) at station x, and consecutive
 * rings are joined by quads. The tint follows the facet's own orientation —
 * a face pointing up the screen reads as top, one pointing sideways as side —
 * which shades a cylinder into three flat steps without a gradient or a light
 * source, exactly as the design system requires depth to be built.
 */
function tube(
  ring: (t: number, psi: number) => P3,
  steps: number,
  facets = 20,
): Face[] {
  const faces: Face[] = [];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < facets; j++) {
      const p0 = (j / facets) * 360;
      const p1 = ((j + 1) / facets) * 360;
      const mid = deg((p0 + p1) / 2);
      /* The facet's outward normal in the tube's own cross-section plane. */
      const role: Role = Math.abs(Math.sin(mid)) > 0.72 ? "face-top" : "face-side";
      faces.push(
        quad(
          ring(i / steps, p0),
          ring((i + 1) / steps, p0),
          ring((i + 1) / steps, p1),
          ring(i / steps, p1),
          role,
        ),
      );
    }
  }
  /* The two openings, as flat discs, so an end reads as closed rather than as
   * a hole you can see the far wall through. */
  for (const t of [0, 1]) {
    const disc: P3[] = [];
    for (let j = 0; j < facets; j++) disc.push(ring(t, (j / facets) * 360));
    for (let j = 1; j < facets - 1; j++) {
      faces.push(quad(disc[0], disc[j], disc[j + 1], disc[j + 1], "face-end"));
    }
  }
  return faces;
}

/** A label pinned to the midpoint of a model edge. Isometric drawings do not
 * take dimension lines well — the extension lines cross the object — so the
 * three principal sizes are called out where the eye already is. */
function tag(a: P3, b: P3, text: string, dx = 0, dy = 0): Dim {
  const mid = iso([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  return { t: "note", at: mid, text, dx, dy };
}

export function isometric(f: Fitting, L: Label): Scene {
  switch (f.kind) {
    case "straight": {
      const { w, h, l } = f;
      return {
        shapes: paint(box(0, l, 0, w, 0, h)),
        dims: [
          tag([0, w, h], [l, w, h], `L ${L(l)}`, 0, -14),
          tag([l, 0, 0], [l, w, 0], `W ${L(w)}`, 16, 16),
          tag([l, w, 0], [l, w, h], `H ${L(h)}`, 20, 4),
        ],
      };
    }

    case "reducer": {
      const { w1, h1, w2, h2, l } = f;
      const a = (y: number, z: number): P3 => [0, y * (w1 / 2), z * (h1 / 2)];
      const b = (y: number, z: number): P3 => [l, y * (w2 / 2), z * (h2 / 2)];
      const faces: Face[] = [
        quad(a(-1, 1), b(-1, 1), b(1, 1), a(1, 1), "face-top"),
        quad(a(-1, -1), b(-1, -1), b(1, -1), a(1, -1), "face-top"),
        quad(a(1, -1), b(1, -1), b(1, 1), a(1, 1), "face-side"),
        quad(a(-1, -1), b(-1, -1), b(-1, 1), a(-1, 1), "face-side"),
        quad(b(-1, -1), b(1, -1), b(1, 1), b(-1, 1), "face-end"),
        quad(a(-1, -1), a(1, -1), a(1, 1), a(-1, 1), "face-end"),
      ];
      return {
        shapes: paint(faces),
        dims: [
          tag(a(1, 1), b(1, 1), `L ${L(l)}`, 0, -14),
          tag(a(-1, -1), a(1, -1), `W₁ ${L(w1)}`, -18, 16),
          tag(a(1, -1), a(1, 1), `H₁ ${L(h1)}`, -22, 2),
          tag(b(-1, -1), b(1, -1), `W₂ ${L(w2)}`, 18, 16),
          tag(b(1, -1), b(1, 1), `H₂ ${L(h2)}`, 22, 2),
        ],
      };
    }

    case "elbow": {
      const { w, h, r, theta } = f;
      const a0 = 90 - theta;
      const a1 = 90;
      const faces = sweep(0, 0, r, w, h, a0, a1);
      const mid = (a0 + a1) / 2;
      const rm = r + w / 2;
      return {
        shapes: paint(faces),
        dims: [
          tag([0, r, h], [0, r + w, h], `W ${L(w)}`, 0, -14),
          tag([0, r + w, 0], [0, r + w, h], `H ${L(h)}`, 22, 4),
          {
            t: "note",
            at: iso([rm * Math.cos(deg(mid)), rm * Math.sin(deg(mid)), h]),
            text: `R ${L(r)} · ${theta}°`,
            dy: -16,
          },
        ],
      };
    }

    case "dropper": {
      const { w, h, l, o } = f;
      /* Sheared along z: the section stays W × H the whole way and simply
       * rises by O, which is exactly why the cheeks develop flat. */
      const p = (x: 0 | 1, y: -1 | 1, z: -1 | 1): P3 => [
        x * l,
        (y * w) / 2,
        (x ? o : 0) + (z * h) / 2,
      ];
      const faces: Face[] = [
        quad(p(0, -1, 1), p(1, -1, 1), p(1, 1, 1), p(0, 1, 1), "face-top"),
        quad(p(0, -1, -1), p(1, -1, -1), p(1, 1, -1), p(0, 1, -1), "face-top"),
        quad(p(0, 1, -1), p(1, 1, -1), p(1, 1, 1), p(0, 1, 1), "face-side"),
        quad(p(0, -1, -1), p(1, -1, -1), p(1, -1, 1), p(0, -1, 1), "face-side"),
        quad(p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1), "face-end"),
        quad(p(0, -1, -1), p(0, 1, -1), p(0, 1, 1), p(0, -1, 1), "face-end"),
      ];
      return {
        shapes: paint(faces),
        dims: [
          tag(p(0, 1, 1), p(1, 1, 1), `L ${L(l)}`, 0, -14),
          tag(p(1, -1, -1), p(1, 1, -1), `W ${L(w)}`, 16, 16),
          tag(p(1, 1, -1), p(1, 1, 1), `H ${L(h)}`, 22, 4),
          tag(p(0, 1, 1), p(1, 1, -1), `O ${L(o)}`, 26, 18),
        ],
      };
    }

    case "collar": {
      const { w, h, l } = f;
      const ff = f.f;
      const faces: Face[] = [
        ...box(0, w, 0, h, 0, l),
        /* Four flat strips around the base — the lip, folded out. */
        quad([-ff, -ff, 0], [w + ff, -ff, 0], [w + ff, 0, 0], [-ff, 0, 0], "face-end"),
        quad([-ff, h, 0], [w + ff, h, 0], [w + ff, h + ff, 0], [-ff, h + ff, 0], "face-end"),
        quad([-ff, 0, 0], [0, 0, 0], [0, h, 0], [-ff, h, 0], "face-end"),
        quad([w, 0, 0], [w + ff, 0, 0], [w + ff, h, 0], [w, h, 0], "face-end"),
      ];
      return {
        shapes: paint(faces),
        dims: [
          tag([0, h, l], [w, h, l], `W ${L(w)}`, -6, -14),
          tag([w, 0, l], [w, h, l], `H ${L(h)}`, 18, -8),
          tag([w, h, 0], [w, h, l], `L ${L(l)}`, 24, 4),
          tag([w, h + ff, 0], [w + ff, h + ff, 0], `F ${L(ff)}`, 22, 14),
        ],
      };
    }

    case "wye": {
      const { w1, h, w2, w3, r, theta } = f;
      const mainLen = w1 * 0.85;
      const faces: Face[] = [
        ...box(-mainLen, 0, -w1 / 2, w1 / 2, 0, h),
        ...sweep(0, -w1 / 2 - r, r, w2, h, 90 - theta, 90),
        ...sweep(0, w1 / 2 + r, r, w3, h, -90, -90 + theta),
      ];
      return {
        shapes: paint(faces),
        dims: [
          tag([-mainLen, -w1 / 2, h], [-mainLen, w1 / 2, h], `W₁ ${L(w1)}`, -22, -6),
          tag([-mainLen, w1 / 2, 0], [-mainLen, w1 / 2, h], `H ${L(h)}`, -22, 8),
          {
            t: "note",
            at: iso([r * Math.cos(deg(90 - theta)), -w1 / 2 - r + r * Math.sin(deg(90 - theta)), h]),
            text: `W₂ ${L(w2)} · ${theta}°`,
            dy: -16,
          },
          {
            t: "note",
            at: iso([r * Math.cos(deg(-90 + theta)), w1 / 2 + r + r * Math.sin(deg(-90 + theta)), h]),
            text: `W₃ ${L(w3)}`,
            dy: 22,
          },
        ],
      };
    }

    case "round-straight": {
      const { d, l } = f;
      const rr = d / 2;
      return {
        shapes: paint(
          tube((t, psi) => [t * l, rr * Math.cos(deg(psi)), rr * Math.sin(deg(psi))], 1),
        ),
        dims: [
          tag([0, 0, rr], [l, 0, rr], `L ${L(l)}`, 0, -14),
          tag([l, -rr, 0], [l, rr, 0], `⌀ ${L(d)}`, 20, 14),
        ],
      };
    }

    case "round-elbow": {
      const { d, r, theta } = f;
      const rr = d / 2;
      const a0 = 90 - theta;
      const a1 = 90;
      /* Sweep the circle around the bend: the centre travels the centreline
       * arc, and the tube's cross-section stands in the plane containing the
       * bend's axis and the vertical. */
      const ring = (t: number, psi: number): P3 => {
        const a = deg(a0 + (a1 - a0) * t);
        const cr = r + rr * Math.cos(deg(psi));
        return [cr * Math.cos(a), cr * Math.sin(a), rr * Math.sin(deg(psi))];
      };
      return {
        shapes: paint(tube(ring, 18)),
        dims: [
          tag([0, r - rr, 0], [0, r + rr, 0], `⌀ ${L(d)}`, 0, -14),
          {
            t: "note",
            at: iso([r * Math.cos(deg((a0 + a1) / 2)), r * Math.sin(deg((a0 + a1) / 2)), rr]),
            text: `R ${L(r)} · ${theta}°`,
            dy: -18,
          },
        ],
      };
    }

    case "round-reducer": {
      const { d1, d2, l } = f;
      const ring = (t: number, psi: number): P3 => {
        const rr = (d1 / 2) * (1 - t) + (d2 / 2) * t;
        return [t * l, rr * Math.cos(deg(psi)), rr * Math.sin(deg(psi))];
      };
      return {
        shapes: paint(tube(ring, 1)),
        dims: [
          tag([0, 0, d1 / 2], [l, 0, d2 / 2], `L ${L(l)}`, 0, -14),
          tag([0, -d1 / 2, 0], [0, d1 / 2, 0], `⌀ ${L(d1)}`, -22, 10),
          tag([l, -d2 / 2, 0], [l, d2 / 2, 0], `⌀ ${L(d2)}`, 22, 12),
        ],
      };
    }
  }
}
