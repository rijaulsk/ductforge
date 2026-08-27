/* A path rasteriser and PNG encoder, in about two hundred lines and no
 * dependencies.
 *
 * WHY NOT A LIBRARY. Every option — sharp, resvg, canvas, puppeteer — is a
 * native binary or a browser, for a job that is: flatten some curves into
 * polygons, decide which pixels are inside them, and deflate the result. The
 * shapes here are a duct elbow and nine outlined letters. That does not
 * warrant a build dependency, and a dependency that only runs in an asset
 * script is a dependency nobody notices has broken until the day they need it.
 *
 * Everything is flattened to polylines first, including arcs and quadratics.
 * At the supersampling this uses, a curve sampled finely enough is
 * indistinguishable from the curve, and it makes the fill one algorithm rather
 * than four.
 */

import { deflateSync } from "node:zlib";

/* ---- path parsing --------------------------------------------------------- */

const CURVE_STEPS = 24;
const ARC_STEPS = 48;

/** Split "M12 3L4 5" into ["M", 12, 3, "L", 4, 5]. */
function tokenise(d) {
  return d.match(/[MLQCAZmlqcaz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
}

/**
 * A path's contours as polylines, in the path's own coordinates.
 *
 * Absolute commands only — everything this rasterises is generated, and the
 * generators emit absolute. A relative command would silently draw the wrong
 * shape, so it throws instead.
 */
export function parsePath(d) {
  const t = tokenise(d);
  const contours = [];
  let pts = null;
  let x = 0;
  let y = 0;
  let i = 0;
  const num = () => Number(t[i++]);

  const push = (px, py) => {
    pts.push([px, py]);
    x = px;
    y = py;
  };

  while (i < t.length) {
    const cmd = t[i++];
    if (/[a-z]/.test(cmd) && cmd !== "z") {
      throw new Error(`relative path command "${cmd}" is not supported`);
    }
    switch (cmd.toUpperCase()) {
      case "M": {
        if (pts && pts.length > 1) contours.push(pts);
        pts = [];
        push(num(), num());
        break;
      }
      case "L":
        push(num(), num());
        break;
      case "Q": {
        const cx = num();
        const cy = num();
        const ex = num();
        const ey = num();
        const x0 = x;
        const y0 = y;
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const u = s / CURVE_STEPS;
          const v = 1 - u;
          push(
            v * v * x0 + 2 * v * u * cx + u * u * ex,
            v * v * y0 + 2 * v * u * cy + u * u * ey,
          );
        }
        break;
      }
      case "C": {
        const c1x = num();
        const c1y = num();
        const c2x = num();
        const c2y = num();
        const ex = num();
        const ey = num();
        const x0 = x;
        const y0 = y;
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const u = s / CURVE_STEPS;
          const v = 1 - u;
          push(
            v ** 3 * x0 + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u ** 3 * ex,
            v ** 3 * y0 + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u ** 3 * ey,
          );
        }
        break;
      }
      case "A": {
        const rx = num();
        const ry = num();
        const rot = (num() * Math.PI) / 180;
        const large = num();
        const sweep = num();
        const ex = num();
        const ey = num();
        for (const [px, py] of arcPoints(x, y, rx, ry, rot, large, sweep, ex, ey)) {
          push(px, py);
        }
        break;
      }
      case "Z":
        if (pts && pts.length > 1) contours.push(pts);
        pts = null;
        break;
      default:
        throw new Error(`unknown path command "${cmd}"`);
    }
  }
  if (pts && pts.length > 1) contours.push(pts);
  return contours;
}

/** SVG endpoint-parameterised arc → points, per the SVG implementation notes. */
function arcPoints(x1, y1, rx, ry, phi, largeArc, sweep, x2, y2) {
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosP * dx2 + sinP * dy2;
  const y1p = -sinP * dx2 + cosP * dy2;

  let RX = Math.abs(rx);
  let RY = Math.abs(ry);
  const lambda = (x1p * x1p) / (RX * RX) + (y1p * y1p) / (RY * RY);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    RX *= s;
    RY *= s;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const num = RX * RX * RY * RY - RX * RX * y1p * y1p - RY * RY * x1p * x1p;
  const den = RX * RX * y1p * y1p + RY * RY * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * (RX * y1p)) / RY;
  const cyp = (co * -(RY * x1p)) / RX;
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    return ux * vy - uy * vx < 0 ? -a : a;
  };

  const theta1 = angle(1, 0, (x1p - cxp) / RX, (y1p - cyp) / RY);
  let delta = angle(
    (x1p - cxp) / RX,
    (y1p - cyp) / RY,
    (-x1p - cxp) / RX,
    (-y1p - cyp) / RY,
  );
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  const pts = [];
  for (let s = 1; s <= ARC_STEPS; s++) {
    const t = theta1 + (delta * s) / ARC_STEPS;
    pts.push([
      cosP * RX * Math.cos(t) - sinP * RY * Math.sin(t) + cx,
      sinP * RX * Math.cos(t) + cosP * RY * Math.sin(t) + cy,
    ]);
  }
  return pts;
}

