import type { Fitting } from "../duct/types";
import { type UnitSystem, fmtLength, lengthUnit } from "../duct/units";
import { blueprint } from "./blueprint";
import { flat } from "./flat";
import { isometric } from "./iso";
import { type ViewScene, project } from "./scene";

export type ViewKind = "blueprint" | "flat" | "iso";

export const VIEWS: { kind: ViewKind; label: string; hint: string }[] = [
  { kind: "blueprint", label: "Blueprint", hint: "Dimensioned orthographic views" },
  { kind: "flat", label: "Flat pattern", hint: "The developed blanks — solid cuts, dashed folds" },
  { kind: "iso", label: "Isometric", hint: "The fitting as an object" },
];

/** The SVG viewBox every drawing is fitted into. Fixed, so stroke widths and
 * label sizes are plain constants rather than a function of the fitting. */
export const VIEW_W = 1000;
export const VIEW_H = 640;

/**
 * Room a flat pattern needs between blanks, in VIEW pixels.
 *
 * Two facing dimension lines at 30 px, their labels at ~16 px, and a margin.
 * It is a view-space figure because that is what the annotations are measured
 * in — the whole bug this exists to prevent was a gap sized in millimetres
 * trying to hold labels sized in pixels.
 */
const FLAT_GAP_PX = 84;

/** Rough width of one caption character at 13px, for the gap sum above. */
const CAPTION_CHAR_PX = 7.6;

export function buildView(
  fitting: Fitting,
  view: ViewKind,
  us: UnitSystem,
): ViewScene {
  const L = (mm: number) => fmtLength(mm, us);

  if (view === "flat") {
    /* Chicken and egg: the gap has to be in model units to lay out, but its
     * adequacy is only knowable in view units, which depend on the layout.
     * So: lay out, project, read the scale back, and re-lay out if the gap
     * came out too tight. Widening the gap shrinks the scale slightly, which
     * is why this iterates rather than correcting once — it converges in two
     * or three passes and is capped regardless. */
    let scene = flat(fitting, L);
    let projected = project(scene, VIEW_W, VIEW_H);

    for (let pass = 0; pass < 4; pass++) {
      /* Captions are centred under their own blank, so two long captions on
       * two narrow blanks collide even when the blanks themselves clear. The
       * gap has to hold the wider of them — "branch 1 throat ×1" under a
       * hundred-millimetre gore is the case that found this. */
      const longest = Math.max(0, ...projected.captions.map((c) => c.text.length));
      const needPx = Math.max(FLAT_GAP_PX, longest * CAPTION_CHAR_PX * 0.72);
      const needModel = needPx / projected.scale;
      if (scene.gap >= needModel * 0.98) break;
      scene = flat(fitting, L, needModel);
      projected = project(scene, VIEW_W, VIEW_H);
    }
    return projected;
  }

  const scene = view === "blueprint" ? blueprint(fitting, L) : isometric(fitting, L);
  return project(scene, VIEW_W, VIEW_H);
}

export function dimensionNote(us: UnitSystem): string {
  return `All dimensions in ${lengthUnit(us)}.`;
}

export type { ViewScene } from "./scene";
