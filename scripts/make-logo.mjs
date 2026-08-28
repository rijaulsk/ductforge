/* Logo generation. Run with `npm run logo` after changing the mark or wordmark.
 *
 * WHY THIS PARSES A FONT INSTEAD OF SETTING TYPE.
 *
 * A logo is an asset, not a styled string. Rendering "DuctForge" as live text
 * makes it depend on Satoshi being loaded — fine inside our own page, useless
 * in an <img>, an OG card, a README or anywhere else the file travels, where it
 * silently falls back to whatever sans the reader has. DebugSwift's own logo
 * SVG has exactly this problem: it carries `font-family:Satoshi` and renders in
 * a fallback face wherever Satoshi is absent.
 *
 * So the wordmark is OUTLINED here, once, from Satoshi Bold's TrueType glyf
 * table: cmap for the character-to-glyph map, loca for where each glyph lives,
 * glyf for its contours, hmtx for how far to advance. The output is plain SVG
 * paths that need no font at all and are identical everywhere.
 *
 * The TTF lives in assets/ and is BUILD INPUT ONLY — it is never served. The
 * browser still gets the woff2 in public/fonts, which is a third the size.
 *
 * Everything this writes is checked in. The build never runs it.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bounds, encodePng, parsePath, rasterise, transform } from "./raster.mjs";

const ROOT = new URL("../", import.meta.url);
const out = (p) => fileURLToPath(new URL(p, ROOT));

import {
  CREAM,
  INDIGO,
  MARK_FILL_RULE,
  MARK_PATH,
  BYLINE_DARK,
  BYLINE_LIGHT,
  TILE_INSET,
  TILE_RADIUS,
  WORD_DARK,
  WORD_LIGHT,
  roundedRect,
} from "./mark.mjs";

/* ---- the smallest TrueType reader that can outline a word ---------------- */

class Reader {
  constructor(buf) {
    this.b = buf;
  }
  u8(p) {
    return this.b[p];
  }
  u16(p) {
    return (this.b[p] << 8) | this.b[p + 1];
  }
  i16(p) {
    const v = this.u16(p);
    return v & 0x8000 ? v - 0x10000 : v;
  }
  u32(p) {
    return (
      ((this.b[p] << 24) | (this.b[p + 1] << 16) | (this.b[p + 2] << 8) | this.b[p + 3]) >>> 0
    );
  }
  tag(p) {
    return String.fromCharCode(this.b[p], this.b[p + 1], this.b[p + 2], this.b[p + 3]);
  }
}

