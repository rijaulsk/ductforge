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

/* Every shipped form of the icon, at the sizes it ships at, on every ground it
 * lands on. `node scripts/preview.mjs icons`.
 *
 * IT IS THE TILE IN EVERY ROW, because the mark is never shown without it —
 * owner's rule, 28 August 2026, and there is no bare-elbow asset any more.
 * Earlier versions of this sheet rendered a bare mark in three of five rows,
 * which made it a picture of something we do not ship.
 *
 * What varies is the size, the launcher mask, and the PAGE the tile sits on:
 * an indigo square has to hold up on cream, on the dark theme's near-black and
 * on printer white, and that is the kind of thing which is invisible in the
 * source and obvious the moment you look.
 */
if (process.argv[2] === "icons") {
  const {
    BAND,
    CREAM: MC,
    INDIGO: MI,
    MARK_PATH: MP,
    TILE_INSET,
    TILE_RADIUS,
    insetFor,
    roundedRect,
  } = await import("./mark.mjs");
  const NIGHT = "#10121C";

  /** One cell: the tile at `size` px on `ground`, magnified by `zoom`. */
  function cell(size, { ground, zoom = 1, maskable = false }) {
    /* The same rule the generator uses, from the same function — see
     * mark.mjs. Recomputing it here is how a verification sheet ends up
     * showing something other than what ships. */
    const inset = maskable ? 0.23 : insetFor(size);
    const pad = size * inset;
    const inner = size - pad * 2;
    const shapes = [
      {
        contours: parsePath(roundedRect(size, maskable ? 0 : size * TILE_RADIUS)),
        color: MI,
      },
      {
        contours: transform(parsePath(MP), { sx: inner / 100, tx: pad, ty: pad }),
        color: MC,
        rule: "evenodd",
      },
    ];
    const rgba = rasterise({ width: size, height: size, shapes, background: ground });
    return { rgba, size, zoom };
  }

  const ROWS = [
    ["app icon, on cream", (s, z) => cell(s, { ground: CREAM, zoom: z })],
    ["maskable, launcher-cropped", (s, z) => cell(s, { ground: CREAM, zoom: z, maskable: true })],
    ["on the dark theme", (s, z) => cell(s, { ground: NIGHT, zoom: z })],
    ["on printer white", (s, z) => cell(s, { ground: "#FFFFFF", zoom: z })],
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

/* How wide should a mitre cut be? `node scripts/preview.mjs seams`
 *
 * One row per candidate width, at the sizes the icon is actually seen at. This
 * exists because the number has now been wrong in both directions by reasoning
 * about it — too wide and the cuts sever the duct into floating pieces, too
 * narrow and they are invisible below poster size — and both times the mistake
 * was obvious within a second of looking at a rendered sheet.
 */
if (process.argv[2] === "seams") {
  const { CREAM: MC, INDIGO: MI, TILE_RADIUS, elbow, insetFor, roundedRect } = await import(
    "./mark.mjs"
  );
  const WIDTHS = [2.5, 3.5, 4, 5, 6];
  /* Zooms chosen so every column comes out the SAME height. They did not, and
   * the tall ones overran the row below into an unreadable smear. */
  const SIZES = [
    [192, 1],
    [64, 3],
    [32, 6],
  ];

  const one = (seam, size, zoom) => {
    const inset = insetFor(size);
    const pad = size * inset;
    const inner = size - pad * 2;
    const shapes = [
      { contours: parsePath(roundedRect(size, size * TILE_RADIUS)), color: MI },
      {
        contours: transform(parsePath(elbow({ joint: seam }).path), {
          sx: inner / 100,
          tx: pad,
          ty: pad,
        }),
        color: MC,
        rule: "evenodd",
      },
    ];
    return { rgba: rasterise({ width: size, height: size, shapes, background: CREAM }), size, zoom };
  };

  const cells = WIDTHS.map((w) => SIZES.map(([s, z]) => one(w, s, z)));
  const colW = SIZES.map(([s, z]) => s * z + 24);
  const rowH = Math.max(...SIZES.map(([s, z]) => s * z)) + 24;
  const width = colW.reduce((a, b) => a + b, 0);
  const height = rowH * WIDTHS.length;
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
  writeFileSync(out("preview/seams.png"), encodePng(width, height, canvas));
  console.log(`preview/seams.png  ${width} × ${height}   columns: 200 · 64 (×4) · 32 (×8)`);
  WIDTHS.forEach((w, i) => console.log(`  row ${i + 1}  seam ${w}`));
}

/* Node 24 strips types, but its resolver still wants a full specifier. One
 * hook bridges that so this script can import the app's own .ts modules. */
async function allowTypeScriptImports() {
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
}

/* The LOCKUP at the sizes the app renders it. `node scripts/preview.mjs lockup`
 *
 * Imports lib/brand/logo.ts — the generated data the components actually use —
 * so this verifies the shipped artwork rather than a second construction of it.
 * The header is the surface the logo is seen on most and the one nobody checks;
 * the byline joined the artwork on 28 August 2026 and its legibility at 38px is
 * the thing that decides whether that was a good idea.
 */
if (process.argv[2] === "lockup") {
  await allowTypeScriptImports();

  const logo = await import("../lib/brand/logo.ts");
  const { LOGO, TILE } = logo;
  const NIGHT = "#10121C";
  const [vx, vy, vw, vh] = LOGO.viewBox.split(" ").map(Number);

  /** The lockup at `height` px, with the type in the given colours. */
  function render(height, { ground, word, byline, zoom = 1 }) {
    const s = height / vh;
    const width = Math.round(vw * s);
    /* Scale the path, then place it where the viewBox says — the same order
     * the SVG's own transform applies, so this cannot drift from the markup. */
    const at = (d, scale, tx, ty) =>
      transform(parsePath(d), {
        sx: s * scale,
        tx: (tx - vx) * s,
        ty: (ty - vy) * s,
      });
    const inner = (LOGO.tileSize * (1 - TILE.inset * 2)) / 100;
    const pad = LOGO.tileSize * TILE.inset;
    const rgba = rasterise({
      width,
      height,
      background: ground,
      shapes: [
        { contours: at(logo.TILE_PATH, LOGO.tileSize / 100, 0, 0), color: TILE.ground },
        { contours: at(logo.MARK_PATH, inner, pad, pad), color: TILE.mark, rule: "evenodd" },
        { contours: at(logo.WORDMARK_PATH, 1, LOGO.textX, LOGO.baseline), color: word },
        { contours: at(logo.BYLINE_PATH, 1, LOGO.textX, LOGO.bylineBaseline), color: byline },
      ],
    });
    return { rgba, width, height, zoom };
  }

  /* 50 is `md`, 38 is `sm` — the one in AppHeader — and 28 is what a cramped
   * phone header would fall back to if the sizes ever shrank. */
  const ROWS = [
    ["light 50", render(50, { ground: CREAM, word: "#5251DA", byline: "#5E5A53", zoom: 3 })],
    ["light 38", render(38, { ground: CREAM, word: "#5251DA", byline: "#5E5A53", zoom: 4 })],
    ["light 28", render(28, { ground: CREAM, word: "#5251DA", byline: "#5E5A53", zoom: 5 })],
    ["dark 38", render(38, { ground: NIGHT, word: "#8792FE", byline: "#D8D4CD", zoom: 4 })],
  ];

  const width = Math.max(...ROWS.map(([, r]) => r.width * r.zoom)) + 24;
  const rowH = Math.max(...ROWS.map(([, r]) => r.height * r.zoom)) + 20;
  const height = rowH * ROWS.length;
  const canvas = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    canvas[i * 4] = 0xe4;
    canvas[i * 4 + 1] = 0xe0;
    canvas[i * 4 + 2] = 0xd8;
    canvas[i * 4 + 3] = 255;
  }
  ROWS.forEach(([, r], i) => {
    const y0 = i * rowH + 10;
    for (let y = 0; y < r.height * r.zoom; y++) {
      const sy = Math.floor(y / r.zoom);
      for (let x = 0; x < r.width * r.zoom; x++) {
        const sx = Math.floor(x / r.zoom);
        const from = (sy * r.width + sx) * 4;
        const to = ((y0 + y) * width + 12 + x) * 4;
        if (to + 4 <= canvas.length) r.rgba.copy(canvas, to, from, from + 4);
      }
    }
  });
  writeFileSync(out("preview/lockup.png"), encodePng(width, height, canvas));
  console.log(`preview/lockup.png  ${width} × ${height}`);
  ROWS.forEach(([name, r]) => console.log(`  ${name}  ${r.width} × ${r.height} px (×${r.zoom})`));
}

if (process.argv[2] === "glyphs") {
  await allowTypeScriptImports();

  const { GLYPH_PATHS } = await import("../lib/duct/glyphs.ts");
  const items = Object.values(GLYPH_PATHS).map((d) => ({ d }));
  const { png, width, height } = sheet({ items, cols: 3 });
  writeFileSync(out("preview/glyphs.png"), png);
  console.log(`preview/glyphs.png  ${width} × ${height}  (${items.length} marks)`);
}
