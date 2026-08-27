"use client";

import { useMemo } from "react";
import { VIEWS, type ViewKind, buildView, dimensionNote } from "@/lib/draw";
import { SPECS } from "@/lib/duct/formulas";
import type { Fitting, Mode } from "@/lib/duct/types";
import type { UnitSystem } from "@/lib/duct/units";
import Drawing from "./Drawing";
import ZoomPan from "./ZoomPan";

/* The drawing stage.
 *
 * The flat pattern is the shop mode's payoff, so switching the measurement
 * standard does NOT switch the view — an estimator working in billing mode
 * still wants to see the blank sometimes, and having the picture change under
 * them when they change a number is worse than an extra click. The view is the
 * user's choice and stays where they left it.
 */

const HINT: Record<ViewKind, string> = {
  blueprint: "Dimensions as the formula uses them.",
  flat: "Solid lines cut, dashed lines fold. Seam laps and flange material are not drawn — the waste allowance covers them.",
  iso: "The fitting as an object, drawn from the same millimetres.",
};

export default function Viewer({
  fitting,
  units,
  mode,
  view,
  onView,
}: {
  fitting: Fitting;
  units: UnitSystem;
  mode: Mode;
  view: ViewKind;
  onView: (v: ViewKind) => void;
}) {
  /* Rebuilding the scene is pure trigonometry over a handful of points, but it
   * runs on every keystroke in every field, so it is memoised on the numbers
   * that actually change it. */
  const scene = useMemo(() => buildView(fitting, view, units), [fitting, view, units]);
  const name = SPECS[fitting.kind].name;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => {
          const on = v.kind === view;
          return (
            <button
              key={v.kind}
              type="button"
              title={v.hint}
              aria-pressed={on}
              onClick={() => onView(v.kind)}
              className={`rounded-full border-[1.5px] px-4 py-2 text-small font-medium transition duration-200 ease-out ${
                on ? "border-line bg-heading text-page" : "border-line text-heading hover:bg-sunk"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      <ZoomPan label={`the ${name} drawing`}>
        <Drawing
          scene={scene}
          title={`${name}, ${view === "flat" ? "flat pattern" : view === "iso" ? "isometric view" : "dimensioned drawing"}${
            view === "flat" ? ` for the ${mode === "shop" ? "shop" : "billing"} standard` : ""
          }`}
        />
      </ZoomPan>

      <p className="mt-3 text-small text-muted">
        {dimensionNote(units)} {HINT[view]}
      </p>
    </div>
  );
}
