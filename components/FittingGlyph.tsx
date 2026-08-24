import type { FittingKind } from "@/lib/duct/types";

/* Twelve-o'clock-simple marks for the type picker.
 *
 * Not miniatures of the real drawings: a 44 px blueprint is unreadable, and a
 * scaled-down dimensioned view is worse than no picture at all. These are the
 * silhouette of each fitting and nothing else, single weight, currentColor —
 * so they take the button's own text colour in both themes and both states.
 */
const PATHS: Record<FittingKind, string> = {
  straight: "M3 8 H41 M3 20 H41 M3 8 V20 M41 8 V20",
  reducer: "M3 5 H41 M3 23 H41 M3 5 V23 M41 5 V23",
  elbow: "M3 24 V14 A11 11 0 0 1 14 3 H24 M13 24 V14 A1 1 0 0 1 14 13 H24",
  dropper: "M3 6 H20 L34 20 H41 M3 15 H16 L30 25 H41",
  collar: "M14 24 V6 M30 24 V6 M8 24 H14 M30 24 H36 M14 6 H30",
  wye: "M3 9 H16 L30 3 H41 M3 20 H16 L30 26 H41 M16 9 L30 15 H41",
  /* The round marks all carry an end ellipse — that is the only thing telling
   * a reader at 44px that this is round rather than rectangular. */
  "round-straight": "M3 8 H34 M3 20 H34 M34 14 a4 6 0 1 0 0.01 0 M3 14 a4 6 0 1 0 0.01 0",
  "round-elbow": "M3 24 V14 A11 11 0 0 1 14 3 H24 M13 24 V14 A1 1 0 0 1 14 13 H24 M24 3 a2 5 0 1 0 0.01 0 M3 24 a5 2 0 1 0 0 0.01",
  "round-reducer": "M4 5 L34 11 M4 23 L34 17 M4 14 a3 9 0 1 0 0.01 0 M34 14 a2 3 0 1 0 0.01 0",
};

/* The reducer mark needs its taper drawn rather than a parallel pair. */
const REDUCER = "M3 4 L41 10 M3 24 L41 18 M3 4 V24 M41 10 V18";

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
      <path d={kind === "reducer" ? REDUCER : PATHS[kind]} />
    </svg>
  );
}
