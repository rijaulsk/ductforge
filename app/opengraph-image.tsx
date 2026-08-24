import { ImageResponse } from "next/og";

/* The card a shared link unfurls into.
 *
 * Deliberately mostly GEOMETRY rather than type. Satori — what `next/og` uses —
 * can only embed ttf, otf or woff, and the only Satoshi file in this repo is a
 * woff2, so custom text here would render in a system sans and read as a
 * different brand. A drawing does not have that problem, and a drawing is what
 * this tool actually makes.
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

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: CREAM,
          padding: 64,
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
              <div
                style={{
                  width: 64,
                  height: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: INDIGO,
                  borderRadius: 14,
                }}
              >
                <svg width="44" height="44" viewBox="0 0 32 32">
                  <path
                    d="M9 25V16a7 7 0 0 1 7-7h9"
                    fill="none"
                    stroke={CREAM}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: INK }}>
                DuctForge
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 40, lineHeight: 1.2, color: INK }}>
                Duct surface area, sheet weight and gauge.
              </div>
              <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, color: SLATE }}>
                Nine fittings, measured to the billing standard or the true shop flat pattern.
                Metric or imperial.
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              {["m² and kg", "SMACNA gauge", "CSV and BOQ"].map((t) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    border: `2px solid ${INK}`,
                    borderRadius: 999,
                    padding: "8px 20px",
                    fontSize: 22,
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
            <svg width="380" height="380" viewBox="0 0 200 200">
              {/* An elbow in plan, with its throat radius and angle called out —
                  the same drawing the app puts on screen. */}
              <path
                d="M40 170 V95 A55 55 0 0 1 95 40 H170 V95 A110 110 0 0 0 95 170 Z"
                fill="none"
                stroke={INK}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <path
                d="M40 170 V132 A92 92 0 0 1 132 40 H170"
                fill="none"
                stroke={INDIGO_600}
                strokeWidth="2"
                strokeDasharray="12 5 3 5"
              />
              <path d="M22 170 H32 M22 95 H32 M22 95 V170" stroke={INDIGO_600} strokeWidth="2" fill="none" />
              <path d="M95 22 V32 M170 22 V32 M95 22 H170" stroke={INDIGO_600} strokeWidth="2" fill="none" />
              <circle cx="40" cy="40" r="4" fill={INDIGO} />
            </svg>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
