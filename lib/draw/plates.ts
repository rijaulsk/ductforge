import { frameOpening, ovalParts, plateHole, ringHole } from "../duct/plates";
import type { FlatFitting } from "../duct/types";
import type { Label } from "./blueprint";
import { type Dim, type Pt, type Shape, arc, line, poly, rect } from "./scene";

/* The flat pieces, face on — one drawing used twice.
 *
 * A flat piece's dimensioned view and its flat pattern are the SAME outline:
 * there is nothing to unfold, so the blank is the part. Drawing them in two
 * files would be two chances to draw them differently, so both the blueprint
 * and the flat pattern ask this file for the face and add only what is theirs
 * — the blueprint its centre lines and caption, the pattern its "blank ×1".
 *
 * Model units are millimetres with y pointing DOWN the page, as everywhere in
 * lib/draw. Every limited size (a hole wider than its plate) comes from
 * lib/duct/plates.ts, the same function the area was computed with, so the
 * drawing and the total describe one plate.
 */

export type PlateFace = {
  shapes: Shape[];
  dims: Dim[];
  /** Extent of the outline, for placing centre lines and captions. */
  w: number;
  h: number;
  /** Which centre lines the shape actually has an axis for. A triangle has a
   * vertical axis of symmetry and no horizontal one. */
  axes: { vertical: boolean; horizontal: boolean };
};

/** A closed circle as two half arcs — the form that actually closes. Drawn
 * even at zero radius, where it is a dot: a plate of nothing must still draw
 * something, or the viewer shows an empty frame that reads as broken. */
const circle = (c: Pt, r: number): Shape[] => [arc(c, r, 0, 180), arc(c, r, 180, 360)];

/**
 * A hole's diameter, called out on a leader from its centre.
 *
 * A leader, not a dimension line, because a dimension across a hole has to run
 * through the hole's own centre lines, and one outside the plate has
 * extension lines that start in empty air, nowhere near the hole they measure.
 * A diameter leader pointing at the circle is how a drawing office marks a
 * hole, and it cannot be confused with the plate's own sizes.
 */
const holeLeader = (c: Pt, d: number, L: Label): Dim => ({
  t: "rad",
  c,
  r: d / 2,
  at: -40,
  text: `⌀ ${L(d)}`,
});