function openFont(path) {
  const r = new Reader(readFileSync(path));
  const numTables = r.u16(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const p = 12 + i * 16;
    tables[r.tag(p)] = { off: r.u32(p + 8), len: r.u32(p + 12) };
  }
  for (const need of ["head", "maxp", "cmap", "loca", "glyf", "hmtx", "hhea"]) {
    if (!tables[need]) throw new Error(`font is missing the ${need} table`);
  }

  const unitsPerEm = r.u16(tables.head.off + 18);
  const indexToLocFormat = r.i16(tables.head.off + 50);
  const numGlyphs = r.u16(tables.maxp.off + 4);
  const numberOfHMetrics = r.u16(tables.hhea.off + 34);

  /* cmap: the Windows Unicode BMP subtable, format 4. */
  const cmapOff = tables.cmap.off;
  let sub = 0;
  const numSub = r.u16(cmapOff + 2);
  for (let i = 0; i < numSub; i++) {
    const p = cmapOff + 4 + i * 8;
    const platform = r.u16(p);
    const encoding = r.u16(p + 2);
    if ((platform === 3 && (encoding === 1 || encoding === 10)) || platform === 0) {
      sub = cmapOff + r.u32(p + 4);
    }
  }
  if (!sub || r.u16(sub) !== 4) throw new Error("no format 4 cmap subtable");

  const segCount = r.u16(sub + 6) / 2;
  const endP = sub + 14;
  const startP = endP + segCount * 2 + 2;
  const deltaP = startP + segCount * 2;
  const rangeP = deltaP + segCount * 2;

  const glyphFor = (code) => {
    for (let s = 0; s < segCount; s++) {
      if (code > r.u16(endP + s * 2)) continue;
      const start = r.u16(startP + s * 2);
      if (code < start) return 0;
      const rangeOffset = r.u16(rangeP + s * 2);
      const delta = r.i16(deltaP + s * 2);
      if (rangeOffset === 0) return (code + delta) & 0xffff;
      const gp = rangeP + s * 2 + rangeOffset + (code - start) * 2;
      const g = r.u16(gp);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };

  const locaOff = tables.loca.off;
  const glyphRange = (id) =>
    indexToLocFormat === 0
      ? [r.u16(locaOff + id * 2) * 2, r.u16(locaOff + id * 2 + 2) * 2]
      : [r.u32(locaOff + id * 4), r.u32(locaOff + id * 4 + 4)];

  const advanceFor = (id) => {
    const i = Math.min(id, numberOfHMetrics - 1);
    return r.u16(tables.hmtx.off + i * 4);
  };

  /** Contours of one glyph, in font units, y up. */
  function contoursFor(id, depth = 0) {
    const [from, to] = glyphRange(id);
    if (from === to || depth > 4) return [];
    const g = tables.glyf.off + from;
    const numContours = r.i16(g);

    if (numContours < 0) {
      /* Composite: components placed by offset. Satoshi's Latin letters are
       * simple glyphs, so this path is a safety net rather than a hot one —
       * scaled components are not handled and would be visibly wrong, which is
       * why it throws rather than guessing. */
      const parts = [];
      let p = g + 10;
      for (;;) {
        const flags = r.u16(p);
        const glyphIndex = r.u16(p + 2);
        p += 4;
        let dx;
        let dy;
        if (flags & 1) {
          dx = r.i16(p);
          dy = r.i16(p + 2);
          p += 4;
        } else {
          dx = (r.u8(p) << 24) >> 24;
          dy = (r.u8(p + 1) << 24) >> 24;
          p += 2;
        }
        if (flags & 0x08) p += 2;
        else if (flags & 0x40) p += 4;
        else if (flags & 0x80) throw new Error("composite glyph with a 2×2 transform");
        for (const c of contoursFor(glyphIndex, depth + 1)) {
          parts.push(c.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })));
        }
        if (!(flags & 0x20)) break;
      }
      return parts;
    }

    const ends = [];
    for (let i = 0; i < numContours; i++) ends.push(r.u16(g + 10 + i * 2));
    const numPoints = ends[ends.length - 1] + 1;
    let p = g + 10 + numContours * 2;
    p += 2 + r.u16(p); // instructions

    const flags = [];
    while (flags.length < numPoints) {
      const f = r.u8(p++);
      flags.push(f);
      if (f & 8) {
        let repeat = r.u8(p++);
        while (repeat-- > 0) flags.push(f);
      }
    }

    const xs = [];
    let x = 0;
    for (const f of flags) {
      if (f & 2) {
        const d = r.u8(p++);
        x += f & 16 ? d : -d;
      } else if (!(f & 16)) {
        x += r.i16(p);
        p += 2;
      }
      xs.push(x);
    }

    const ys = [];
    let y = 0;
    for (const f of flags) {
      if (f & 4) {
        const d = r.u8(p++);
        y += f & 32 ? d : -d;
      } else if (!(f & 32)) {
        y += r.i16(p);
        p += 2;
      }
      ys.push(y);
    }

    const contours = [];
    let start = 0;
    for (const end of ends) {
      const pts = [];
      for (let i = start; i <= end; i++) {
        pts.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) === 1 });
      }
      contours.push(pts);
      start = end + 1;
    }
    return contours;
  }

  return { unitsPerEm, numGlyphs, glyphFor, advanceFor, contoursFor };
}

