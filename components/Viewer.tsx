"use client";

import { useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  CAMERA,
  type Camera,
  VIEWS,
  type ViewKind,
  buildView,
  clampCamera,
  dimensionNote,
} from "@/lib/draw";
import { Button } from "./ui";
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
  iso: "The fitting as a solid, from the same millimetres. Drag it to turn it.",
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
  /* THE CAMERA, and it only means anything on the isometric.
   *
   * The isometric was always solid geometry — real millimetres, real faces,
   * hidden surfaces resolved by depth — projected through one hard-coded
   * matrix. That is why it read as flat: it was 3D drawn from exactly one
   * angle, every time. Dragging changes the angle; nothing about the model
   * changed to allow it. See lib/draw/iso.ts. */
  const [camera, setCamera] = useState<Camera>(CAMERA.home);
  const turn = useRef<{ x: number; y: number; c: Camera } | null>(null);
  const [turning, setTurning] = useState(false);
  const rotatable = view === "iso";
  const moved = camera.yaw !== CAMERA.home.yaw || camera.pitch !== CAMERA.home.pitch;

  /* Rebuilding the scene is pure trigonometry over a handful of points, but it
   * runs on every keystroke in every field, so it is memoised on the numbers
   * that actually change it — the camera included, since it moves per frame
   * while a finger is down. */
  const scene = useMemo(
    () => buildView(fitting, view, units, camera),
    [fitting, view, units, camera],
  );
  const name = SPECS[fitting.kind].name;

  const endTurn = () => {
    turn.current = null;
    setTurning(false);
  };

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

      {/* On the isometric the drag rotates instead of panning, so the gesture
        * everybody tries on a 3D object does the thing they expect. Zoom and
        * pinch still belong to ZoomPan underneath; only the one-finger drag is
        * taken, and only on this view. */}
      <div
        className={rotatable ? (turning ? "cursor-grabbing" : "cursor-grab") : undefined}
        style={rotatable ? { touchAction: "none" } : undefined}
        onPointerDown={
          rotatable
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                turn.current = { x: e.clientX, y: e.clientY, c: camera };
                setTurning(true);
              }
            : undefined
        }
        onPointerMove={
          rotatable
            ? (e) => {
                const t = turn.current;
                if (!t) return;
                /* A third of a degree per pixel: a comfortable thumb-swipe
                 * crosses the whole allowed range without overshooting it. */
                setCamera(
                  clampCamera({
                    yaw: t.c.yaw + (e.clientX - t.x) * 0.35,
                    pitch: t.c.pitch - (e.clientY - t.y) * 0.35,
                  }),
                );
              }
            : undefined
        }
        onPointerUp={rotatable ? endTurn : undefined}
        onPointerCancel={rotatable ? endTurn : undefined}
      >
        <ZoomPan label={`the ${name} drawing`}>
          <Drawing
            scene={scene}
            title={`${name}, ${view === "flat" ? "flat pattern" : view === "iso" ? "isometric view" : "dimensioned drawing"}${
              view === "flat" ? ` for the ${mode === "shop" ? "shop" : "billing"} standard` : ""
            }`}
          />
        </ZoomPan>
      </div>

      {rotatable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setCamera(CAMERA.home)} disabled={!moved}>
            <RotateCcw size={16} strokeWidth={1.5} /> Straighten up
          </Button>
          <span className="text-small tabular-nums text-muted" aria-live="polite">
            {moved
              ? `turned ${Math.round(camera.yaw - CAMERA.home.yaw)}°, raised ${Math.round(
                  camera.pitch - CAMERA.home.pitch,
                )}°`
              : "drag the drawing to turn it"}
          </span>
        </div>
      )}

      <p className="mt-3 text-small text-muted">
        {dimensionNote(units)} {HINT[view]}
      </p>
    </div>
  );
}
