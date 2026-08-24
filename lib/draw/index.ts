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

export function buildView(
  fitting: Fitting,
  view: ViewKind,
  us: UnitSystem,
): ViewScene {
  const L = (mm: number) => fmtLength(mm, us);
  const scene =
    view === "blueprint"
      ? blueprint(fitting, L)
      : view === "flat"
        ? flat(fitting, L)
        : isometric(fitting, L);
  return project(scene, VIEW_W, VIEW_H);
}

export function dimensionNote(us: UnitSystem): string {
  return `All dimensions in ${lengthUnit(us)}.`;
}

export type { ViewScene } from "./scene";
