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

/**
 * Blow up a rendered buffer by an integer factor with NO smoothing.
 *
 * A 16px mark shown at 16px on a high-DPI screen is unjudgeable, and a
 * SMOOTHED enlargement hides exactly what you are looking for — a stem gone to
 * one grey pixel, a counter filled in. Nearest-neighbour shows the pixel grid
 * the browser will actually draw.
 */
function zoomBuffer(rgba, width, height, factor) {
  const out = Buffer.alloc(width * factor * height * factor * 4);
  for (let y = 0; y < height * factor; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < width * factor; x++) {
      const sx = Math.floor(x / factor);
      rgba.copy(out, (y * width * factor + x) * 4, (sy * width + sx) * 4, (sy * width + sx) * 4 + 4);
    }
  }
  return out;
}

/** Fill, not stroke — for the logo mark and anything else solid. */
export function solidSheet({ items, box = [100, 100], cell = 260, cols = 3, zoom = 1 }) {
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

  const rgba = rasterise({ width, height, shapes, background: CREAM });
  if (zoom > 1) {
    return {
      png: encodePng(width * zoom, height * zoom, zoomBuffer(rgba, width, height, zoom)),
      width: width * zoom,
      height: height * zoom,
    };
  }
  return { png: encodePng(width, height, rgba), width, height };
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
  const small = solidSheet({ items, cols: items.length, cell: 26, zoom: 9 });
  writeFileSync(out("preview/marks-16.png"), small.png);
  console.log(`preview/marks-16.png  ${small.width} × ${small.height}  (favicon size)`);
  console.log(`preview/marks.png  ${width} × ${height}  (${items.length} candidates)`);
  CANDIDATES.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`));
}

/* One mark per ROW, at the three sizes that decide it: artwork, tab, favicon.
 *
 * A shortlist shown at one size is not a shortlist. Every mark on either
 * reference sheet looks considered at 240px; the argument is entirely about
 * what survives at 16, and putting the three next to each other on one line is
 * the only way to have that argument honestly. The small two are magnified
 * with no smoothing, so what you see is the pixel grid.
 */
if (process.argv[2] === "final") {
  const { FINALISTS } = await import("./mark-candidates.mjs");
  const INDIGO = "#6467F2";
  /* 220 is artwork. 48 is a big app icon. 28 is the in-app header, which is the
   * size the mark is seen at most and the one nobody checks. 16 is the tab. */
  const SIZES = [
    { cell: 220, zoom: 1 },
    { cell: 48, zoom: 4 },
    { cell: 28, zoom: 7 },
    { cell: 18, zoom: 11 },
  ];

  const layersFor = (c) => {
    const fg = c.ground ? CREAM : INDIGO;
    const bg = c.ground ? INDIGO : CREAM;
    return [
      { d: c.ground ?? "M0 0H100V100H0Z", color: bg },
      { d: c.d, color: fg },
      ...(c.holes ? [{ d: c.holes, color: bg }] : []),
    ];
  };

  /* Rendered straight into pixel buffers rather than through solidSheet, which
   * only knows one cell size per sheet, then composited onto one canvas. */
  const raw = FINALISTS.map((c) =>
    SIZES.map(({ cell, zoom }) => {
      const [bw, bh] = [100, 100];
      const scale = cell / bw;
      const cellH = Math.round(bh * scale) + Math.round(cell * 0.15);
      const inset = cell * 0.12;
      const s = (cell - inset * 2) / bw;
      const shapes = layersFor(c).map((layer) => ({
        contours: transform(parsePath(layer.d), { sx: s, tx: inset, ty: cell * 0.075 }),
        color: layer.color,
        rule: "nonzero",
      }));
      const rgba = rasterise({ width: cell, height: cellH, shapes, background: CREAM });
      return { rgba, width: cell, height: cellH, zoom };
    }),
  );

  const rowH = Math.max(...raw[0].map((t) => t.height * t.zoom)) + 24;
  const colW = raw[0].map((t) => t.width * t.zoom + 28);
  const width = colW.reduce((a, b) => a + b, 0);
  const height = rowH * FINALISTS.length;
  const canvas = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    canvas[i * 4] = 0xf7;
    canvas[i * 4 + 1] = 0xf3;
    canvas[i * 4 + 2] = 0xeb;
    canvas[i * 4 + 3] = 255;
  }

  raw.forEach((row, r) => {
    let x0 = 14;
    row.forEach((t, ci) => {
      const y0 = r * rowH + 12;
      for (let y = 0; y < t.height * t.zoom; y++) {
        const sy = Math.floor(y / t.zoom);
        for (let x = 0; x < t.width * t.zoom; x++) {
          const sx = Math.floor(x / t.zoom);
          const from = (sy * t.width + sx) * 4;
          const to = ((y0 + y) * width + x0 + x) * 4;
          if (to + 4 <= canvas.length) t.rgba.copy(canvas, to, from, from + 4);
        }
      }
      x0 += colW[ci];
    });
  });

  writeFileSync(out("preview/final.png"), encodePng(width, height, canvas));
  console.log(`preview/final.png  ${width} × ${height}`);
  console.log("  columns: artwork · 48px (×4) · 16px (×11)");
  FINALISTS.forEach((c) => console.log(`  ${c.name}`));
}

/* Every shipped form of the mark, at the sizes it actually ships at, on every
 * ground it actually lands on. `node scripts/preview.mjs icons`.
 *
 * This exists because the mark is drawn ONE way and rendered five: knocked out
 * of the indigo tile, indigo on cream, cream on the dark theme, ink on paper,
 * and cropped by a launcher's mask. The mitre seams are holes, so each ground
 * shows through them differently, and a mistake there is invisible in the SVG
 * source and obvious the moment you look. The first cut of this mark had seams
 * a fifth of the band's width; on cream they read as fine lines and on the
 * indigo tile they severed the duct into three floating pieces.
 */
if (process.argv[2] === "icons") {
  const {
    BAND,
    CREAM: MC,
    INDIGO: MI,
    MARK_PATH: MP,
    TILE_INSET,
    insetFor,
    roundedRect,
  } = await import("./mark.mjs");
  const INK = "#221D17";
  const NIGHT = "#10121C";

  /** One cell: a ground, then the mark on it, at `size` px, zoomed. */
  function cell(size, { tile = false, fg, ground, zoom = 1, maskable = false }) {
    const shapes = [];
    /* The same rule the generator uses, from the same function — see
     * mark.mjs. Recomputing it here is how a verification sheet ends up
     * showing something other than what ships. */
    const inset = maskable ? 0.23 : insetFor(size);
    if (tile) {
      shapes.push({
        contours: parsePath(roundedRect(size, maskable ? 0 : size * 0.22)),
        color: MI,
      });
    }
    const pad = tile ? size * inset : size * 0.06;
    const inner = size - pad * 2;
    shapes.push({
      contours: transform(parsePath(MP), { sx: inner / 100, tx: pad, ty: pad }),
      color: fg,
      rule: "evenodd",
    });
    const rgba = rasterise({ width: size, height: size, shapes, background: ground });
    return { rgba, size, zoom };
  }

  const ROWS = [
    ["tile", (s, z) => cell(s, { tile: true, fg: MC, ground: CREAM, zoom: z })],
    ["maskable", (s, z) => cell(s, { tile: true, fg: MC, ground: CREAM, zoom: z, maskable: true })],
    ["indigo on cream", (s, z) => cell(s, { fg: MI, ground: CREAM, zoom: z })],
    ["cream on night", (s, z) => cell(s, { fg: MC, ground: NIGHT, zoom: z })],
    ["ink on paper", (s, z) => cell(s, { fg: INK, ground: "#FFFFFF", zoom: z })],
  ];
  const SIZES = [
    [256, 1],
    [64, 4],
    [32, 8],
    [16, 16],
  ];

  const cells = ROWS.map(([, make]) => SIZES.map(([s, z]) => make(s, z)));
  const colW = SIZES.map(([s, z]) => s * z + 24);
  const rowH = 256 + 24;
  const width = colW.reduce((a, b) => a + b, 0);
  const height = rowH * ROWS.length;
  const canvas = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    canvas[i * 4] = 0xe4;
    canvas[i * 4 + 1] = 0xe0;
    canvas[i * 4 + 2] = 0xd8;
    canvas[i * 4 + 3] = 255;
  }

  cells.forEach((row, r) => {
    let x0 = 12;
    row.forEach((c, ci) => {
      const y0 = r * rowH + 12;
      for (let y = 0; y < c.size * c.zoom; y++) {
        const sy = Math.floor(y / c.zoom);
        for (let x = 0; x < c.size * c.zoom; x++) {
          const sx = Math.floor(x / c.zoom);
          const from = (sy * c.size + sx) * 4;
          const to = ((y0 + y) * width + x0 + x) * 4;
          if (to + 4 <= canvas.length) c.rgba.copy(canvas, to, from, from + 4);
        }
      }
      x0 += colW[ci];
    });
  });

  writeFileSync(out("preview/icons.png"), encodePng(width, height, canvas));
  console.log(`preview/icons.png  ${width} × ${height}   band ${BAND}, tile inset ${TILE_INSET}`);
  console.log("  columns: 256 · 64 (×4) · 32 (×8) · 16 (×16)");
  ROWS.forEach(([name], i) => console.log(`  row ${i + 1}  ${name}`));
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
