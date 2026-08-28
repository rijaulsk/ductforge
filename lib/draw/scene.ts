/* The drawing model.
 *
 * A scene is described once, in MILLIMETRES, by the fitting itself — the same
 * numbers the formulas use, so a drawing can never disagree with the area
 * printed beside it. Projection into the SVG viewBox happens here, at the end,
 * and it is a uniform scale plus a translate. That matters more than it looks:
 * a uniform scale maps a circle to a circle, so arcs survive projection as
 * arcs and nothing has to be flattened into a hundred line segments.
 *
 * Everything the component receives is already in view coordinates, which is
 * why stroke widths and label sizes can be plain constants: 1.5 px is 1.5 px
 * whether the fitting is a 300 mm collar or a 6 m run.
 */

export type Pt = [number, number];

/** What a line MEANS, which is what decides how it is painted. */
export type Role =
  /** Sheet edge — the fabricator's cut. */
  | "cut"
  /** Bend line — scored, not cut. */
  | "fold"
  /** Centreline / axis. */
  | "centre"
  /** Construction or hidden edge. */
  | "hidden"
  /** Solid faces of the isometric view, lit three ways. */
  | "face-top"
  | "face-side"
  | "face-end";

export type Prim =
  | { t: "poly"; pts: Pt[]; closed: boolean }
  | { t: "arc"; c: Pt; r: number; a0: number; a1: number }
  | { t: "sector"; c: Pt; r0: number; r1: number; a0: number; a1: number };

export type Shape = { prim: Prim; role: Role };

export type Dim =
  /** A length between two model points, offset perpendicular to it. */
  | { t: "len"; a: Pt; b: Pt; text: string; off: number }
  /** A radius, called out along a ray from the centre. */
  | { t: "rad"; c: Pt; r: number; at: number; text: string }
  /** An included angle, drawn at a fixed VIEW radius so it stays readable. */
  | { t: "ang"; c: Pt; a0: number; a1: number; text: string; vr?: number }
  /** Free text pinned to a model point. */
  | { t: "note"; at: Pt; text: string; dx?: number; dy?: number; anchor?: Anchor };

export type Anchor = "start" | "middle" | "end";

export type Scene = {
  shapes: Shape[];
  dims: Dim[];
  /**
   * Sub-drawing captions, e.g. "elevation" / "section" / "cheek ×2".
   *
   * `dy` nudges in VIEW pixels, not model units, and it exists because a
   * caption's only real constraint is clearing the dimension lines — which are
   * themselves offset in pixels. A caption placed a few millimetres above the
   * geometry lands on top of a dimension whenever the drawing scales down.
   */
  captions?: { at: Pt; text: string; anchor?: Anchor; dy?: number }[];
  /**
   * A fixed extent to fit to, instead of the scene's own bounding box.
   *
   * WHY A ROTATING DRAWING NEEDED THIS. `project` normally measures what the
   * scene occupies and scales it to fill the frame. That is right for a static
   * drawing and wrong for one you can turn: as the object rotates its
   * projected box changes shape, so the fitted scale changes with it, and the
   * drawing appears to zoom in and out and jump about while you drag. Reported
   * as "while rotating it's getting zoomed and losing shape".
   *
   * The isometric supplies its own extent — the object's bounding SPHERE, which
   * by definition does not change with the camera — so the scale is constant at
   * every angle and only the object turns.
   */
  fit?: Bounds;
};

export const deg = (d: number) => (d * Math.PI) / 180;

/* ---- builders ---------------------------------------------------------- */

export const poly = (pts: Pt[], role: Role = "cut", closed = true): Shape => ({
  prim: { t: "poly", pts, closed },
  role,
});

export const line = (a: Pt, b: Pt, role: Role = "cut"): Shape => ({
  prim: { t: "poly", pts: [a, b], closed: false },
  role,
});

export const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  role: Role = "cut",
): Shape =>
  poly(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    role,
  );

export const arc = (c: Pt, r: number, a0: number, a1: number, role: Role = "cut"): Shape => ({
  prim: { t: "arc", c, r, a0, a1 },
  role,
});