/**
 * Contours to an SVG path.
 *
 * TrueType curves are quadratic, and two consecutive off-curve points imply an
 * on-curve point at their midpoint — the format leaves it out to save bytes.
 * Missing that rule is what turns an outlined letter into a spiky mess, so it
 * is handled explicitly rather than by assuming every other point is on-curve.
 */
function contoursToPath(contours, scale, dx, dy, round = 2) {
  const n = (v) => Number(v.toFixed(round));
  const X = (p) => n(dx + p.x * scale);
  /* Font Y is up, SVG Y is down. */
  const Y = (p) => n(dy - p.y * scale);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });

  const parts = [];
  for (const raw of contours) {
    if (raw.length === 0) continue;
    /* Rotate so the contour starts on-curve; if none is, start at a midpoint. */
    let pts = raw;
    const firstOn = raw.findIndex((p) => p.on);
    if (firstOn > 0) pts = [...raw.slice(firstOn), ...raw.slice(0, firstOn)];
    else if (firstOn === -1) pts = [mid(raw[raw.length - 1], raw[0]), ...raw];

    let d = `M${X(pts[0])} ${Y(pts[0])}`;
    let i = 1;
    while (i <= pts.length) {
      const cur = pts[i % pts.length];
      if (cur.on) {
        d += `L${X(cur)} ${Y(cur)}`;
        i += 1;
        continue;
      }
      const next = pts[(i + 1) % pts.length];
      const end = next.on ? next : mid(cur, next);
      d += `Q${X(cur)} ${Y(cur)} ${X(end)} ${Y(end)}`;
      i += next.on ? 2 : 1;
    }
    parts.push(`${d}Z`);
  }
  return parts.join("");
}

/** Outline a word into one path, and report how wide it came out. */
function outline(font, text, size) {
  const scale = size / font.unitsPerEm;
  let pen = 0;
  const parts = [];
  for (const ch of text) {
    const id = font.glyphFor(ch.codePointAt(0));
    const contours = font.contoursFor(id);
    if (contours.length) parts.push(contoursToPath(contours, scale, pen, 0));
    pen += font.advanceFor(id) * scale;
  }
  return { d: parts.join(""), width: Number(pen.toFixed(2)) };
}

/* ---- the mark ------------------------------------------------------------
 *
 * A duct elbow drawn as a BAND — an outer arc, an inner arc and two square
 * legs — rather than as a single stroked line. The stroked version read as a
 * lowercase "r" at any size above a favicon, which is a poor thing for a duct
 * calculator's mark to look like. A band with a bore through it reads as a
 * section of ductwork, which is the point.
 *
 * Drawn in a 100 unit box so it can be placed at any size.
 */
/* The mark itself lives in scripts/mark.mjs, shared with the icon generator. */

/* ---- compose -------------------------------------------------------------- */

/* THE LOCKUP IS THREE PARTS, AND THE BYLINE IS ONE OF THEM.
 *
 * "by DebugSwift" used to be an HTML line rendered underneath the SVG. Owner's
 * call, 28 August 2026: it looked bad, and it did — live text beside outlined
 * type never quite agrees on weight, colour or baseline, it reflows on its own
 * at small widths, and it is absent the moment the logo leaves the page as a
 * file. It is artwork now, outlined from Satoshi Medium the same way the
 * wordmark is outlined from Satoshi Bold, so the whole logo is one object.
 *
 * THE MARK IS ALWAYS ON ITS TILE. Also the owner's call: no bare-elbow asset
 * exists any more. What sits to the left of the type is the app icon.
 */

const bold = openFont(out("assets/fonts/Satoshi-Bold.ttf"));
const medium = openFont(out("assets/fonts/Satoshi-Medium.ttf"));

/** Cap height of a font at size 100 — what the two weights are locked by. */
const capOf = (f) => {
  const contours = f.contoursFor(f.glyphFor("D".codePointAt(0)));
  return (Math.max(...contours.flat().map((p) => p.y)) / f.unitsPerEm) * 100;
};

