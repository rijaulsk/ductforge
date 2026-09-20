"use client";

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Project } from "@/lib/duct/types";
import { type Page, type PackItem, packPages } from "@/lib/export/paginate";
import {
  MARGIN_MM,
  PX_PER_MM,
  type PrintOptions,
  TEXT_PT,
  contentMm,
  pageMm,
} from "@/lib/export/printOptions";
import {
  type SheetItem,
  SheetBlock,
  SheetTable,
  TableContinued,
  TableHeading,
  type TableItem,
  sheetItems,
} from "./BoqSheet";

/* The sheet, as pages.
 *
 * Two halves. `SheetMeasurer` renders every piece of the sheet once, off
 * screen, at the exact printable width and text size, measures it, and packs
 * the measurements into pages (lib/export/paginate.ts). `PagedSheet` then draws
 * those pages as boxes the exact size of the paper, with the margin inside.
 *
 * THE MEASURER LIVES ONCE, IN WORKSPACE, and the layout it produces is handed
 * to both the export preview and the always-mounted print target. The print
 * target is `display: none` until the moment of printing, and a hidden element
 * has no size to measure — if it tried to paginate itself it would pack
 * everything onto one page of nothing. One measurement, two drawings of it, and
 * the preview cannot disagree with the paper.
 */

export type SheetLayout = {
  pages: Page[];
  /** Column widths of each table, measured whole — see SheetTable. */
  cols: Record<string, number[]>;
};

/* A couple of pixels of headroom per page. The heights are summed from
 * separately measured pieces, and sub-pixel rounding in a collapsed-border table
 * can make the sum a hair short of the real thing; a page packed to the last
 * pixel would then push its bottom row's border into the margin. */
const SLACK_PX = 3;

/** The running footer's line, in ems of the sheet's root size — one line of
 * 0.75em type plus the air above it. Reserved out of every page. */
const FOOTER_EM = 1.9;

const PX_PER_PT = 96 / 72;

const sheetStyle = (options: PrintOptions) => ({
  fontSize: `${TEXT_PT[options.page.text]}pt`,
  lineHeight: 1.35,
});

export function SheetMeasurer({
  project,
  options,
  onLayout,
}: {
  project: Project;
  options: PrintOptions;
  onLayout: (layout: SheetLayout) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const items = useMemo(() => sheetItems(project, options), [project, options]);
  const last = useRef("");
  const content = contentMm(options.page);
  /* The page numbers sit at the foot of the content box now (the browser owns
   * the paper margin), so their height comes off what a page can hold. */
  const footer = options.sections.pageNumbers ? FOOTER_EM * TEXT_PT[options.page.text] * PX_PER_PT : 0;
  const contentH = content.h * PX_PER_MM - footer - SLACK_PX;

  const measure = useCallback(() => {
    const root = ref.current;
    /* Hidden (print media, or not laid out yet): a zero-width measurement is
     * not a measurement, and packing it would collapse the sheet. */
    if (!root || root.offsetWidth === 0) return;
    const height = (el: Element | null) => (el ? el.getBoundingClientRect().height : 0);
    const cols: Record<string, number[]> = {};

    const pack: PackItem[] = items.map((item) => {
      const box = root.querySelector(`[data-item="${CSS.escape(item.key)}"]`);
      if (item.kind === "block") {
        return {
          kind: "block",
          key: item.key,
          height: height(box),
          keepWithNext: item.keepWithNext,
          keepWithPrevious: item.keepWithPrevious,
        };
      }

      const wrap = box?.querySelector("[data-part=table]");
      const tbody = wrap?.querySelector("tbody");
      const thead = wrap?.querySelector("thead");
      const top = wrap?.getBoundingClientRect().top ?? 0;
      const bottom = wrap?.getBoundingClientRect().bottom ?? 0;
      const bodyTop = tbody?.getBoundingClientRect().top ?? bottom;
      const bodyBottom = tbody?.getBoundingClientRect().bottom ?? bottom;
      /* Rows by the distance between their tops — in a collapsed-border table
       * that is the space each row really takes, shared border and all. */
      const trs = [...(tbody?.children ?? [])];
      const tops = trs.map((tr) => tr.getBoundingClientRect().top);
      const rows = item.rows.map((row, i) => ({
        key: row.key,
        height: (i + 1 < tops.length ? tops[i + 1] : bodyBottom) - (tops[i] ?? bodyTop),
      }));
      cols[item.key] = [...(thead?.querySelector("tr")?.children ?? [])].map(
        (th) => th.getBoundingClientRect().width,
      );
      return {
        kind: "table",
        key: item.key,
        heading: height(box?.querySelector("[data-part=heading]") ?? null),
        head: bodyTop - top,
        rows,
        total: item.total ? bottom - bodyBottom : 0,
      };
    });

    const continued = height(root.querySelector("[data-part=continued]"));
    const layout: SheetLayout = { pages: packPages(pack, contentH, continued), cols };
    const sig = JSON.stringify(layout);
    if (sig !== last.current) {
      last.current = sig;
      onLayout(layout);
    }
  }, [items, contentH, onLayout]);

  /* Before paint, so a change never shows one frame of the old pages. */
  useLayoutEffect(measure, [measure]);

  /* And again when anything changes size without React knowing: the web font
   * arriving (Satoshi is wider than the fallback, so rows re-wrap), or the
   * sheet's width changing with the paper. */
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let live = true;
    document.fonts?.ready.then(() => live && measure());
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [measure]);

  const sample: TableItem = { kind: "table", key: "__sample", label: "Schedule", pad: "0", head: null, rows: [] };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-[-20000px] top-0 bg-paper text-ink print:hidden"
      style={{ width: `${content.w}mm`, visibility: "hidden", ...sheetStyle(options) }}
    >
      {items.map((item) =>
        item.kind === "block" ? (
          <div key={item.key} data-item={item.key}>
            <SheetBlock node={item.node} />
          </div>
        ) : (
          <div key={item.key} data-item={item.key}>
            {item.heading && (
              <div data-part="heading">
                <TableHeading item={item} />
              </div>
            )}
            <div data-part="table">
              <SheetTable item={item} rows={item.rows} total />
            </div>
          </div>
        ),
      )}
      <div data-part="continued">
        <TableContinued item={sample} />
      </div>
    </div>
  );
}

