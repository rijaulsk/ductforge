"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "./ui";

/* Pan and zoom for the drawings.
 *
 * A dimensioned drawing that fits a phone screen has 11px text on it. The
 * geometry is vector, so it is already sharp at any magnification — all that
 * was missing was a way to ask for some.
 *
 * IMPLEMENTED AS A CSS TRANSFORM, not by rewriting the SVG viewBox. Two
 * reasons: the viewBox is what the projection computed, and changing it would
 * mean the drawing on screen no longer matches the one the checks assert; and
 * a transform is composited by the browser, so dragging stays smooth without
 * re-rendering a few hundred paths on every pointer move.
 *
 * WHY IT DID NOT WORK ON A PHONE, and this is the whole point of the rewrite.
 *
 * There was no `touch-action` on the pan surface. Pointer events fired
 * perfectly — but `touch-action` defaults to `auto`, which means the browser
 * ALSO scrolls the page on a vertical drag, and the browser wins. You dragged
 * the drawing and the page moved instead. Reported as "in mobile it's hard to
 * move around because the page is moving itself", which is exactly what it was
 * doing.
 *
 * So the surface declares what it wants:
 *
 *   at fit    `pan-y` — nothing to pan, so a vertical swipe must still scroll
 *             the page. Taking the gesture here would trap the reader inside
 *             a drawing they cannot scroll past, which is worse than the bug.
 *   zoomed    `none` — every gesture belongs to the drawing.
 *
 * `overscroll-contain` stops a pan that reaches the edge from chaining into
 * the page behind it, and pinch is handled here rather than left to the
 * browser, because at `touch-action: none` the browser will not do it for us —
 * and pinch is the first thing anybody tries on a drawing.
 */

const MIN = 1;
const MAX = 6;
const STEP = 0.6;

type Point = { x: number; y: number };

export default function ZoomPan({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  /* Every pointer currently down, by id. One is a drag, two is a pinch — the
   * same map answers both, which is why this is not two code paths. */
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  /* Zooming out to 1 re-centres: at full view there is nothing to pan to, and
   * leaving a stale offset there strands the drawing off to one side. */
  const zoomTo = (next: number) => {
    const s = clamp(next);
    setScale(s);
    if (s === MIN) setOffset({ x: 0, y: 0 });
  };

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const endGesture = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      drag.current = null;
      setDragging(false);
    }
  };

  return (
    <div>
      <div
        className={`relative overflow-hidden overscroll-contain rounded-card border-[1.5px] border-rule bg-page ${
          scale > MIN ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
        } ${dragging ? "select-none" : ""}`}
        /* The fix. Tailwind's touch utilities compile to touch-action. */
        style={{ touchAction: scale > MIN ? "none" : "pan-y" }}
        onPointerDown={(e) => {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            /* A second finger converts a drag into a pinch mid-gesture. */
            pinch.current = { dist: spread(), scale };
            drag.current = null;
            setDragging(true);
            return;
          }
          if (scale <= MIN) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          if (pinch.current && pointers.current.size === 2) {
            const now = spread();
            if (pinch.current.dist > 0) {
              zoomTo((pinch.current.scale * now) / pinch.current.dist);
            }
            return;
          }
          const d = drag.current;
          if (!d) return;
          setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
        }}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onPointerLeave={(e) => {
          /* A mouse that leaves without releasing would otherwise stay "down"
           * forever. Touch pointers are captured, so this never fires for them. */
          if (e.pointerType === "mouse") endGesture(e);
        }}
        /* Double-tap or double-click toggles between fit and a useful
         * magnification — the gesture people try second. */
        onDoubleClick={() => (scale > MIN ? reset() : zoomTo(2.2))}
      >
        <div
          className="origin-center p-2 transition-transform duration-200 ease-out"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            /* `dragging` means "a gesture is in progress", pinch included —
             * a ref cannot be read during render, and the transition has to
             * be off for both or the drawing lags a finger by 200ms. */
            transitionProperty: dragging ? "none" : undefined,
          }}
        >
          {children}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => zoomTo(scale - STEP)}
          disabled={scale <= MIN}
          aria-label={`Zoom out of ${label}`}
        >
          <Minus size={16} strokeWidth={1.8} />
        </Button>
        <Button
          size="sm"
          onClick={() => zoomTo(scale + STEP)}
          disabled={scale >= MAX}
          aria-label={`Zoom in on ${label}`}
        >
          <Plus size={16} strokeWidth={1.8} />
        </Button>
        <Button size="sm" onClick={reset} disabled={scale === MIN && offset.x === 0 && offset.y === 0}>
          <Maximize2 size={16} strokeWidth={1.5} /> Fit
        </Button>
        <span className="text-small tabular-nums text-muted" aria-live="polite">
          {Math.round(scale * 100)}%
          {scale > MIN && <span className="ml-2">drag to move</span>}
        </span>
      </div>
    </div>
  );
}