const CAP = 72;
const capHeight = capOf(bold);
const wordSized = outline(bold, "DuctForge", 100 * (CAP / capHeight));

/* The byline, at 36% of the wordmark's cap — measured off logo4, where it is
 * small enough to read as attribution and big enough to be read. */
const BYLINE_CAP = Number((CAP * 0.36).toFixed(2));
const bylineSized = outline(medium, "by DebugSwift", 100 * (BYLINE_CAP / capOf(medium)));

/* Vertical rhythm. The wordmark sits on a baseline at y = CAP, so its cap top
 * is y = 0. The byline's own cap top clears that baseline by its own height —
 * a leading equal to the smaller text's cap is the standard two-line lockup
 * and needs no eyeballing. */
const baseline = CAP;
const bylineBaseline = Number((baseline + BYLINE_CAP * 2).toFixed(2));

/* THE TILE SPANS THE WHOLE TEXT BLOCK, cap top to byline baseline. A square
 * icon shorter than the text it is locked to reads as an afterthought; one
 * taller than it reads as the logo with a caption. Matching the block is the
 * only ratio that needs no defending. */
const tileSize = bylineBaseline;
const gap = Number((CAP * 0.34).toFixed(2));
const textX = Number((tileSize + gap).toFixed(2));

/* THE CANVAS COMES FROM THE ARTWORK, not the other way round.
 *
 * Sizing the box to the cap height cropped the descender off the g — the
 * wordmark sits on a baseline and "Forge" goes below it, which a box that
 * stops at the baseline has no room for. Measuring what the paths actually
 * occupy and padding that is the only way a logo cannot clip itself, and it
 * survives changing the word, the byline or the mark. */
const tilePlaced = transform(parsePath(roundedRect(100, TILE_RADIUS * 100)), {
  sx: tileSize / 100,
});
const markInTile = transform(parsePath(MARK_PATH), {
  sx: (tileSize * (1 - (TILE_INSET / 100) * 2)) / 100,
  tx: (tileSize * TILE_INSET) / 100,
  ty: (tileSize * TILE_INSET) / 100,
});
const wordPlaced = transform(parsePath(wordSized.d), { sx: 1, tx: textX, ty: baseline });
const bylinePlaced = transform(parsePath(bylineSized.d), {
  sx: 1,
  tx: textX,
  ty: bylineBaseline,
});

const box = bounds([...tilePlaced, ...wordPlaced, ...bylinePlaced]);
const PAD = CAP * 0.08;
const viewX = Number((box.minX - PAD).toFixed(2));
const viewY = Number((box.minY - PAD).toFixed(2));
const totalW = Number((box.width + PAD * 2).toFixed(2));
const totalH = Number((box.height + PAD * 2).toFixed(2));

/** The tile, at any size: indigo ground, cream elbow inset inside it. */
function tileMarkup(size, indent = "  ") {
  const inner = size * (1 - (TILE_INSET / 100) * 2);
  const at = (size * TILE_INSET) / 100;
  return [
    `${indent}<path d="${roundedRect(size, size * TILE_RADIUS)}" fill="${INDIGO}"/>`,
    `${indent}<path d="${MARK_PATH}" fill="${CREAM}" fill-rule="${MARK_FILL_RULE}" transform="translate(${at.toFixed(3)} ${at.toFixed(3)}) scale(${(inner / 100).toFixed(5)})"/>`,
  ].join("\n");
}

/* The tile is the SAME in both, and deliberately so: an app icon does not
 * change colour with the page it is on, and the identity is more recognisable
 * for being fixed. Only the type follows the theme. */
function lockup(wordFill, bylineFill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewX} ${viewY} ${totalW} ${totalH}" width="${totalW}" height="${totalH}" role="img" aria-label="DuctForge by DebugSwift">
  <title>DuctForge by DebugSwift</title>