export const sector = (
  c: Pt,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
  role: Role = "cut",
): Shape => ({ prim: { t: "sector", c, r0, r1, a0, a1 }, role });

export const at = (c: Pt, r: number, a: number): Pt => [
  c[0] + r * Math.cos(deg(a)),
  c[1] + r * Math.sin(deg(a)),
];

/* ---- projection --------------------------------------------------------- */

type Box = { minX: number; minY: number; maxX: number; maxY: number };

const EMPTY: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

function grow(b: Box, [x, y]: Pt): Box {
  return {
    minX: Math.min(b.minX, x),
    minY: Math.min(b.minY, y),
    maxX: Math.max(b.maxX, x),
    maxY: Math.max(b.maxY, y),
  };
}

/** Arcs are sampled for the bounding box only — 24 points is closer than a
 * pixel at any size this app draws, and the arc itself is never flattened. */
function primPoints(p: Prim): Pt[] {
  if (p.t === "poly") return p.pts;
  const steps = 24;
  const out: Pt[] = [];
  const radii = p.t === "sector" ? [p.r0, p.r1] : [p.r];
  for (const r of radii) {
    for (let i = 0; i <= steps; i++) {
      out.push(at(p.c, r, p.a0 + ((p.a1 - p.a0) * i) / steps));
    }
  }
  return out;
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Measure a group of shapes so it can be laid out beside another group.
 * Used by the flat-pattern view, which nests independent blanks on one sheet. */
export function bounds(shapes: Shape[]): Bounds {
  let b = EMPTY;
  for (const s of shapes) for (const p of primPoints(s.prim)) b = grow(b, p);
  return Number.isFinite(b.minX) ? b : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

export function movePt([x, y]: Pt, dx: number, dy: number): Pt {
  return [x + dx, y + dy];
}

export function moveShapes(shapes: Shape[], dx: number, dy: number): Shape[] {
  return shapes.map(({ prim, role }) => {
    if (prim.t === "poly") {
      return { role, prim: { ...prim, pts: prim.pts.map((p) => movePt(p, dx, dy)) } };
    }
    return { role, prim: { ...prim, c: movePt(prim.c, dx, dy) } };
  });
}

export function moveDims(dims: Dim[], dx: number, dy: number): Dim[] {
  return dims.map((d) => {
    if (d.t === "len") return { ...d, a: movePt(d.a, dx, dy), b: movePt(d.b, dx, dy) };
    if (d.t === "rad" || d.t === "ang") return { ...d, c: movePt(d.c, dx, dy) };
    return { ...d, at: movePt(d.at, dx, dy) };
  });
}

export type ViewShape = { d: string; role: Role };

export type ViewDim =
  | { t: "len"; d: string; ticks: string; x: number; y: number; angle: number; text: string }
  | { t: "rad"; d: string; x: number; y: number; text: string; anchor: Anchor }
  | { t: "ang"; d: string; x: number; y: number; text: string }
  | { t: "note"; x: number; y: number; text: string; anchor: Anchor };

export type ViewScene = {
  width: number;
  height: number;
  shapes: ViewShape[];
  dims: ViewDim[];
  captions: { x: number; y: number; text: string; anchor: Anchor }[];
  /**
   * View pixels per model millimetre.
   *
   * Exposed because a scene laid out in MODEL units cannot know how much room
   * its annotations will need — those are offset in VIEW pixels. The flat
   * pattern lays several blanks side by side and has to leave a gap wide
   * enough for two dimension lines and their labels, which is a view-space
   * quantity; it projects once, reads this, and re-lays out. See buildView.
   */
  scale: number;
};

/** Base room outside the geometry, before the dimension offsets are counted. */
const PAD = 46;

/**
 * How far outside the geometry this scene's annotations actually reach.
 *
 * The bounding box is built from MODEL points, but a dimension line is drawn
 * at a perpendicular offset measured in VIEW pixels, and its label sits
 * further out again. Padding by a fixed amount therefore clipped exactly the
 * drawings whose dimensions were pushed furthest out — the ones with the most
 * to say. This measures the reach instead.
 */
function annotationReach(scene: Scene): number {
  let reach = 0;
  for (const d of scene.dims) {
    if (d.t === "len") reach = Math.max(reach, Math.abs(d.off) + 22);
    else if (d.t === "ang") reach = Math.max(reach, (d.vr ?? 46) + 30);
    else if (d.t === "rad") reach = Math.max(reach, 34);
    else reach = Math.max(reach, Math.abs(d.dy ?? 0) + Math.abs(d.dx ?? 0) + 20);
  }
  /* Captions hang below the deepest piece. */
  if (scene.captions?.length) reach = Math.max(reach, 34);
  return reach;
}

export function project(
  scene: Scene,
  width: number,
  height: number,
  pad = PAD,
): ViewScene {
  const room = Math.max(pad, annotationReach(scene) + 10);
  let box = EMPTY;
  if (scene.fit) {
    /* A camera-independent extent, so a rotating drawing keeps one scale. */
    box = scene.fit;
  } else {
    for (const s of scene.shapes) for (const p of primPoints(s.prim)) box = grow(box, p);
    for (const d of scene.dims) {
      if (d.t === "len") box = grow(grow(box, d.a), d.b);
      if (d.t === "rad" || d.t === "ang") box = grow(box, d.c);
      if (d.t === "note") box = grow(box, d.at);
    }
  }
  if (!Number.isFinite(box.minX)) box = { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  const bw = Math.max(box.maxX - box.minX, 1e-6);
  const bh = Math.max(box.maxY - box.minY, 1e-6);
  const s = Math.min((width - room * 2) / bw, (height - room * 2) / bh);
  const tx = (width - bw * s) / 2 - box.minX * s;
  const ty = (height - bh * s) / 2 - box.minY * s;

  const P = ([x, y]: Pt): Pt => [x * s + tx, y * s + ty];
  const n = (v: number) => Math.round(v * 100) / 100;

  const shapes: ViewShape[] = scene.shapes.map((sh) => ({
    role: sh.role,
    d: primPath(sh.prim, P, s, n),
  }));

  const dims: ViewDim[] = scene.dims.map((d) => projectDim(d, P, n));

  const captions = (scene.captions ?? []).map((c) => {
    const [x, y] = P(c.at);
    return {
      x: n(x),
      y: n(y + (c.dy ?? 0)),
      text: c.text,
      anchor: c.anchor ?? "middle",
    };
  });

  return { width, height, shapes, dims, captions, scale: s };
}

function primPath(p: Prim, P: (pt: Pt) => Pt, s: number, n: (v: number) => number): string {
  if (p.t === "poly") {
    const pts = p.pts.map(P);
    const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join(" ");
    return p.closed ? `${d} Z` : d;
  }
  if (p.t === "arc") {
    const r = p.r * s;
    const a = P(at(p.c, p.r, p.a0));
    const b = P(at(p.c, p.r, p.a1));
    const large = Math.abs(p.a1 - p.a0) > 180 ? 1 : 0;
    const sweep = p.a1 > p.a0 ? 1 : 0;
    return `M${n(a[0])} ${n(a[1])} A${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(b[0])} ${n(b[1])}`;
  }
  /* An annular sector: out along the inner radius, around, back along the
   * outer, around the other way, closed. This is an elbow cheek. */
  const r0 = p.r0 * s;
  const r1 = p.r1 * s;
  const large = Math.abs(p.a1 - p.a0) > 180 ? 1 : 0;
  const i0 = P(at(p.c, p.r0, p.a0));
  const i1 = P(at(p.c, p.r0, p.a1));
  const o1 = P(at(p.c, p.r1, p.a1));
  const o0 = P(at(p.c, p.r1, p.a0));
  return [
    `M${n(i0[0])} ${n(i0[1])}`,
    `A${n(r0)} ${n(r0)} 0 ${large} 1 ${n(i1[0])} ${n(i1[1])}`,
    `L${n(o1[0])} ${n(o1[1])}`,
    `A${n(r1)} ${n(r1)} 0 ${large} 0 ${n(o0[0])} ${n(o0[1])}`,
    "Z",
  ].join(" ");
}

/** Architectural dimension line: extension lines, a run between them, and a
 * 45° tick at each end rather than an arrowhead — it stays legible at the
 * sizes this app draws and it is what a duct shop drawing looks like. */
function projectDim(d: Dim, P: (pt: Pt) => Pt, n: (v: number) => number): ViewDim {
  if (d.t === "len") {
    const [ax, ay] = P(d.a);
    const [bx, by] = P(d.b);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const nx = -uy;
    const ny = ux;
    const o = d.off;
    const a2: Pt = [ax + nx * o, ay + ny * o];
    const b2: Pt = [bx + nx * o, by + ny * o];
    const ext = 5;
    const path = [
      `M${n(ax + nx * (o > 0 ? 3 : -3))} ${n(ay + ny * (o > 0 ? 3 : -3))}`,
      `L${n(a2[0] + nx * ext)} ${n(a2[1] + ny * ext)}`,
      `M${n(bx + nx * (o > 0 ? 3 : -3))} ${n(by + ny * (o > 0 ? 3 : -3))}`,
      `L${n(b2[0] + nx * ext)} ${n(b2[1] + ny * ext)}`,
      `M${n(a2[0])} ${n(a2[1])} L${n(b2[0])} ${n(b2[1])}`,
    ].join(" ");
    const tick = 5;
    const tx = (ux + nx) * tick;
    const ty = (uy + ny) * tick;
    const ticks = [
      `M${n(a2[0] - tx)} ${n(a2[1] - ty)} L${n(a2[0] + tx)} ${n(a2[1] + ty)}`,
      `M${n(b2[0] - tx)} ${n(b2[1] - ty)} L${n(b2[0] + tx)} ${n(b2[1] + ty)}`,
    ].join(" ");
    let angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    /* Never print a label upside down. */
    if (angle > 90 || angle < -90) angle += 180;
    const mx = (a2[0] + b2[0]) / 2 + nx * 9;
    const my = (a2[1] + b2[1]) / 2 + ny * 9;
    return { t: "len", d: path, ticks, x: n(mx), y: n(my), angle: n(angle), text: d.text };
  }

  if (d.t === "rad") {
    const c = P(d.c);
    const e = P(at(d.c, d.r, d.at));
    const out: Pt = [e[0] + (e[0] - c[0]) * 0.12, e[1] + (e[1] - c[1]) * 0.12];
    const path = `M${n(c[0])} ${n(c[1])} L${n(out[0])} ${n(out[1])}`;
    const anchor: Anchor = out[0] >= c[0] ? "start" : "end";
    return {
      t: "rad",
      d: path,
      x: n(out[0] + (anchor === "start" ? 6 : -6)),
      y: n(out[1] - 4),
      text: d.text,
      anchor,
    };
  }

  if (d.t === "ang") {
    const c = P(d.c);
    /* Fixed VIEW radius: the angle mark must not shrink with the fitting. */
    const vr = d.vr ?? 46;
    const a = [c[0] + vr * Math.cos(deg(d.a0)), c[1] + vr * Math.sin(deg(d.a0))];
    const b = [c[0] + vr * Math.cos(deg(d.a1)), c[1] + vr * Math.sin(deg(d.a1))];
    const large = Math.abs(d.a1 - d.a0) > 180 ? 1 : 0;
    const sweep = d.a1 > d.a0 ? 1 : 0;
    const path = `M${n(a[0])} ${n(a[1])} A${vr} ${vr} 0 ${large} ${sweep} ${n(b[0])} ${n(b[1])}`;
    const mid = (d.a0 + d.a1) / 2;
    return {
      t: "ang",
      d: path,
      x: n(c[0] + (vr + 16) * Math.cos(deg(mid))),
      y: n(c[1] + (vr + 16) * Math.sin(deg(mid)) + 4),
      text: d.text,
    };
  }

  const [x, y] = P(d.at);
  return {
    t: "note",
    x: n(x + (d.dx ?? 0)),
    y: n(y + (d.dy ?? 0)),
    text: d.text,
    anchor: d.anchor ?? "middle",
  };
}
