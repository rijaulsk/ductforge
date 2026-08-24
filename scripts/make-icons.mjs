/* Icon generation. Run with `npm run icons` after changing the mark.
 *
 * WHY THIS EXISTS RATHER THAN A DEPENDENCY. The app needs real raster icons —
 * a favicon.ico for the browsers and bookmark bars that still ignore SVG, an
 * apple-touch-icon, and PNGs for the web manifest including a maskable one.
 * Every off-the-shelf way to produce those (sharp, resvg, canvas) is a native
 * binary dependency for a job that is, for THIS mark, a rounded rectangle and
 * a stroked path.
 *
 * So it is rasterised here from the same geometry as app/icon.svg, with 4×4
 * supersampling, and encoded with node's own zlib. No dependency, and the
 * output is checked in — the build never runs this.
 *
 * The geometry is defined once, in the SVG's 32-unit coordinate space, and
 * every size is that space scaled. Change app/icon.svg and change MARK to
 * match, or they drift apart and nobody notices until a tab looks wrong.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const out = (p) => fileURLToPath(new URL(p, ROOT));

/* ---- the mark, in the SVG's 32-unit space ------------------------------- */

const INDIGO = [0x64, 0x67, 0xf2];
const CREAM = [0xf7, 0xf3, 0xeb];

const MARK = {
  box: 32,
  radius: 7,
  /* M9 25 V16 A7 7 0 0 1 16 9 H25 — a vertical, a quarter arc, a horizontal. */
  stroke: 4.5,
  vertical: { x: 9, y0: 16, y1: 25 },
  arc: { cx: 16, cy: 16, r: 7, a0: 180, a1: 270 },
  horizontal: { y: 9, x0: 16, x1: 25 },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToArc(px, py, { cx, cy, r, a0, a1 }) {
  const ang = ((Math.atan2(py - cy, px - cx) * 180) / Math.PI + 360) % 360;
  const inSweep = a0 <= a1 ? ang >= a0 && ang <= a1 : ang >= a0 || ang <= a1;
  if (inSweep) return Math.abs(Math.hypot(px - cx, py - cy) - r);
  const p0 = [cx + r * Math.cos((a0 * Math.PI) / 180), cy + r * Math.sin((a0 * Math.PI) / 180)];
  const p1 = [cx + r * Math.cos((a1 * Math.PI) / 180), cy + r * Math.sin((a1 * Math.PI) / 180)];
  return Math.min(Math.hypot(px - p0[0], py - p0[1]), Math.hypot(px - p1[0], py - p1[1]));
}

/** Signed distance to a rounded rectangle centred in the box. Negative inside. */
function roundedRect(px, py, box, radius) {
  const half = box / 2;
  const qx = Math.abs(px - half) - (half - radius);
  const qy = Math.abs(py - half) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Distance to the elbow path's centreline. */
function distToMark(px, py) {
  return Math.min(
    distToSegment(px, py, MARK.vertical.x, MARK.vertical.y0, MARK.vertical.x, MARK.vertical.y1),
    distToArc(px, py, MARK.arc),
    distToSegment(px, py, MARK.horizontal.x0, MARK.horizontal.y, MARK.horizontal.x1, MARK.horizontal.y),
  );
}

/**
 * Render one square icon to RGBA bytes.
 *
 * `rounded` off and `inset` up the way gives the maskable variant: Android
 * crops a maskable icon to whatever shape the launcher uses, so it must bleed
 * to the edges and keep the mark inside the middle 80%.
 */
function render(size, { rounded = true, inset = 0 } = {}) {
  const data = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling per axis
  const scale = MARK.box / size;
  const markScale = 1 - inset * 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = (x + (sx + 0.5) / SS) * scale;
          const uy = (y + (sy + 0.5) / SS) * scale;
          if (rounded) {
            if (roundedRect(ux, uy, MARK.box, MARK.radius) <= 0) bg++;
          } else {
            bg++;
          }
          /* Map into the inset sub-square for the maskable variant. */
          const mx = (ux - MARK.box * inset) / markScale;
          const my = (uy - MARK.box * inset) / markScale;
          if (distToMark(mx, my) <= MARK.stroke / 2 / markScale) fg++;
        }
      }
      const total = SS * SS;
      const bgA = bg / total;
      const fgA = fg / total;
      /* Cream over indigo over transparent. */
      const r = INDIGO[0] * (1 - fgA) + CREAM[0] * fgA;
      const g = INDIGO[1] * (1 - fgA) + CREAM[1] * fgA;
      const b = INDIGO[2] * (1 - fgA) + CREAM[2] * fgA;
      const a = Math.max(bgA, fgA);
      const i = (y * size + x) * 4;
      data[i] = Math.round(r);
      data[i + 1] = Math.round(g);
      data[i + 2] = Math.round(b);
      data[i + 3] = Math.round(a * 255);
    }
  }
  return data;
}

/* ---- PNG ---------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  /* 10, 11, 12 are compression, filter and interlace — all zero. */

  /* Filter type 0 on every scanline. The mark is flat colour; a smarter filter
   * would save bytes nobody is counting. */
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const at = y * (size * 4 + 1);
    raw[at] = 0;
    rgba.copy(raw, at + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---- ICO ---------------------------------------------------------------- */

/** PNG-compressed entries, which every browser and Windows Vista onward read. */
function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  const dirSize = 16 * pngs.length;
  let offset = header.length + dirSize;
  const dir = Buffer.alloc(dirSize);

  pngs.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir[at] = size >= 256 ? 0 : size;
    dir[at + 1] = size >= 256 ? 0 : size;
    dir[at + 2] = 0; // palette size
    dir[at + 3] = 0; // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.png)]);
}

/* ---- write everything --------------------------------------------------- */

mkdirSync(out("public/icons"), { recursive: true });

const png = (size, opts) => encodePng(size, render(size, opts));

const files = [
  ["app/apple-icon.png", png(180)],
  ["public/icons/icon-192.png", png(192)],
  ["public/icons/icon-512.png", png(512)],
  /* Maskable: full bleed, mark inside the middle 80% so a launcher can crop it
   * to a circle, a squircle or a rounded square without clipping the elbow. */
  ["public/icons/icon-maskable-512.png", png(512, { rounded: false, inset: 0.14 })],
];

for (const [path, buf] of files) {
  writeFileSync(out(path), buf);
  console.log(`${path}  ${buf.length} bytes`);
}

const ico = encodeIco([16, 32, 48].map((size) => ({ size, png: png(size) })));
writeFileSync(out("app/favicon.ico"), ico);
console.log(`app/favicon.ico  ${ico.length} bytes (16, 32, 48)`);