${tileMarkup(tileSize)}
  <path d="${wordSized.d}" fill="${wordFill}" transform="translate(${textX} ${baseline})"/>
  <path d="${bylineSized.d}" fill="${bylineFill}" transform="translate(${textX} ${bylineBaseline})"/>
</svg>
`;
}

mkdirSync(out("public/brand"), { recursive: true });
mkdirSync(out("lib/brand"), { recursive: true });

/* Standalone files, for anywhere the logo travels without our stylesheet. */
writeFileSync(out("public/brand/ductforge.svg"), lockup(WORD_LIGHT, BYLINE_LIGHT));
writeFileSync(out("public/brand/ductforge-dark.svg"), lockup(WORD_DARK, BYLINE_DARK));

/* The icon on its own — still the tile, never the bare elbow. There used to be
 * a `ductforge-icon.svg` carrying the elbow with no ground; it is deleted, and
 * a replacement should not be added. The mark alone is a shape, the mark in
 * its square is the logo. */
writeFileSync(
  out("public/brand/ductforge-tile.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="DuctForge">
  <title>DuctForge</title>
${tileMarkup(100)}
</svg>
`,
);
rmSync(out("public/brand/ductforge-icon.svg"), { force: true });

/* And the same geometry as data, so the app can inline it and let it take the
 * page's own colours instead of shipping two files and swapping them. */
writeFileSync(
  out("lib/brand/logo.ts"),
  `/* GENERATED by scripts/make-logo.mjs — do not edit by hand.
 *
 * The wordmark is Satoshi Bold and the byline Satoshi Medium, both OUTLINED.
 * They are path data rather than text so they render identically with no font
 * loaded, and they are inlined rather than served as images so the type can
 * take the page's own token colours and follow the theme.
 *
 * THE BYLINE IS PART OF THE LOGO. It used to be an HTML line under the SVG and
 * it looked it — live text beside outlined type never quite agrees on weight,
 * colour or baseline, and it vanished the moment the logo left the page as a
 * file. Do not pull it back out into markup.
 *
 * THE MARK IS NEVER DRAWN WITHOUT ITS TILE. Use \`Lockup\` or \`TileMark\`;
 * MARK_PATH is exported for those two and for the generators, not so that a
 * bare elbow can be dropped somewhere new.
 */

/** The elbow, in a 100 × 100 box. Always drawn inside \`TILE\`. */
export const MARK_PATH =
  ${JSON.stringify(MARK_PATH)};

/** Pass to \`fillRule\` / \`fill-rule\` wherever MARK_PATH is drawn. */
export const MARK_FILL_RULE = ${JSON.stringify(MARK_FILL_RULE)} as const;

/** The tile's rounded square, in the same 100 × 100 box as MARK_PATH. */
export const TILE_PATH =
  ${JSON.stringify(roundedRect(100, TILE_RADIUS * 100))};

/** The tile the mark always sits on. */
export const TILE = {
  /** Corner radius, as a fraction of the tile's side. */
  radius: ${TILE_RADIUS},
  /** Inset of the mark inside the tile, as a fraction of the side. */
  inset: ${TILE_INSET / 100},
  /** The indigo ground. Fixed in both themes — an app icon does not restyle. */
  ground: ${JSON.stringify(INDIGO)},
  /** The elbow's colour on that ground. */
  mark: ${JSON.stringify(CREAM)},
} as const;

/** "DuctForge" outlined, sitting on a baseline at y = 0. */
export const WORDMARK_PATH =
  ${JSON.stringify(wordSized.d)};

/** "by DebugSwift" outlined, sitting on a baseline at y = 0. */
export const BYLINE_PATH =
  ${JSON.stringify(bylineSized.d)};

export const LOGO = {
  /** Side of the tile. Spans the whole text block, cap top to byline baseline. */
  tileSize: ${tileSize},
  /** Cap height of the wordmark. */
  cap: ${CAP},
  /** Cap height of the byline. */
  bylineCap: ${BYLINE_CAP},
  gap: ${gap},
  /** Where both text paths start, to the right of the tile. */
  textX: ${textX},
  /** Where the wordmark's baseline sits, in the same coordinates. */
  baseline: ${baseline},
  /** Where the byline's baseline sits. */
  bylineBaseline: ${bylineBaseline},
  /** The viewBox that contains the whole lockup, descenders included. */
  viewBox: "${viewX} ${viewY} ${totalW} ${totalH}",
  width: ${totalW},
  height: ${totalH},
} as const;
`,
);

