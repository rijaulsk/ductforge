import { GLYPH_PATHS } from "@/lib/duct/glyphs";
import type { FittingKind } from "@/lib/duct/types";

/* Marks for the fitting picker.
 *
 * Not miniatures of the real drawings: a 44px blueprint is unreadable, and a
 * scaled-down dimensioned view is worse than no picture at all. These are the
 * silhouette of each fitting and nothing else, single weight, currentColor.
 *
 * The paths live in lib/duct/glyphs.ts so `node scripts/preview.mjs glyphs`
 * can render them and they can be looked at — which is how the stray dot and
 * the gap in the round marks were found, neither being visible in the numbers.
 */
export default function FittingGlyph({
  kind,
  className,
}: {
  kind: FittingKind;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 44 28"
      width={44}
      height={28}
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={GLYPH_PATHS[kind]} />
    </svg>
  );
}
