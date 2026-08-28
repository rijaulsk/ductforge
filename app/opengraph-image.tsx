import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  BYLINE_PATH,
  LOGO,
  MARK_FILL_RULE,
  MARK_PATH,
  TILE,
  TILE_PATH,
  WORDMARK_PATH,
} from "@/lib/brand/logo";

/* The card a shared link unfurls into.
 *
 * IT IS IN SATOSHI NOW, and for a while it was not. Satori — what `next/og`
 * uses — reads ttf, otf and woff but not woff2, and woff2 was the only Satoshi
 * in this repo, so every word on this card was rendering in whatever sans the
 * renderer fell back to. A brand asset in the wrong typeface is worse than no
 * brand asset, and it was invisible because nobody looks at their own OG card.
 *
 * assets/fonts/Satoshi-Bold.ttf is build input only: it is read here, at build
 * time, and never served. Browsers still get the woff2, which is a third the
 * size.
 *
 * Everything below is a token from app/globals.css.
 */

export const alt = "DuctForge — HVAC duct takeoff and surface area calculator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#221D17";
const CREAM = "#F7F3EB";
const INDIGO = "#6467F2";
const INDIGO_600 = "#5251DA";
const SLATE = "#5E5A53";
/** Height of the logo lockup in the card's masthead. */
const LOCKUP_PX = 84;

export default async function OpengraphImage() {
  const satoshi = await readFile(join(process.cwd(), "assets/fonts/Satoshi-Bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: CREAM,
          padding: 64,
          fontFamily: "Satoshi",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            border: `3px solid ${INK}`,
            borderRadius: 24,
            background: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          {/* Left: identity */}
          <div
            style={{
              flex: 1.15,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 56,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* THE WHOLE LOCKUP AS ARTWORK, not a rebuild of it.
                  This used to be a hand-assembled tile with its own hard-coded
                  radius and inset, a stale copy of the mark path, and the name
                  set as live text. Three chances to drift, all three taken. */}
              <svg
                width={Math.round((LOGO.width / LOGO.height) * LOCKUP_PX)}
                height={LOCKUP_PX}
                viewBox={LOGO.viewBox}
              >
                <path
                  d={TILE_PATH}
                  fill={TILE.ground}
                  transform={`scale(${LOGO.tileSize / 100})`}
                />
                <path
                  d={MARK_PATH}
                  fill={TILE.mark}
                  fillRule={MARK_FILL_RULE}
                  transform={`translate(${LOGO.tileSize * TILE.inset} ${LOGO.tileSize * TILE.inset}) scale(${(LOGO.tileSize * (1 - TILE.inset * 2)) / 100})`}
                />
                <path
                  d={WORDMARK_PATH}
                  fill={INK}
                  transform={`translate(${LOGO.textX} ${LOGO.baseline})`}
                />
                <path
                  d={BYLINE_PATH}
                  fill={SLATE}
                  transform={`translate(${LOGO.textX} ${LOGO.bylineBaseline})`}
                />
              </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 40, lineHeight: 1.2, color: INK }}>
                Duct surface area, sheet weight and gauge.
              </div>
              <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, color: SLATE }}>
                Ten fittings, measured to the billing standard or the true shop flat pattern.
                Metric or imperial.
              </div>
            </div>

            {/* Sized to fit the column. At 22px with 20px of padding these ran
              * past the panel edge and the last one was cut in half — satori
              * does not wrap a flex row, it just overflows. */}
            <div style={{ display: "flex", gap: 10 }}>
              {["m² and kg", "SMACNA gauge", "CSV and BOQ"].map((t) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    border: `2px solid ${INK}`,
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontSize: 18,
                    color: INK,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right: the thing it draws */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: CREAM,
              borderLeft: `3px solid ${INK}`,
            }}
          >
            {/* An elbow in plan: the SAME construction the app draws — an
                annular band between a throat radius and a heel radius, with
                two straight legs, a dash-dot centreline and dimension
                brackets. The previous path was a hand-drawn approximation and
                came out as a wedge, which is not a fitting. */}
            <svg width="360" height="360" viewBox="0 0 200 200">
              <path
                d="M40 190 L40 150 A110 110 0 0 1 150 40 L190 40 L190 110 L150 110 A40 40 0 0 0 110 150 L110 190 Z"
                fill="none"
                stroke={INK}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <path
                d="M75 190 L75 150 A75 75 0 0 1 150 75 L190 75"
                fill="none"
                stroke={INDIGO_600}
                strokeWidth="2"
                strokeDasharray="14 5 3 5"
              />
              {/* W across the inlet, and the throat radius from the centre. */}
              <path
                d="M40 196 L40 204 M110 196 L110 204 M40 200 L110 200"
                stroke={INDIGO_600}
                strokeWidth="2"
                fill="none"
              />
              <path d="M150 150 L114 114" stroke={INDIGO_600} strokeWidth="2" fill="none" />
              <circle cx="150" cy="150" r="4" fill={INDIGO} />
            </svg>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Satoshi", data: satoshi, weight: 700, style: "normal" }],
    },
  );
}
