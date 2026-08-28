import Link from "next/link";
import {
  BYLINE_PATH,
  LOGO,
  MARK_FILL_RULE,
  MARK_PATH,
  TILE,
  TILE_PATH,
  WORDMARK_PATH,
} from "@/lib/brand/logo";

/* The logo, as ONE piece of artwork.
 *
 * IT USED TO BE THREE THINGS STAPLED TOGETHER: an inline SVG for the mark and
 * wordmark, and "by DebugSwift" as a live HTML line underneath it. Owner's
 * call, 28 August 2026 — it looked bad, and it did. Live text beside outlined
 * type never quite agrees on weight, colour or baseline; it wraps on its own at
 * narrow widths; it shifts as the webfont loads; and the moment the logo leaves
 * the page as a file the byline is simply not in it. Now all four shapes come
 * from lib/brand/logo.ts and the whole lockup scales as one object.
 *
 * THE MARK IS NEVER SHOWN WITHOUT ITS TILE, also the owner's rule. There is no
 * bare-elbow asset and there should not be one: the elbow on its own is a
 * shape, the elbow in its rounded indigo square is the logo.
 *
 * WHY INLINE SVG AND NOT `<img>`. An image cannot take the page's colours, so a
 * logo shipped as a file needs a second file for dark mode and a swap between
 * them. Inlined, the two text paths read `--ds-accent` and `--ds-body`: one
 * asset, correct in both themes, correct at any zoom, no extra request. The
 * standalone files in public/brand still exist for everywhere the logo travels
 * without our stylesheet.
 *
 * The tile itself does NOT follow the theme, on purpose. An app icon does not
 * restyle to match what it is sitting on, and a fixed mark is more recognisable
 * than one that changes colour.
 *
 * One link, to home. The outbound DebugSwift link lives in SiteFooter — an
 * anchor inside an anchor is invalid, and the header logo's job is home.
 */

/* Rendered heights. Taller than the old single-line lockup because this one is
 * two lines: the byline is inside the artwork now, so the height that used to
 * cover just "DuctForge" has to cover the block. */
const HEIGHTS = { sm: 38, md: 50 } as const;

export default function Wordmark({ size = "md" }: { size?: keyof typeof HEIGHTS }) {
  const height = HEIGHTS[size];
  const width = Math.round((LOGO.width / LOGO.height) * height);
  const inner = LOGO.tileSize * (1 - TILE.inset * 2);
  const at = LOGO.tileSize * TILE.inset;

  return (
    <Link
      href="/"
      className="inline-flex shrink-0"
      aria-label="DuctForge by DebugSwift, home"
    >
      <svg
        viewBox={LOGO.viewBox}
        width={width}
        height={height}
        role="img"
        aria-hidden="true"
        focusable="false"
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
          transform={`translate(${at} ${at}) scale(${inner / 100})`}
        />
        <path
          d={WORDMARK_PATH}
          fill="var(--ds-accent)"
          transform={`translate(${LOGO.textX} ${LOGO.baseline})`}
        />
        <path
          d={BYLINE_PATH}
          fill="var(--ds-body)"
          transform={`translate(${LOGO.textX} ${LOGO.bylineBaseline})`}
        />
      </svg>
    </Link>
  );
}
