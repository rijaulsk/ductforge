"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, Minus, Plus, RotateCcw, X } from "lucide-react";
import { computeTotals, hasZones } from "@/lib/duct/compute";
import type { Project } from "@/lib/duct/types";
import { toCsv, toDetailedCsv } from "@/lib/export/csv";
import { safeFilename, triggerDownload } from "@/lib/export/download";
import {
  COLUMNS,
  DEFAULT_TITLE,
  PX_PER_MM,
  type PrintHeader,
  type PrintOptions,
  SECTIONS,
  defaultPrintOptions,
  pageMm,
} from "@/lib/export/printOptions";
import { useHasMounted } from "@/lib/hooks";
import { toProjectFile } from "@/lib/project";
import { PagedSheet, type SheetLayout } from "./PagedSheet";
import { Button, Eyebrow, Segmented } from "./ui";

/* The export studio.
 *
 * WHY IT EXISTS. "Print" went straight to the browser's dialog with a sheet
 * nobody could change, and the owner — who issues these to clients by saving
 * that print as a PDF — could not take a single part of it out. This is where
 * the sheet is set up: every section and column a switch, the header text his
 * own, the paper and orientation and text size his choice, with the sheet
 * redrawn beside the switches as they move.
 *
 * THE PREVIEW IS NOT A PICTURE OF THE SHEET, IT IS THE SHEET. It renders the
 * same BoqSheet the print target renders, from the same options saved on the
 * Project, at the true paper width in millimetres, scaled down to fit. So the
 * PDF cannot come out different from what was on screen when the button was
 * pressed — there is no second implementation for it to drift from. That is
 * also why the PDF comes from the browser's own Save as PDF rather than a PDF
 * library: a library would be a second drawing of the same document.
 *
 * The shell is DrawingDialog's, for DrawingDialog's reasons — a native
 * `<dialog showModal()>` for the focus trap and Escape, portalled to body so a
 * collapsed ancestor cannot lay it out at 0 × 0, synced on `close` so no way of
 * closing it can leave `open` stuck true. And `print:hidden`, so printing from
 * inside it prints the sheet behind it rather than the dialog.
 *
 * Every other export lives here too, one tap from the PDF, and each shows what
 * it will write before it writes it.
 */

type Format = "pdf" | "csv" | "working" | "project";

const FORMATS: { value: Format; label: string; title: string }[] = [
  { value: "pdf", label: "PDF", title: "The quantity sheet — set it up and preview it" },
  { value: "csv", label: "CSV", title: "The schedule as a spreadsheet" },
  /* Short enough for a quarter of a 320 px row; the title says the rest. */
  { value: "working", label: "Working", title: "CSV + working — the schedule with every step written out" },
  { value: "project", label: "Project", title: "Project file — the whole takeoff, to reopen or send on" },
];

/**
 * Print, with the document titled after the job for the length of it.
 *
 * The PDF's default filename is the document title — the browser offers it in
 * the Save as PDF dialog. Left alone every job would save as the app's own page
 * title; set to the pattern the CSVs use, it names the job and the day. Put back
 * on `afterprint`, because some browsers return from `print()` before the
 * dialog closes. Module level rather than inside the component: it touches a
 * global, and a closure built during render must not.
 */
