/* Icon generation. Run with `npm run icons` after changing the mark.
 *
 * The app needs real raster icons — a favicon.ico for the browsers and
 * bookmark bars that still ignore SVG, an apple-touch-icon, and PNGs for the
 * web manifest including a maskable one. Every off-the-shelf way to produce
 * those is a native binary dependency, for a job that is one rounded rectangle
 * and one elbow: see scripts/raster.mjs for why that is not worth taking on.
 *
 * The mark comes from scripts/mark.mjs, which the logo generator also uses, so
 * the tab icon and the wordmark's mark are the same shape by construction
 * rather than by somebody remembering. They were not, once.
 *
 * Output is checked in. The build never runs this.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CREAM, INDIGO, MARK_PATH, roundedRect } from "./mark.mjs";
import { encodeIco, encodePng, parsePath, rasterise, transform } from "./raster.mjs";

const ROOT = new URL("../", import.meta.url);
const out = (p) => fileURLToPath(new URL(p, ROOT));

const mark = parsePath(MARK_PATH);

/**
 * One square icon.
 *
 * `rounded` off with a bigger inset is the maskable variant: Android crops a
 * maskable icon to whatever shape the launcher uses, so it has to bleed to the
 * edges and keep the mark inside the middle 80%.
 */
function icon(size, { rounded = true, inset = 0.2 } = {}) {
  const pad = size * inset;
  const inner = size - pad * 2;
  const shapes = [];

  if (rounded) {
    shapes.push({
      contours: parsePath(roundedRect(size, size * 0.22)),
      color: INDIGO,
    });
  } else {
    shapes.push({ contours: parsePath(roundedRect(size, 0)), color: INDIGO });
  }
  shapes.push({
    contours: transform(mark, { sx: inner / 100, tx: pad, ty: pad }),
    color: CREAM,
  });

  return encodePng(size, size, rasterise({ width: size, height: size, shapes }));
}

mkdirSync(out("public/icons"), { recursive: true });

const files = [
  ["app/apple-icon.png", icon(180)],
  ["public/icons/icon-192.png", icon(192)],
  ["public/icons/icon-512.png", icon(512)],
  ["public/icons/icon-maskable-512.png", icon(512, { rounded: false, inset: 0.28 })],
];

for (const [path, buf] of files) {
  writeFileSync(out(path), buf);
  console.log(`${path}  ${buf.length} bytes`);
}

/* 16, 32 and 48 in one file. At 16px the bore closes up a little, which is
 * exactly what should happen — a favicon is a silhouette, not a diagram. */
const ico = encodeIco([16, 32, 48].map((size) => ({ size, png: icon(size) })));
writeFileSync(out("app/favicon.ico"), ico);
console.log(`app/favicon.ico  ${ico.length} bytes (16, 32, 48)`);
