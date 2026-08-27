/* Crop and magnify a region of a PNG. `node scripts/crop.mjs in.png x y w h [zoom]`
 *
 * WHY THIS EXISTS. A reference sheet arrives as one big image, and the detail
 * that matters — how a corner is mitred, whether a flange is attached, what a
 * cut mark actually looks like — is two hundred pixels in the corner of it.
 * Looking at the whole sheet scaled down is how you miss things, and I did.
 *
 * Decoder is deliberately minimal: 8-bit greyscale, RGB, RGBA and palette, no
 * interlace. That is what every export from a design tool produces. It refuses
 * anything else rather than guessing.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { encodePng } from "./raster.mjs";

const BPP = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");

  let at = 8;
  let ihdr = null;
  let palette = null;
  let trns = null;
  const idat = [];

  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString("ascii", at + 4, at + 8);
    const data = buffer.subarray(at + 8, at + 8 + length);
    at += 12 + length;

    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colour: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }

  if (!ihdr) throw new Error("no IHDR");
  if (ihdr.depth !== 8) throw new Error(`bit depth ${ihdr.depth} not supported`);
  if (ihdr.interlace !== 0) throw new Error("interlaced PNG not supported");
  const channels = BPP[ihdr.colour];
  if (!channels) throw new Error(`colour type ${ihdr.colour} not supported`);

  const { width, height } = ihdr;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);

  /* Undo the per-scanline filter. Each row names its own filter and refers to
   * the row above, so this cannot be done out of order or in parallel. */
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = y * stride;
    const prev = row - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const a = i >= channels ? pixels[row + i - channels] : 0;
      const b = y > 0 ? pixels[prev + i] : 0;
      const c = i >= channels && y > 0 ? pixels[prev + i - channels] : 0;
      let value;
      if (filter === 0) value = x;
      else if (filter === 1) value = x + a;
      else if (filter === 2) value = x + b;
      else if (filter === 3) value = x + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`unknown filter ${filter}`);
      pixels[row + i] = value & 0xff;
    }
    src += stride;
  }

  /* Everything out as RGBA, so callers have one shape to deal with. */
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r;
    let g;
    let b;
    let a = 255;
    if (ihdr.colour === 0) {
      r = g = b = pixels[i];
    } else if (ihdr.colour === 4) {
      r = g = b = pixels[i * 2];
      a = pixels[i * 2 + 1];
    } else if (ihdr.colour === 2) {
      r = pixels[i * 3];
      g = pixels[i * 3 + 1];
      b = pixels[i * 3 + 2];
    } else if (ihdr.colour === 6) {
      r = pixels[i * 4];
      g = pixels[i * 4 + 1];
      b = pixels[i * 4 + 2];
      a = pixels[i * 4 + 3];
    } else {
      const idx = pixels[i];
      r = palette[idx * 3];
      g = palette[idx * 3 + 1];
      b = palette[idx * 3 + 2];
      if (trns && idx < trns.length) a = trns[idx];
    }
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }

  return { width, height, rgba };
}

/** Crop, then magnify by an integer factor with no smoothing. */
export function cropZoom(src, { x, y, w, h, zoom = 1 }) {
  const out = Buffer.alloc(w * zoom * h * zoom * 4);
  for (let oy = 0; oy < h * zoom; oy++) {
    const sy = Math.min(src.height - 1, y + Math.floor(oy / zoom));
    for (let ox = 0; ox < w * zoom; ox++) {
      const sx = Math.min(src.width - 1, x + Math.floor(ox / zoom));
      const from = (sy * src.width + sx) * 4;
      src.rgba.copy(out, (oy * w * zoom + ox) * 4, from, from + 4);
    }
  }
  return { width: w * zoom, height: h * zoom, rgba: out };
}

if (process.argv[2]) {
  const [file, x, y, w, h, zoom = "1"] = process.argv.slice(2);
  const src = decodePng(readFileSync(file));
  if (x === undefined) {
    console.log(`${file}  ${src.width} × ${src.height}`);
  } else {
    const cut = cropZoom(src, {
      x: +x,
      y: +y,
      w: +w,
      h: +h,
      zoom: +zoom,
    });
    const name = `preview/crop-${x}-${y}-${w}x${h}.png`;
    writeFileSync(new URL(`../${name}`, import.meta.url), encodePng(cut.width, cut.height, cut.rgba));
    console.log(`${name}  ${cut.width} × ${cut.height}  (from ${src.width} × ${src.height})`);
  }
}