function printAs(title: string): void {
  const before = document.title;
  document.title = title;
  const restore = () => {
    document.title = before;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

/* ---- the preview ------------------------------------------------------------ */

/**
 * The pages, at their real size, scaled to fit the panel.
 *
 * REAL PAGES since 19 Sep 2026. This used to be one strip of paper with dashed
 * "approximate break" guides, because the printer decided where pages broke
 * and the preview could only guess. The breaks are decided by this app now
 * (lib/export/paginate.ts), from one measurement that the print target draws
 * too — so each page here is a page on paper, and the count is exact.
 *
 * ZOOMABLE, AND BY SCROLLING RATHER THAN DRAGGING. The drawing viewer pans by
 * transform and deliberately refuses to pan at fit, which is right for one
 * picture and wrong for a document: at fit you must still be able to reach
 * page two. So here zoom only changes how big the paper is drawn, and a plain
 * scroll viewport does the travelling — both axes, with the platform's own
 * inertia, scrollbars and keyboard. A pinch on a touchscreen and Ctrl/⌘ +
 * wheel on a desktop zoom the SHEET instead of the whole page, and the point
 * under the fingers or the middle of the view stays put as the scale changes.
 *
 * `scrollbar-gutter: stable` on the viewport is load-bearing: the fit scale is
 * computed from the viewport's width, and a scrollbar appearing as the sheet
 * zooms would narrow it, change the fit, and oscillate.
 */
/** A 40 px round icon button — the smallest target a thumb reliably hits. */
function IconButton({
  label,
  children,
  className = "",
  ...rest
}: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line text-heading transition-colors duration-200 ease-out hover:bg-sunk disabled:pointer-events-none disabled:opacity-45 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

function SheetPreview({
  project,
  options,
  layout,
}: {
  project: Project;
  options: PrintOptions;
  layout: SheetLayout | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  /** 1 = the page fits the panel's width. Relative, so a resize keeps it. */
  const [zoom, setZoom] = useState(1);
  /* Where in the sheet to keep still while the scale changes — a fraction of
   * the scrollable width and height, restored after the re-render. */
  const anchor = useRef<{ fx: number; fy: number; vx: number; vy: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  /** Change the zoom, holding the point at (vx, vy) in the viewport still. */
  const zoomTo = (next: number, vx?: number, vy?: number) => {
    const el = wrapRef.current;
    const z = clampZoom(next);
    if (!el || z === zoom) return;
    const px = vx ?? el.clientWidth / 2;
    const py = vy ?? el.clientHeight / 2;
    anchor.current = {
      fx: (el.scrollLeft + px) / Math.max(1, el.scrollWidth),
      fy: (el.scrollTop + py) / Math.max(1, el.scrollHeight),
      vx: px,
      vy: py,
    };
    setZoom(z);
  };

  /* After the new size is laid out, scroll so the anchored point is back under
   * the fingers or the centre. */
  useEffect(() => {
    const el = wrapRef.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.fx * el.scrollWidth - a.vx;
    el.scrollTop = a.fy * el.scrollHeight - a.vy;
    anchor.current = null;
  }, [zoom]);

  /* The latest `zoomTo` and `zoom`, for the wheel listener, which is attached
   * once. Refreshed after each render rather than written during one — React
   * does not allow a ref to be assigned while rendering. */
  const latest = useRef({ zoomTo, zoom });
  useEffect(() => {
    latest.current = { zoomTo, zoom };
  });

  /* Ctrl/⌘ + wheel zooms the sheet. It needs a NON-passive listener to be
   * allowed to cancel the browser's own page zoom, which React's onWheel
   * cannot be — hence addEventListener. Ctrl + wheel is also what a trackpad
   * pinch arrives as on a desktop. */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const { zoomTo: go, zoom: z } = latest.current;
      go(z * Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => setAvail(wrap.clientWidth));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const { w, h } = pageMm(options.page);
  const pageW = w * PX_PER_MM;
  const pageH = h * PX_PER_MM;
  /* The fit: the page across the panel's width, never enlarged past life size
   * — a 13-inch A4 is not more truthful, just bigger. Zoom multiplies it. */
  const fit = avail > 0 ? Math.min(1, (avail - 24) / pageW) : 0;
  const scale = fit * zoom;
  /* Exact now, not "about": these are the pages that will print. */
  const pages = layout?.pages.length ?? 1;
  /** Zoom at which the sheet prints at its true size on this screen. */
  const actual = fit > 0 ? 1 / fit : 1;

  /* Pinch on a touchscreen: two pointers, scale by the change in their spread.
   * `touch-action: pan-x pan-y` on the viewport keeps one-finger scrolling
   * native while stopping the browser zooming the whole page instead. */
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) pinch.current = { dist: spread(), zoom };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && pointers.current.size === 2 && p.dist > 0) {
      const el = wrapRef.current;
      const [a, b] = [...pointers.current.values()];
      const r = el?.getBoundingClientRect();
      zoomTo(
        (p.zoom * spread()) / p.dist,
        r ? (a.x + b.x) / 2 - r.left : undefined,
        r ? (a.y + b.y) / 2 - r.top : undefined,
      );
    }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ONE ROW, at every width. It used to wrap onto two at 390 px — a page
        * label, four pill buttons and a percentage — and cost the preview a
        * sixth of a phone screen. Now: the count, then − · % · + · Fit, where
        * the percentage is itself the "actual size" button. */}
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        {/* Named from the chosen size, never inferred from the width — rotated,
          * A4 is 297 mm wide, and a width test called it Letter. */}
        <p className="min-w-0 truncate text-small text-muted" aria-live="polite">
          <span className="hidden xs:inline">
            {options.page.size === "a4" ? "A4" : "Letter"} {options.page.orientation} ·{" "}
          </span>
          {pages} {pages === 1 ? "page" : "pages"}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton
            onClick={() => zoomTo(zoom / ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            label="Zoom out of the preview"
          >
            <Minus size={16} strokeWidth={1.8} />
          </IconButton>
          <button
            type="button"
            onClick={() => zoomTo(actual)}
            disabled={Math.abs(zoom - actual) < 0.01}
            title="Show the sheet at the size it prints"
            aria-label={`${Math.round(scale * 100)}% — show at the size it prints`}
            className="h-10 min-w-14 rounded-full px-2 text-small font-medium tabular-nums text-heading transition-colors duration-200 ease-out hover:bg-card disabled:text-muted"
          >
            {Math.round(scale * 100)}%
          </button>
          <IconButton
            onClick={() => zoomTo(zoom * ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            label="Zoom in on the preview"
          >
            <Plus size={16} strokeWidth={1.8} />
          </IconButton>
          {/* "Fit", not "Fit width": on a wide screen the fit is capped at life
            * size and the page does not fill the width, so the longer label
            * described something the button does not do there. */}
          <Button size="sm" onClick={() => zoomTo(1)} disabled={zoom === 1} className="h-10">
            Fit
          </Button>
        </div>
      </div>

      <div
        ref={wrapRef}
        tabIndex={0}
        aria-label="Sheet preview — Ctrl and scroll, or pinch, to zoom"
        className="min-h-0 flex-1 overflow-auto rounded-card [scrollbar-gutter:stable]"
        style={{ touchAction: "pan-x pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Plain blocks with auto margins, NOT a centring flexbox: a centred
          * flex item that grows wider than its box overflows to BOTH sides,
          * and the half past the left edge cannot be scrolled to. An auto
          * margin centres while there is room and drops to zero when there
          * is not, so a zoomed page overflows rightward, all of it reachable. */}
        <div
          className="space-y-5 pb-2"
          style={{ visibility: scale > 0 ? "visible" : "hidden" }}
        >
          <PagedSheet
            project={project}
            options={options}
            layout={layout}
            wrap={(page, i, n) => (
              <figure className="m-0 mx-auto" style={{ width: pageW * scale }}>
                <div
                  className="overflow-hidden border-[1.5px] border-rule"
                  style={{ width: pageW * scale, height: pageH * scale }}
                >
                  <div
                    style={{
                      width: pageW,
                      height: pageH,
                      transform: `scale(${scale || 1})`,
                      transformOrigin: "top left",
                    }}
                  >
                    {page}
                  </div>
                </div>
                <figcaption className="mt-1.5 text-center text-small text-muted">
                  Page {i + 1} of {n}
                </figcaption>
              </figure>
            )}
          />
        </div>
      </div>
    </div>
  );
}

/* ---- the settings ----------------------------------------------------------- */

/** One switch. A native checkbox inside its label, so the whole row is the
 * target and a screen reader hears a checkbox, not a styled div. */
function Toggle({
  label,
  hint,
  checked,
  disabled,
  indent,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  indent?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 py-1.5 ${indent ? "pl-7" : ""} ${
        disabled ? "cursor-not-allowed opacity-45" : ""
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-heading"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="text-heading">{label}</span>
        {hint && <span className="block text-small text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t-[1.5px] border-rule pt-5">
      <legend className="float-left w-full">
        <Eyebrow>{title}</Eyebrow>
      </legend>
      <div className="clear-both pt-3">{children}</div>
    </fieldset>
  );
}

const FIELD =
  "mt-1.5 w-full rounded-card border-[1.5px] border-line bg-page px-3 py-2 text-heading placeholder:text-faint";

/** Changes arrive as updaters, applied to the layout as it is by then — see
 * `updatePrint` in Workspace.tsx for the lost-update bug this avoids. */
type PrintUpdate = (fn: (print: PrintOptions) => PrintOptions) => void;

function PdfSettings({
  options,
  zonesExist,
  onChange,
}: {
  options: PrintOptions;
  zonesExist: boolean;
  onChange: PrintUpdate;
}) {
  const setSection = (key: keyof PrintOptions["sections"], v: boolean) =>
    onChange((o) => ({ ...o, sections: { ...o.sections, [key]: v } }));
  const setColumn = (key: keyof PrintOptions["columns"], v: boolean) =>
    onChange((o) => ({ ...o, columns: { ...o.columns, [key]: v } }));
  const setHeader = (patch: Partial<PrintHeader>) =>
    onChange((o) => ({ ...o, header: { ...o.header, ...patch } }));
  const setPage = (patch: Partial<PrintOptions["page"]>) =>
    onChange((o) => ({ ...o, page: { ...o.page, ...patch } }));

  return (
    <div className="space-y-6">
      <Group title="Sections">
        {SECTIONS.map((s) => (
          <Toggle
            key={s.key}
            label={s.label}
            hint={s.hint}
            indent={Boolean(s.parent)}
            checked={options.sections[s.key]}
            /* A child of a switched-off section cannot print either way, so
             * its switch says so rather than looking live and doing nothing. */
            disabled={s.parent ? !options.sections[s.parent] : false}
            onChange={(v) => setSection(s.key, v)}
          />
        ))}
      </Group>

      <Group title="Schedule columns">
        {COLUMNS.map((c) => {
          const noZones = c.key === "zone" && !zonesExist;
          return (
            <Toggle
              key={c.key}
              label={c.label}
              hint={noZones ? "No line in this job has a zone yet" : undefined}
              indent={Boolean(c.parent)}
              checked={options.columns[c.key]}
              disabled={
                !options.sections.schedule ||
                noZones ||
                (c.parent ? !options.columns[c.parent] : false)
              }
              onChange={(v) => setColumn(c.key, v)}
            />
          );
        })}
      </Group>

      <Group title="Header text">
        <p className="text-small text-muted">
          Anything you fill in prints; anything you leave empty doesn&rsquo;t.
        </p>
        <div className="mt-3 space-y-3">
          <label className="block text-small font-medium text-heading">
            Title
            <input
              className={FIELD}
              value={options.header.title}
              placeholder={DEFAULT_TITLE}
              maxLength={80}
              onChange={(e) => setHeader({ title: e.target.value })}
            />
          </label>
          <label className="block text-small font-medium text-heading">
            Your company
            <input
              className={FIELD}
              value={options.header.company}
              maxLength={80}
              onChange={(e) => setHeader({ company: e.target.value })}
            />
          </label>
          <label className="block text-small font-medium text-heading">
            Client
            <input
              className={FIELD}
              value={options.header.client}
              maxLength={80}
              onChange={(e) => setHeader({ client: e.target.value })}
            />
          </label>
          <label className="block text-small font-medium text-heading">
            Prepared by
            <input
              className={FIELD}
              value={options.header.preparedBy}
              maxLength={80}
              onChange={(e) => setHeader({ preparedBy: e.target.value })}
            />
          </label>
          <label className="block text-small font-medium text-heading">
            Notes
            <textarea
              className={`${FIELD} min-h-24 resize-y`}
              value={options.header.notes}
              maxLength={600}
              placeholder="Scope, exclusions, revision — printed under the header"
              onChange={(e) => setHeader({ notes: e.target.value })}
            />
          </label>
        </div>
      </Group>

      <Group title="Page">
        <div className="space-y-3">
          <Segmented
            label="Paper size"
            size="sm"
            value={options.page.size}
            onChange={(v) => setPage({ size: v })}
            options={[
              { value: "a4", label: "A4" },
              { value: "letter", label: "Letter" },
            ]}
          />
          <Segmented
            label="Orientation"
            size="sm"
            value={options.page.orientation}
            onChange={(v) => setPage({ orientation: v })}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
          <Segmented
            label="Text size"
            size="sm"
            value={options.page.text}
            onChange={(v) => setPage({ text: v })}
            options={[
              { value: "compact", label: "Compact" },
              { value: "normal", label: "Normal" },
              { value: "large", label: "Large" },
            ]}
          />
        </div>
      </Group>
    </div>
  );
}

/* ---- the dialog ------------------------------------------------------------- */

export default function ExportDialog({
  open,
  onClose,
  project,
  layout,
  onPrintChange,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  /** Where the pages break — measured once in Workspace, see PagedSheet. */
  layout: SheetLayout | null;
  /** Saves the layout onto the Project — the print target reads it too. */
  onPrintChange: PrintUpdate;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const mounted = useHasMounted();
  const [format, setFormat] = useState<Format>("pdf");
  /* Below `lg` the settings and the preview take turns; from `lg` they sit side
   * by side and this is ignored. */
  const [pane, setPane] = useState<"settings" | "preview">("preview");

  /* BOTH EFFECTS DEPEND ON `mounted`, and leaving it out broke reopening.
   *
   * Until `mounted` flips this component renders null, so on that first pass
   * `ref.current` is null and each effect returns before doing anything. The
   * listener effect then only ran again if `onClose` changed — and Workspace
   * hands in a stable `useCallback`, so it never did: the `close` listener was
   * never attached, a native close (Escape, anything) left `open` true, and the
   * Export button did nothing after that. Depending on `mounted` makes both
   * effects run again the moment the dialog node exists. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open, mounted]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => onClose();
    el.addEventListener("close", sync);
    return () => el.removeEventListener("close", sync);
  }, [onClose, mounted]);

  if (!mounted) return null;

  const options = project.print;
  const zonesExist = hasZones(computeTotals(project));

  const savePdf = () => printAs(safeFilename(project.name, "pdf").replace(/\.pdf$/, ""));

  const download = () => {
    if (format === "csv") {
      triggerDownload(
        new Blob([toCsv(project)], { type: "text/csv;charset=utf-8" }),
        safeFilename(project.name, "csv"),
      );
    } else if (format === "working") {
      triggerDownload(
        new Blob([toDetailedCsv(project)], { type: "text/csv;charset=utf-8" }),
        safeFilename(project.name, "csv", "working"),
      );
    } else if (format === "project") {
      triggerDownload(
        new Blob([toProjectFile(project)], { type: "application/json" }),
        safeFilename(project.name, "json", "project"),
      );
    }
  };

  /* `short` is what fits beside the title on the narrowest phones. */
  const primary =
    format === "pdf"
      ? { label: "Save as PDF", short: "PDF", icon: <FileText size={18} strokeWidth={1.8} />, act: savePdf }
      : {
          label: format === "project" ? "Download file" : "Download CSV",
          short: "Download",
          icon: <Download size={18} strokeWidth={1.8} />,
          act: download,
        };

  const textPreview =
    format === "csv" ? toCsv(project) : format === "working" ? toDetailedCsv(project) : null;

  return createPortal(
    /* `border-0` and `overflow-hidden` on the dialog itself: a native dialog
     * has a UA border, which on a full-height dialog is four pixels of
     * overflow — and a whole-dialog scrollbar outside the panes that own the
     * scrolling. Only the panes scroll. */
    <dialog
      ref={ref}
      aria-label="Export this takeoff"
      className="m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-page p-0 text-body backdrop:bg-ink/70 print:hidden"
    >
      {open && (
        <div className="flex h-full flex-col">
          {/* ONE ROW: close, what this is, and the action. The action used to
            * sit in a footer bar of its own and the title took two lines —
            * together a fifth of a phone screen the preview could have had. */}
          <div className="flex shrink-0 items-center gap-2 border-b-[1.5px] border-line px-3 py-2 md:gap-3 md:px-6 md:py-3">
            <IconButton label="Close export" onClick={onClose}>
              <X size={18} strokeWidth={1.8} />
            </IconButton>
            <div className="min-w-0 flex-1">
              <p className="text-eyebrow uppercase text-accent">Export</p>
              <p className="truncate text-small font-medium text-heading md:text-body">
                {project.name || "Untitled takeoff"}
              </p>
            </div>
            {/* The one clay element on screen: the modal covers the page's own. */}
            <Button variant="primary" size="sm" onClick={primary.act} className="h-10 shrink-0">
              {primary.icon}
              <span className="hidden xs:inline">{primary.label}</span>
              <span className="xs:hidden">{primary.short}</span>
            </Button>
          </div>

          {/* The format, as four equal cells in one row at every width. As
            * pills it wrapped onto two rows on a phone. */}
          <div
            role="group"
            aria-label="Export format"
            className="grid shrink-0 grid-cols-4 gap-1.5 border-b-[1.5px] border-rule px-3 py-2 md:max-w-xl md:px-6"
          >
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                title={f.title}
                aria-pressed={format === f.value}
                onClick={() => setFormat(f.value)}
                className={`h-10 truncate rounded-full border-[1.5px] border-line px-0.5 text-[13px] font-medium tracking-tight transition-colors duration-200 ease-out xs:px-1 xs:text-small xs:tracking-normal ${
                  format === f.value ? "bg-heading text-page" : "text-heading hover:bg-sunk"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {format === "pdf" ? (
            <>
              {/* Settings and preview take turns below `lg`, as two full-width
                * tabs. The preview is the default on a phone: it is what you
                * came to see, and most exports need no setting changed. */}
              <div role="tablist" aria-label="Show" className="grid shrink-0 grid-cols-2 border-b-[1.5px] border-rule lg:hidden">
                {(["preview", "settings"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={pane === p}
                    onClick={() => setPane(p)}
                    className={`h-11 border-b-2 text-small font-medium transition-colors duration-200 ease-out ${
                      pane === p ? "border-heading text-heading" : "border-transparent text-muted"
                    }`}
                  >
                    {p === "preview" ? "Preview" : "Settings"}
                  </button>
                ))}
              </div>
              {/* One row exactly as tall as the space left: each pane then owns
                * its own scrolling and neither can push the dialog taller.
                *
                * AND ONE COLUMN EXACTLY AS WIDE, for the same reason sideways.
                * Below `lg` there was no column template, so the grid made an
                * implicit `auto` column — and an auto column grows to its
                * content's min-content width. Zoomed to actual size on a phone
                * that content is the paper, 2,128px: the whole pane grew to
                * match, the viewport stopped scrolling because it was already
                * as wide as the paper, the zoom buttons slid 1,700px off
                * screen, and the fit recomputed against the new width and
                * called it 268%. `minmax(0, 1fr)` pins the column to the
                * dialog; `lg:grid-cols-12` is already minmax(0, 1fr) each,
                * which is why desktop never showed it. */}
              <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] lg:grid-cols-12">
                <div
                  className={`min-h-0 overflow-y-auto px-4 py-5 md:px-6 lg:col-span-4 lg:block lg:border-r-[1.5px] lg:border-rule ${
                    pane === "settings" ? "" : "hidden"
                  }`}
                >
                  <PdfSettings options={options} zonesExist={zonesExist} onChange={onPrintChange} />
                  <div className="mt-8 border-t-[1.5px] border-rule pt-5">
                    <Button
                      variant="quiet"
                      onClick={() => onPrintChange(() => defaultPrintOptions())}
                    >
                      <RotateCcw size={15} strokeWidth={1.6} /> Reset to the full sheet
                    </Button>
                  </div>
                </div>
                {/* No overflow here: the preview owns its own scroll viewport,
                  * which is what lets it zoom and still reach page two. */}
                <div
                  className={`min-h-0 min-w-0 flex-col bg-sunk px-2 pb-2 pt-2 md:px-6 md:py-5 lg:col-span-8 lg:flex ${
                    pane === "preview" ? "flex" : "hidden"
                  }`}
                >
                  <SheetPreview project={project} options={options} layout={layout} />
                </div>
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <p className="max-w-2xl text-body">
                {format === "csv" &&
                  "The schedule as a spreadsheet: every input and every result, with the standard, the units and the basis notes at the foot — the file explains itself a year from now."}
                {format === "working" &&
                  "The same schedule with every calculation step written out, line by line, so each figure can be checked by hand."}
                {format === "project" &&
                  "The whole takeoff as a file — every line, every setting and this export layout — to reopen here on another device or send to someone else. The same file Save writes."}
              </p>
              {textPreview && (
                <>
                  <p className="mt-5 text-small text-muted">What the file will contain</p>
                  {/* Wrapped, not scrolled sideways — CSV rows are long, and a
                    * sideways-scrolling box is the pattern this app removed
                    * everywhere else. Satoshi, not the browser's monospace:
                    * the design system has one face. */}
                  <pre className="mt-2 max-h-[55svh] overflow-y-auto whitespace-pre-wrap break-words rounded-card border-[1.5px] border-rule bg-card p-4 font-sans text-small leading-relaxed text-heading">
                    {textPreview}
                  </pre>
                </>
              )}
            </div>
          )}

        </div>
      )}
    </dialog>,
    document.body,
  );
}