/**
 * The pages themselves.
 *
 * `wrap` lets the preview put each page in its own scaled frame; the print
 * target draws them bare. Without a layout yet (the first frame, before the
 * measurer has run) the whole sheet goes on one page rather than nothing.
 */
export function PagedSheet({
  project,
  options,
  layout,
  wrap,
  paper = false,
}: {
  project: Project;
  options: PrintOptions;
  layout: SheetLayout | null;
  wrap?: (page: ReactNode, index: number, count: number) => ReactNode;
  /** Draw the paper margin around each page — the preview does, paper doesn't. */
  paper?: boolean;
}) {
  const items = useMemo(() => sheetItems(project, options), [project, options]);
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i] as const)), [items]);
  const { w, h } = pageMm(options.page);
  const content = contentMm(options.page);

  const pages: Page[] = layout?.pages ?? [
    items.map((i) =>
      i.kind === "block"
        ? { kind: "block", key: i.key }
        : { kind: "table", key: i.key, heading: true, continued: false, rows: i.rows.map((r) => r.key), total: true },
    ),
  ];
  const count = pages.length;
  const job = [project.name, project.reference && `Ref ${project.reference}`].filter(Boolean).join(" · ");

  return (
    <>
      {pages.map((parts, i) => {
        /* THE BOX IS THE PRINTABLE AREA, not the sheet: the browser adds the
         * margin from `@page` (see PrintPageStyle). The preview wraps this in
         * paper of its own below, so what is on screen is still a page. */
        const box = (
          <div
            className="sheet-page relative overflow-hidden bg-paper text-ink"
            style={{
              width: `${content.w}mm`,
              height: `${content.h}mm`,
              ...sheetStyle(options),
            }}
          >
            {parts.map((part) => {
              const item = byKey.get(part.key) as SheetItem | undefined;
              if (!item) return null;
              if (part.kind === "block" || item.kind === "block") {
                return item.kind === "block" ? <SheetBlock key={part.key} node={item.node} /> : null;
              }
              const rows = item.rows.filter((r) => part.rows.includes(r.key));
              return (
                <div key={`${part.key}-${i}`}>
                  {part.heading && item.heading && <TableHeading item={item} />}
                  {part.continued && <TableContinued item={item} />}
                  <SheetTable item={item} rows={rows} total={part.total} cols={layout?.cols[item.key]} />
                </div>
              );
            })}
            {/* At the foot of the content box, in the room reserved for it when
              * the pages were packed. */}
            {options.sections.pageNumbers && (
              <div
                className="absolute inset-x-0 bottom-0 flex justify-between gap-[1em] text-[0.75em] text-slate"
              >
                <span className="truncate">{job}</span>
                <span className="shrink-0 tabular-nums">
                  Page {i + 1} of {count}
                </span>
              </div>
            )}
          </div>
        );
        /* On screen the box gets its paper back: the same margin the printer
         * will add, drawn, so the preview is a picture of the sheet. On paper
         * the box goes out bare — the margin is the printer's. */
        const page = paper ? (
          <div
            className="bg-paper"
            style={{ width: `${w}mm`, height: `${h}mm`, padding: `${MARGIN_MM}mm` }}
          >
            {box}
          </div>
        ) : (
          box
        );
        /* The slot, not the page, carries the print break — see globals.css —
         * so the preview's frame around a page cannot change where it breaks. */
        return (
          <div key={i} className="sheet-page-slot">
            {wrap ? wrap(page, i, count) : page}
          </div>
        );
      })}
    </>
  );
}