/** The box a set of contours actually occupies. */
export function bounds(contours) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of contours) {
    for (const [x, y] of c) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Scale then translate every point. */
export function transform(contours, { sx = 1, sy = sx, tx = 0, ty = 0 }) {
  return contours.map((c) => c.map(([x, y]) => [x * sx + tx, y * sy + ty]));
}

/* ---- filling -------------------------------------------------------------- */

/**
 * SCANLINE, not point-in-polygon per sample.
 *
 * The obvious implementation — for every subsample of every pixel, count how
 * many edges a ray crosses — is O(pixels × subsamples × edges), and for a
 * 512px icon with nine outlined letters that is the better part of a billion
 * operations. It ran for three minutes and was killed.
 *
 * This walks each subsample ROW once, finds where the edges cross it, sorts
 * those crossings and fills between alternate pairs — O(rows × edges), a few
 * hundred thousand operations for the same picture. Horizontal coverage comes
 * from how much of each pixel the span actually covers, so edges are
 * anti-aliased along both axes rather than only down the rows.
 *
 * Even-odd rather than non-zero, deliberately: it makes a letter's counter —
 * the hole in a D or an o — come out as a hole whichever direction the font
 * wound that contour in.
 */
function edgesOf(contours) {
  const edges = [];
  for (const c of contours) {
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const [x0, y0] = c[j];
      const [x1, y1] = c[i];
      /* Horizontal edges never cross a scanline; keeping them would only add
       * duplicate crossings at the ends of the ones that do. */
      if (y0 !== y1) edges.push([x0, y0, x1, y1]);
    }
  }
  return edges;
}

/** Add a horizontal span's contribution to one pixel row. */
function addSpan(cov, width, row, xa, xb, weight) {
  const from = Math.max(0, xa);
  const to = Math.min(width, xb);
  if (to <= from) return;
  const first = Math.floor(from);
  const last = Math.min(width - 1, Math.ceil(to) - 1);
  const base = row * width;
  for (let x = first; x <= last; x++) {
    const l = Math.max(from, x);
    const r = Math.min(to, x + 1);
    if (r > l) cov[base + x] += (r - l) * weight;
  }
}

const hex = (c) => [
  Number.parseInt(c.slice(1, 3), 16),
  Number.parseInt(c.slice(3, 5), 16),
  Number.parseInt(c.slice(5, 7), 16),
];

/**
 * Paint shapes onto an RGBA buffer.
 *
 * `shapes` are drawn in order, each a set of contours and a colour. Alpha is
 * accumulated from the supersample count, so edges come out anti-aliased
 * rather than stepped.
 */
export function rasterise({ width, height, shapes, background = null, ss = 4 }) {
  const data = Buffer.alloc(width * height * 4);
  if (background) {
    const [r, g, b] = hex(background);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
  }

  for (const shape of shapes) {
    const [r, g, b] = hex(shape.color);
    const edges = edgesOf(shape.contours);
    if (edges.length === 0) continue;

    const cov = new Float32Array(width * height);
    const rows = height * ss;
    const weight = 1 / ss;
    const xs = [];

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const y = (rowIndex + 0.5) / ss;
      xs.length = 0;
      for (const [x0, y0, x1, y1] of edges) {
        if (y0 > y !== y1 > y) xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      const row = (rowIndex / ss) | 0;
      for (let k = 0; k + 1 < xs.length; k += 2) {
        addSpan(cov, width, row, xs[k], xs[k + 1], weight);
      }
    }

    for (let i = 0; i < cov.length; i++) {
      const a = cov[i] > 1 ? 1 : cov[i];
      if (a <= 0) continue;
      const p = i * 4;
      const dst = data[p + 3] / 255;
      const outA = a + dst * (1 - a);
      data[p] = Math.round((r * a + data[p] * dst * (1 - a)) / outA);
      data[p + 1] = Math.round((g * a + data[p + 1] * dst * (1 - a)) / outA);
      data[p + 2] = Math.round((b * a + data[p + 2] * dst * (1 - a)) / outA);
      data[p + 3] = Math.round(outA * 255);
    }
  }
  return data;
}

/* ---- PNG ------------------------------------------------------------------ */

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

export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const at = y * (width * 4 + 1);
    raw[at] = 0; // filter: none
    rgba.copy(raw, at + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** PNG-compressed ICO entries, which every browser and Windows Vista on read. */
export function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const dir = Buffer.alloc(16 * pngs.length);
  let offset = header.length + dir.length;
  pngs.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir[at] = size >= 256 ? 0 : size;
    dir[at + 1] = size >= 256 ? 0 : size;
    dir.writeUInt16LE(1, at + 4);
    dir.writeUInt16LE(32, at + 6);
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.png)]);
}
