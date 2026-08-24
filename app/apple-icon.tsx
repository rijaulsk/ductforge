import { ImageResponse } from "next/og";

/* The home-screen icon, generated at build time from the same two tokens as
 * app/icon.svg. `next/og` ships with Next, so this costs no dependency.
 *
 * Apple's icon is composited on an opaque tile and gets its own rounded
 * corners from iOS, so this one fills the square rather than rounding itself. */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#6467F2",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path
            d="M9 25V16a7 7 0 0 1 7-7h9"
            fill="none"
            stroke="#F7F3EB"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