/* ---- raster ---------------------------------------------------------------
 *
 * PNGs as well as SVGs, because plenty of places still will not take a vector:
 * an email signature, a supplier's portal, a slide. Same geometry, rasterised
 * here rather than exported from a design tool, so they cannot drift apart. */

/** The same placement the SVG uses, scaled onto a pixel canvas. */
function logoPng(height, wordFill, bylineFill, background) {
  const s = height / totalH;
  const width = Math.round(totalW * s);
  const h = Math.round(totalH * s);
  const place = (contours) => transform(contours, { sx: s, tx: -viewX * s, ty: -viewY * s });
  return encodePng(
    width,
    h,
    rasterise({
      width,
      height: h,
      background,
      /* evenodd stated rather than relied on. The rasteriser happens to
       * default to it, and a default is a poor place to keep anything that
       * could ever become load-bearing. */
      shapes: [
        { contours: place(tilePlaced), color: INDIGO, rule: "evenodd" },
        { contours: place(markInTile), color: CREAM, rule: "evenodd" },
        { contours: place(wordPlaced), color: wordFill, rule: "evenodd" },
        { contours: place(bylinePlaced), color: bylineFill, rule: "evenodd" },
      ],
    }),
  );
}

/** The tile alone, square. Never the bare elbow — see the header comment. */
function tilePng(size) {
  const inner = size * (1 - (TILE_INSET / 100) * 2);
  const at = (size * TILE_INSET) / 100;
  return encodePng(
    size,
    size,
    rasterise({
      width: size,
      height: size,
      shapes: [
        {
          contours: transform(parsePath(roundedRect(100, TILE_RADIUS * 100)), { sx: size / 100 }),
          color: INDIGO,
          rule: "evenodd",
        },
        {
          contours: transform(parsePath(MARK_PATH), { sx: inner / 100, tx: at, ty: at }),
          color: CREAM,
          rule: "evenodd",
        },
      ],
    }),
  );
}

const rasters = [
  ["public/brand/ductforge-160.png", logoPng(160, WORD_LIGHT, BYLINE_LIGHT, null)],
  ["public/brand/ductforge-320.png", logoPng(320, WORD_LIGHT, BYLINE_LIGHT, null)],
  ["public/brand/ductforge-dark-320.png", logoPng(320, WORD_DARK, BYLINE_DARK, null)],
  ["public/brand/ductforge-tile-512.png", tilePng(512)],
];
rmSync(out("public/brand/ductforge-icon-512.png"), { force: true });
for (const [path, buf] of rasters) {
  writeFileSync(out(path), buf);
  console.log(`wrote           ${path}  ${buf.length} bytes`);
}

console.log(`tile            ${tileSize} square (radius ${TILE_RADIUS}, inset ${TILE_INSET})`);
console.log(`wordmark        ${wordSized.width} wide, cap ${CAP} (font cap ${capHeight.toFixed(1)})`);
console.log(`byline          ${bylineSized.width} wide, cap ${BYLINE_CAP}`);
console.log(`lockup          ${totalW} × ${totalH}`);
for (const f of [
  "public/brand/ductforge.svg",
  "public/brand/ductforge-dark.svg",
  "public/brand/ductforge-tile.svg",
  "lib/brand/logo.ts",
]) {
  console.log(`wrote           ${f}`);
}
