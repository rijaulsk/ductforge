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
 * Pointer events rather than mouse and touch separately — one code path for a
 * finger, a stylus and a mouse, and `setPointerCapture` means a drag that
 * leaves the frame still ends when the button comes up.
 */

const MIN = 1;
const MAX = 6;
const STEP = 0.6;

export default function ZoomPan({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

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

  return (
    <div>
      <div
        className={`relative overflow-hidden rounded-card border-[1.5px] border-rule bg-page ${
          scale > MIN ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
        }`}
        onPointerDown={(e) => {
          if (scale <= MIN) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        /* Double-tap or double-click toggles between fit and a useful
         * magnification — the gesture people try first. */
        onDoubleClick={() => (scale > MIN ? reset() : zoomTo(2.2))}
      >
        <div
          className="origin-center p-2 transition-transform duration-200 ease-out"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
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