export function plateFace(f: FlatFitting, L: Label, off: number): PlateFace {
  switch (f.kind) {
    case "flat": {
      const { w, h } = f;
      return {
        shapes: [rect(0, 0, w, h)],
        dims: [
          { t: "len", a: [0, h], b: [w, h], text: L(w), off },
          { t: "len", a: [0, 0], b: [0, h], text: L(h), off },
        ],
        w,
        h,
        axes: { vertical: true, horizontal: true },
      };
    }

    /* The diameter is dimensioned between the circle's two tangent lines —
     * the drafting convention for an outside diameter — so its extension
     * lines leave the outline rather than cross it. */
    case "flat-circle": {
      const { d } = f;
      return {
        shapes: circle([d / 2, d / 2], d / 2),
        dims: [{ t: "len", a: [0, d], b: [d, d], text: `⌀ ${L(d)}`, off }],
        w: d,
        h: d,
        axes: { vertical: true, horizontal: true },
      };
    }

    case "flat-ring": {
      const d = f.d1;
      const hole = ringHole(f);
      const c: Pt = [d / 2, d / 2];
      return {
        shapes: [...circle(c, d / 2), ...(hole > 0 ? circle(c, hole / 2) : [])],
        dims: [
          { t: "len", a: [0, d], b: [d, d], text: `⌀ ${L(d)}`, off },
          ...(hole > 0 ? [holeLeader(c, hole, L)] : []),
        ],
        w: d,
        h: d,
        axes: { vertical: true, horizontal: true },
      };
    }

    case "flat-holed": {
      const { w, h } = f;
      const hole = plateHole(f);
      const c: Pt = [w / 2, h / 2];
      return {
        shapes: [rect(0, 0, w, h), ...(hole > 0 ? circle(c, hole / 2) : [])],
        dims: [
          { t: "len", a: [0, h], b: [w, h], text: L(w), off },
          { t: "len", a: [0, 0], b: [0, h], text: L(h), off },
          ...(hole > 0 ? [holeLeader(c, hole, L)] : []),
        ],
        w,
        h,
        axes: { vertical: true, horizontal: true },
      };
    }

    /* The opening is dimensioned INSIDE itself, along its own bottom and right
     * edges, so its two sizes sit in the space they measure and never compete
     * with the outside sizes, which are outside. */
    case "flat-frame": {
      const { w, h } = f;
      const o = frameOpening(f);
      const x0 = (w - o.w) / 2;
      const y0 = (h - o.h) / 2;
      const inner = off * 0.5;
      const open = o.w > 0 && o.h > 0;
      /* Each runs so that its offset normal points INTO the opening — right to
       * left along the bottom, top to bottom down the right — which puts the
       * label beyond the dimension line, deeper inside, rather than squeezed
       * between the line and the edge it measures. */
      return {
        shapes: [rect(0, 0, w, h), ...(open ? [rect(x0, y0, o.w, o.h)] : [])],
        dims: [
          { t: "len", a: [0, h], b: [w, h], text: L(w), off },
          { t: "len", a: [0, 0], b: [0, h], text: L(h), off },
          ...(open
            ? ([
                { t: "len", a: [x0 + o.w, y0 + o.h], b: [x0, y0 + o.h], text: L(o.w), off: inner },
                { t: "len", a: [x0 + o.w, y0], b: [x0 + o.w, y0 + o.h], text: L(o.h), off: inner },
              ] satisfies Dim[])
            : []),
        ],
        w,
        h,
        axes: { vertical: true, horizontal: true },
      };
    }

    /* Overall length along the bottom and overall height up the left, both
     * from the outline's tangent lines — the two sizes the plate is ordered
     * by. The round ends' diameter IS the height, so it needs no third call. */
    case "flat-oval": {
      const { short, straight } = ovalParts(f);
      const r = short / 2;
      const across = f.w >= f.h;
      const w = across ? straight + short : short;
      const h = across ? short : straight + short;
      const shapes: Shape[] = across
        ? [
            line([r, 0], [r + straight, 0]),
            line([r, short], [r + straight, short]),
            arc([r, r], r, 90, 270),
            arc([r + straight, r], r, -90, 90),
          ]
        : [
            line([0, r], [0, r + straight]),
            line([short, r], [short, r + straight]),
            arc([r, r], r, 180, 360),
            arc([r, r + straight], r, 0, 180),
          ];
      return {
        shapes,
        dims: [
          { t: "len", a: [0, h], b: [w, h], text: L(f.w), off },
          { t: "len", a: [0, 0], b: [0, h], text: L(f.h), off },
        ],
        w,
        h,
        axes: { vertical: true, horizontal: true },
      };
    }

    /* The height is measured square to the base, off to the left, from a
     * construction line carried across from the apex — so the dimension's
     * extension line has something to start from. */
    case "flat-triangle": {
      const { w, h } = f;
      return {
        shapes: [
          poly([
            [0, h],
            [w, h],
            [w / 2, 0],
          ]),
          ...(w > 0 ? [line([0, 0], [w / 2, 0], "hidden")] : []),
        ],
        dims: [
          { t: "len", a: [0, h], b: [w, h], text: L(w), off },
          { t: "len", a: [0, 0], b: [0, h], text: L(h), off },
        ],
        w,
        h,
        axes: { vertical: true, horizontal: false },
      };
    }

    case "flat-trapezoid": {
      const top = f.w1;
      const bottom = f.w2;
      const h = f.h;
      const w = Math.max(top, bottom);
      const tx = (w - top) / 2;
      const bx = (w - bottom) / 2;
      return {
        shapes: [
          poly([
            [tx, 0],
            [tx + top, 0],
            [bx + bottom, h],
            [bx, h],
          ]),
          /* Whichever edge is the shorter, carry its end out to where the
           * height dimension stands. */
          ...(tx > 0 ? [line([0, 0], [tx, 0], "hidden")] : []),
          ...(bx > 0 ? [line([0, h], [bx, h], "hidden")] : []),
        ],
        dims: [
          { t: "len", a: [bx, h], b: [bx + bottom, h], text: L(bottom), off },
          { t: "len", a: [tx + top, 0], b: [tx, 0], text: L(top), off },
          { t: "len", a: [0, 0], b: [0, h], text: L(h), off },
        ],
        w,
        h,
        axes: { vertical: true, horizontal: false },
      };
    }
  }
}
