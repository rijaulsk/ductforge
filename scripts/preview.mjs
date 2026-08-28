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
function sheet({ items, box = [44, 28], cell = 240, cols = 3, stroke = 1.5 }) {
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

  return {
    png: encodePng(width, height, rasterise({ width, height, shapes, background: CREAM })),
    width,
    height,
  };
}

mkdirSync(out("preview"), { recursive: true });

const MODES = {
  icons: "the app icon at 256/64/32/16, on every ground it lands on",
  lockup: "the full logo at the sizes the header renders it",
  joint: "candidate flange-joint widths, side by side",
  glyphs: "the fitting picker's marks",
};

if (!MODES[process.argv[2]]) {
  console.log("usage: node scripts/preview.mjs <mode>\n");
  for (const [name, what] of Object.entries(MODES)) {
    console.log(`  ${name.padEnd(8)} ${what}`);
  }
  process.exit(process.argv[2] ? 1 : 0);
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

/* How wide should the flange joint be? `node scripts/preview.mjs joint`
 *
 * One row per candidate width, at the sizes the icon is actually seen at. This
 * exists because the number has been wrong in both directions three times by
 * being reasoned about — too wide and the gaps sever the duct into floating
 * pieces, too narrow and they are invisible below poster size — and every time
 * the mistake was obvious within a second of looking at a rendered sheet.
 */
if (process.argv[2] === "joint") {
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
  writeFileSync(out("preview/joint.png"), encodePng(width, height, canvas));
  console.log(`preview/joint.png  ${width} × ${height}   columns: 192 · 64 (×3) · 32 (×6)`);
  WIDTHS.forEach((w, i) => console.log(`  row ${i + 1}  joint ${w}`));
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
