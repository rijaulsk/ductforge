"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ViewScene } from "@/lib/draw";
import { useHasMounted } from "@/lib/hooks";
import Drawing from "./Drawing";
import ZoomPan from "./ZoomPan";
import { Button } from "./ui";

/* The drawing, on the whole screen.
 *
 * WHY IT HAD TO EXIST. The scene is projected into a 1000-unit-wide viewBox and
 * its labels are a constant 16 of those units, which is what keeps a collar's
 * dimensions and a six-metre run's dimensions the same size as each other. The
 * cost is that the label size on screen is entirely decided by how wide the
 * drawing is rendered — and inside the workspace card on a 390px phone that is
 * 276px, a scale of 0.276, so a 16-unit label lands at about four and a half
 * pixels. The drawing was decorative on a phone: you could see there was a duct
 * and you could not read a single number on it.
 *
 * The obvious fix — open the inline drawing zoomed in — is the one thing that
 * could not be done. ZoomPan sets `touch-action: none` whenever it is zoomed,
 * because a zoomed drawing needs every gesture; at fit it deliberately leaves
 * `pan-y` so a vertical swipe still scrolls the PAGE past a drawing you are not
 * using. Opening zoomed would have trapped the page scroll behind the drawing,
 * which is the bug fixed on 28 Aug 2026 and not one to reintroduce.
 *
 * A modal has no page behind it to scroll. That is the whole reason this is a
 * separate surface rather than a bigger inline one: here the drawing can own
 * every gesture honestly, and it can have the screen's height as well as its
 * width. Rotating the phone helps too — 844px of width at fit puts the labels
 * at 13px with nothing to do but look.
 *
 * `<dialog showModal()>` rather than a hand-built overlay: it brings the focus
 * trap, Escape, `inert` on everything behind and the top layer with it, none of
 * which is worth reimplementing, and it costs no dependency.
 */

/** What a dimension label must measure on screen before it is worth reading. */
const LEGIBLE_PX = 13;
/** The label size in viewBox units — see Drawing's LABEL constant. */
const LABEL_UNITS = 16;
/** The viewBox width every scene is projected into. */
const VIEW_UNITS = 1000;
/**
 * Never open more magnified than this, however small the screen.
 *
 * At 3× on a phone you read the dimensions AND still see a third of the fitting
 * at once. Past that it stops being a drawing and becomes a number on a line,
 * and you have lost the thing you opened it to check. Anyone who wants more can
 * pinch; the control is right there.
 */
const MAX_OPENING_SCALE = 3;

/** ZoomPan's own button row, which lives inside the box it is given. */
const CONTROL_ROW_PX = 56;

/**
 * Below this height the dialog drops its eyebrow and its note.
 *
 * 520px is above a phone held sideways (390–430) and below every phone held
 * upright (844+) and every laptop, so it means "landscape phone" without
 * asking about orientation. The matching CSS is `[@media(max-height:520px)]`
 * on the two elements — change one and change the other.
 */
const SHORT_SCREEN_PX = 520;

/**
 * How magnified to open, so the labels are readable on this screen.
 *
 * On a desktop the fitted drawing is already 1300px wide and this returns 1 —
 * the modal opens showing everything, which is what more room should buy you.
 * It only zooms where zooming is the only way to read the thing.
 */
function openingScale(surfaceWidth: number): number {
  if (surfaceWidth <= 0) return 1;
  const labelPxAtFit = LABEL_UNITS * (surfaceWidth / VIEW_UNITS);
  const needed = LEGIBLE_PX / labelPxAtFit;
  return Math.min(MAX_OPENING_SCALE, Math.max(1, needed));
}

/** The cropped frame this scene is drawn in: "minX minY width height". */
function frameAspect(viewBox: string): number {
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  return w > 0 && h > 0 ? w / h : VIEW_UNITS / 640;
}

/**
 * How tall to make the drawing surface.
 *
 * THE BOX FITS THE DRAWING, NOT THE SCREEN, and the first build of this had it
 * the other way round. A surface stretched to the full height renders a
 * straight duct — a 1000 × 300 frame — as a 98px band floating in 625px of
 * empty bordered box, because a uniform fit centres what it cannot fill. Two
 * thirds of a full-screen view was nothing, framed.
 *
 * Sizing the box to what the drawing actually occupies at its opening
 * magnification removes the band entirely, and a taller fitting — the
 * isometric, whose frame is nearly square — still gets nearly the whole screen.
 * The floor stops a very flat drawing from becoming a letterbox slit, and the
 * ceiling is whatever the screen has left after the chrome.
 */
function surfaceHeight(width: number, aspect: number, scale: number, available: number): number {
  /* Plus the control row ZoomPan puts inside this box, so the figure above is
   * the height the DRAWING gets rather than the height the box gets. */
  const wanted = (width / aspect) * scale + CONTROL_ROW_PX;
  return Math.round(Math.min(available, Math.max(available * 0.3, wanted)));
}

