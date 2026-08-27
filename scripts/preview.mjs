/* Render marks to a PNG so they can be looked at. `node scripts/preview.mjs`
 *
 * WHY THIS EXISTS. Reasoning about a path and looking at it are different
 * activities, and the round-fitting glyphs proved it twice: they read as
 * perfectly sensible coordinates and rendered with a stray dot where a
 * near-closed arc's round cap sat, and a visible gap where an ellipse had been
 * started from its centre instead of its edge. Neither was findable by reading
 * the numbers.
 *
 * Writes preview/*.png, which is gitignored — these are for the eye during a
 * change, not artefacts of the build.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encodePng, parsePath, rasterise, strokeToPolygons, transform } from "./raster.mjs";

const ROOT = new URL("../", import.meta.url);
const out = (p) => fileURLToPath(new URL(p, ROOT));

const INK = "#221D17";
const CREAM = "#F7F3EB";

/**
 * Lay out several stroked marks on one sheet, each in its own cell.
 *
 * `box` is the viewBox the paths were drawn in; `cell` is how big each one is
 * rendered. Strokes are expanded to polygons and filled non-zero, which is
 * what a browser does with a stroke.
 */
export function sheet({ items, box = [44, 28], cell = 240, cols = 3, stroke = 1.5 }) {
  const [bw, bh] = box;
  const scale = cell / bw;
  const cellH = Math.round(bh * scale) + 44;
  const rows = Math.ceil(items.length / cols);
  const width = cell * cols;
  const height = cellH * rows;

  const shapes = [];
  items.forEach((item, i) => {
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * cellH;
    const contours = transform(parsePath(item.d), { sx: scale, tx: cx, ty: cy + 22 });
    shapes.push({
      contours: strokeToPolygons(contours, stroke * scale),
      color: item.color ?? INK,
      rule: "nonzero",
    });
  });

  return { png: encodePng(width, height, rasterise({ width, height, shapes, background: CREAM })), width, height };
}

/** Fill, not stroke — for the logo mark and anything else solid. */
export function solidSheet({ items, box = [100, 100], cell = 260, cols = 3 }) {
  const [bw, bh] = box;
  const scale = cell / bw;
  const cellH = Math.round(bh * scale) + 40;
  const rows = Math.ceil(items.length / cols);
  const width = cell * cols;
  const height = cellH * rows;

  const shapes = [];
  items.forEach((item, i) => {
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * cellH;
    const inset = cell * 0.12;
    const s = (cell - inset * 2) / bw;
    for (const layer of item.layers) {
      shapes.push({
        contours: transform(parsePath(layer.d), { sx: s, tx: cx + inset, ty: cy + 20 }),
        color: layer.color,
        /* NON-ZERO. A mark built from several overlapping pieces — a band plus
         * a flange, a tile plus the thing on it — cancels itself out under
         * even-odd, and the first render of these candidates showed holes
         * where pieces met rather than the shapes themselves. Holes that are
         * MEANT to be holes are drawn as a later layer in the ground colour. */
        rule: layer.rule ?? "nonzero",
      });
    }
  });

  return { png: encodePng(width, height, rasterise({ width, height, shapes, background: CREAM })), width, height };
}

mkdirSync(out("preview"), { recursive: true });

if (process.argv[2] === "marks") {
  const { CANDIDATES } = await import("./mark-candidates.mjs");
  const INDIGO = "#6467F2";
  const items = CANDIDATES.map((c) => {
    const fg = c.ground ? CREAM : INDIGO;
    const bg = c.ground ? INDIGO : CREAM;
    return {
      layers: [
        { d: c.ground ?? "M0 0H100V100H0Z", color: bg },
        { d: c.d, color: fg },
        /* Anything the mark should show THROUGH itself. */
        ...(c.holes ? [{ d: c.holes, color: bg }] : []),
      ],
    };
  });
  const { png, width, height } = solidSheet({ items, cols: 3, cell: 240 });
  writeFileSync(out("preview/marks.png"), png);
  /* THE SAME MARKS AT FAVICON SIZE. A mark is judged twice — once as artwork
   * and once as sixteen pixels — and plenty of shapes that look considered at
   * 240px turn to mud. Rendered small and then blown up with no smoothing, so
   * what you are looking at is the actual pixel grid. */
  const small = solidSheet({ items, cols: items.length, cell: 32 });
  writeFileSync(out("preview/marks-16.png"), small.png);
  console.log(`preview/marks-16.png  ${small.width} × ${small.height}  (favicon size)`);
  console.log(`preview/marks.png  ${width} × ${height}  (${items.length} candidates)`);
  CANDIDATES.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`));
}

if (process.argv[2] === "glyphs") {
  /* The glyphs live in TypeScript beside the rest of the duct code; node 24
   * strips the types, and the hook bridges its need for a full specifier. */
  const { existsSync } = await import("node:fs");
  const { registerHooks } = await import("node:module");
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        const base = new URL(specifier, context.parentURL);
        for (const ext of [".ts", ".tsx"]) {
          const candidate = new URL(base.href + ext);
          if (existsSync(fileURLToPath(candidate))) {
            return { url: candidate.href, shortCircuit: true };
          }
        }
      }
      return nextResolve(specifier, context);
    },
  });

  const { GLYPH_PATHS } = await import("../lib/duct/glyphs.ts");
  const items = Object.values(GLYPH_PATHS).map((d) => ({ d }));
  const { png, width, height } = sheet({ items, cols: 3 });
  writeFileSync(out("preview/glyphs.png"), png);
  console.log(`preview/glyphs.png  ${width} × ${height}  (${items.length} marks)`);
}
