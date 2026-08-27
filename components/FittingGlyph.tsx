import type { FittingKind } from "@/lib/duct/types";

/* Marks for the fitting picker.
 *
 * Not miniatures of the real drawings: a 44px blueprint is unreadable, and a
 * scaled-down dimensioned view is worse than no picture at all. These are the
 * silhouette of each fitting and nothing else, single weight, currentColor.
 *
 * THE ROUND ONES ALL CARRY AN ELLIPSE, and that is the whole job. In a
 * side-on outline a round duct and a rectangular duct are the same pair of
 * parallel lines, a cone and a rectangular reducer are the same trapezoid —
 * the earlier round marks drew exactly those and were indistinguishable from
 * their rectangular neighbours. What separates them is the opening seen at an
 * angle, so every round mark shows one: a full ellipse at the near end, and
 * where it helps, a second at the far end.
 *
 * Drawn in a 44 × 28 box on a 1.5px stroke, matching the icon weight elsewhere.
 */
const PATHS: Record<FittingKind, string> = {
  /* Rectangular: two parallel walls and two square ends. */
  straight: "M4 8H40M4 20H40M4 8V20M40 8V20",
  /* Tapering walls, square ends — no ellipse, which is what tells it apart
   * from the round reducer below. */
  reducer: "M4 4L40 10M4 24L40 18M4 4V24M40 10V18",
  elbow: "M4 24V15A11 11 0 0 1 15 4H24M14 24V15A1 1 0 0 1 15 14H24",
  dropper: "M4 6H19L33 20H40M4 15H16L30 25H40",
  collar: "M15 24V7M29 24V7M9 24H15M29 24H35M15 7H29",
  wye: "M4 9H16L30 3H40M4 20H16L30 26H40M16 9L30 15H40",

  /* Round: parallel walls plus the bore, seen end-on. */
  "round-straight":
    "M9 7H35M9 21H35M9 14A4 7 0 0 0 9 14.01M35 14A4 7 0 1 0 35 13.99M9 7A4 7 0 0 0 9 21",
  /* A bend whose free end is an opening rather than a cut edge. */
  "round-elbow":
    "M5 25V15A11 11 0 0 1 16 4H26M13 25V15A3 3 0 0 1 16 12H26M26 4A2 4 0 1 1 26 12M5 25A4 1.5 0 0 0 13 25",
  /* A cone: an ellipse at each end, sized to its own diameter. */
  "round-reducer":
    "M8 5L34 11M8 23L34 17M8 14A3 9 0 0 0 8 14.01M8 5A3 9 0 0 0 8 23M34 14A2 3 0 1 0 34 13.99M34 11A2 3 0 0 0 34 17",
  /* Square one end, round the other — the mark has to show both or it is just
   * another reducer. */
  "square-to-round":
    "M5 4V24M5 4H10M5 24H10M10 4L32 10M10 24L32 18M32 14A2 4 0 1 0 32 13.99M32 10A2 4 0 0 0 32 18",
};

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
      <path d={PATHS[kind]} />
    </svg>
  );
}