export default function DrawingDialog({
  open,
  onClose,
  scene,
  title,
  caption,
  hint,
}: {
  open: boolean;
  onClose: () => void;
  scene: ViewScene;
  /** The drawing's accessible name — the same one the inline copy uses. */
  title: string;
  /** Shown in the bar: which fitting and which view. */
  caption: string;
  /** The view's own note, repeated so the reader is not sent back for it. */
  hint: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  /* IT HAS TO LEAVE THE CARD IT WAS DECLARED IN.
   *
   * The Viewer lives inside the drawing panel, and below `lg` that panel is
   * `hidden` whenever another tab is showing. `showModal()` promotes a dialog
   * to the top layer for PAINTING, but an ancestor with `display: none` still
   * removes it from the box tree — so the dialog laid out at 0 × 0, the SVG
   * inside it resolved `h-full` against nothing, and a full-screen drawing
   * opened as an empty screen. It reproduced by opening the view in landscape,
   * where the same breakpoint hides the panel.
   *
   * A portal to `document.body` puts it outside every collapsible ancestor and
   * keeps the state that owns it here, next to the drawing it shows. */
  const mounted = useHasMounted();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    /* `mounted` too: before it flips this renders null and `ref.current` is
     * null — see the same fix, and how it was found, in ExportDialog.tsx. */
  }, [open, mounted]);

  /* LISTEN FOR `close`, NOT `cancel`.
   *
   * A `<dialog>` can close without React being asked: Escape, `el.close()` from
   * anywhere, the platform's own dismissal. Handling only `cancel` catches
   * Escape and misses the rest, and every miss leaves `open` true against a
   * closed dialog — after which the trigger button does nothing at all, because
   * setting a state that is already true schedules no effect. Found by closing
   * it from the console and then being unable to reopen it.
   *
   * `close` fires on every one of those paths, so the state cannot drift.
   *
   * AND IT MUST DEPEND ON `mounted`. This worked only because Viewer passes an
   * inline arrow, a new `onClose` every render, which kept re-running the
   * effect until the dialog node existed. Given a stable callback it would
   * have run once, against a null ref, and never subscribed — which is exactly
   * what happened to ExportDialog on 18 Sep 2026. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => onClose();
    el.addEventListener("close", sync);
    return () => el.removeEventListener("close", sync);
  }, [onClose, mounted]);

  /* Estimated once per opening rather than tracked. These only choose where the
   * view OPENS — a starting magnification and a box to put it in — so being a
   * few pixels out costs nothing, and if the reader rotates the phone the Fit
   * button is one tap away. A resize observer here would fight their own zoom.
   * The subtractions are this dialog's own padding and the header, controls and
   * hint rows around the surface. */
  const vw = typeof window === "undefined" ? 0 : window.innerWidth;
  const vh = typeof window === "undefined" ? 0 : window.innerHeight;
  const surfaceWidth = Math.max(0, vw - 48);
  /* A PHONE HELD SIDEWAYS IS 390px TALL, and the chrome was eating it.
   *
   * Landscape is the orientation the hint below recommends, because it is the
   * only one that gives a wide drawing real width. But the header, the control
   * row and the note came to 200px of a 390px screen, so the drawing got 190
   * and — fitted into a box too short for its own proportions — shrank to 460px
   * of an available 780. Turning the phone made the drawing SMALLER, which is
   * the opposite of what it was for.
   *
   * On a short screen the eyebrow and the note are hidden in CSS and the budget
   * here drops to match, so the drawing gets the room instead. The two numbers
   * have to agree: this one decides the box, that one decides what is drawn
   * around it. */
  const shortScreen = vh > 0 && vh < SHORT_SCREEN_PX;
  const availableHeight = Math.max(160, vh - (shortScreen ? 116 : 200));
  const scale = openingScale(surfaceWidth);
  const boxHeight = surfaceHeight(
    surfaceWidth,
    frameAspect(scene.viewBox),
    scale,
    availableHeight,
  );

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={ref}
      aria-label={title}
      className="m-0 h-full max-h-none w-full max-w-none bg-page p-0 text-body backdrop:bg-ink/70"
      onClick={(e) => {
        /* A click on the dialog element itself is a click on the backdrop —
         * the content is a child and stops it from reaching here. */
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex h-full flex-col gap-3 p-4 md:p-6">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-eyebrow uppercase text-accent [@media(max-height:520px)]:hidden">
                Drawing
              </p>
              {/* Wraps rather than truncates: "Straight duct · dimension…" tells
                * you less than the second line costs, and a phone held upright
                * has the room. On a short screen the header is one line anyway,
                * because the caption fits a landscape width whole. */}
              <p className="mt-1 font-medium text-heading">{caption}</p>
            </div>
            <Button onClick={onClose} className="shrink-0" aria-label="Close the drawing">
              <X size={18} strokeWidth={1.8} />
              Close
            </Button>
          </div>

          {/* The header stays at the top and the hint at the foot; the drawing
            * centres in whatever is between them, so a short fitting sits in
            * the middle of the screen instead of hanging off the header. */}
          <div className="flex min-h-0 flex-1 items-center">
            <div style={{ height: boxHeight }} className="w-full">
              <ZoomPan label={title} fill initialScale={scale}>
                <Drawing scene={scene} title={title} className="h-full w-full" />
              </ZoomPan>
            </div>
          </div>

          <p className="shrink-0 text-small text-muted [@media(max-height:520px)]:hidden">
            {hint}
            {/* Shown only where it is true. A 1000-unit-wide drawing on a
              * narrow screen cannot fill it without cropping, and turning the
              * phone is the one move that buys real width — 844 instead of 358
              * puts every label past 13px with the whole fitting on screen. A
              * width test rather than an orientation one, because a phone in
              * landscape is already past `xs` and does not need telling. */}
            <span className="hidden max-xs:inline">
              {" "}
              Turn your phone sideways for the whole drawing at once.
            </span>
          </p>
        </div>
      )}
    </dialog>,
    document.body,
  );
}
