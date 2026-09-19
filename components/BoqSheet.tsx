"use client";

import { Fragment, type ReactNode } from "react";
import {
  type EntryResult,
  computeFor,
  computeTotals,
  hasAncillaries,
  hasRates,
  hasZones,
} from "@/lib/duct/compute";
import { describeFitting } from "@/lib/duct/describe";
import { SPECS } from "@/lib/duct/formulas";
import { MATERIALS } from "@/lib/duct/material";
import type { Entry, Project } from "@/lib/duct/types";
import {
  areaUnit,
  fmt,
  fmtArea,
  fmtExact,
  fmtMass,
  fmtRun,
  fmtValue,
  massUnit,
  runUnit,
  toValueMinor,
} from "@/lib/duct/units";
import { computeExtras, describeExtraSize } from "@/lib/extras";
import {
  BYLINE_PATH,
  LOGO,
  MARK_FILL_RULE,
  MARK_PATH,
  TILE,
  TILE_PATH,
  WORDMARK_PATH,
} from "@/lib/brand/logo";
import { assumptions } from "@/lib/export/csv";
import {
  type ColumnKey,
  DEFAULT_TITLE,
  type PrintOptions,
  pageMm,
} from "@/lib/export/printOptions";
import { APP_CREDIT } from "@/lib/site";

/* The issuable document, as a list of pieces.
 *
 * WHAT CHANGED, 19 Sep 2026. This used to render the whole sheet as one
 * element and leave the printer to cut it into pages wherever it liked, so the
 * preview could only guess at the breaks. It now describes the sheet as an
 * ordered list of ITEMS — whole blocks (the masthead, a note, the footer) and
 * tables whose rows can be dealt out across pages — and PagedSheet.tsx measures
 * them, packs them into pages with lib/export/paginate.ts, and draws the pages.
 * The preview and the print target draw the same pages from the same layout,
 * so what is on screen is what comes out of the printer, page for page.
 *
 * Every switch, every column rule and every size is exactly what it was: this
 * is the same sheet, only cut up.
 *
 * It is not the screen with the controls hidden. A quantity sheet that leaves
 * the building carries its own context by default: the standard, the units, the
 * allowance and every caveat. Every one of those can be switched off for an
 * issued copy — see lib/export/printOptions.ts — but they all start on, and the
 * assumptions text is still the one function the CSV footer uses, so the two
 * documents cannot drift.
 *
 * SIZES ARE `em`, all of them, off one root size (9 / 10 / 11 pt), set on the
 * page box. That is what lets "compact" and "large" scale the whole sheet with
 * one number.
 *
 * Colours are stated literally (ink, mist, paper) rather than through the theme
 * tokens: a printed sheet is ink on paper in both themes, and the preview must
 * look like the paper, not like the dark UI it sits in.
 */

/* The logo at letterhead size, with every colour named.
 *
 * The tile keeps its indigo — a printed quantity sheet is a document that
 * leaves the building, and the logo on it should be the logo. Ink and slate
 * for the type rather than the screen's accent, because those are what read on
 * paper. Sized in `em` so it scales with the chosen text size. */
function PrintLockup() {
  const inner = LOGO.tileSize * (1 - TILE.inset * 2);
  const at = LOGO.tileSize * TILE.inset;
  return (
    <svg
      viewBox={LOGO.viewBox}
      style={{ height: "2.25em", width: "auto" }}
      role="img"
      aria-label="DuctForge by DebugSwift"
    >
      <path d={TILE_PATH} fill={TILE.ground} transform={`scale(${LOGO.tileSize / 100})`} />
      <path
        d={MARK_PATH}
        fill={TILE.mark}
        fillRule={MARK_FILL_RULE}
        transform={`translate(${at} ${at}) scale(${inner / 100})`}
      />
      <path
        d={WORDMARK_PATH}
        fill="#221D17"
        transform={`translate(${LOGO.textX} ${LOGO.baseline})`}
      />
      <path
        d={BYLINE_PATH}
        fill="#5E5A53"
        transform={`translate(${LOGO.textX} ${LOGO.bylineBaseline})`}
      />
    </svg>
  );
}

/**
 * The `@page` rule for the chosen paper, stated in millimetres.
 *
 * MARGIN 0, because the margin now lives INSIDE each page box that
 * PagedSheet draws. The boxes are exactly the paper's size, so the printer is
 * handed pages that already fit and has no margin of its own to add — which is
 * what keeps its breaks on the lines this app chose. Explicit dimensions rather
 * than the `A4 landscape` keywords: the same numbers the boxes are drawn with.
 */
export function PrintPageStyle({ page }: { page: PrintOptions["page"] }) {
  const { w, h } = pageMm(page);
  return (
    <style>{`@media print { @page { size: ${w}mm ${h}mm; margin: 0; } }`}</style>
  );
}

/* ---- the pieces -------------------------------------------------------------- */

export type SheetRow = { key: string; node: ReactNode };

export type SheetItem =
  | {
      kind: "block";
      key: string;
      node: ReactNode;
      /** Items after this one that must start on the same page. */
      keepWithNext?: number;
      /** Brings the item before it when it turns a page — see paginate.ts. */
      keepWithPrevious?: boolean;
    }
  | {
      kind: "table";
      key: string;
      /** The section heading, when the table has one. */
      heading?: ReactNode;
      /** What the "(continued)" line calls it on later pages. */
      label: string;
      /** Space above the table, as padding — padding never collapses, so it
       * measures the same alone as it does in place. */
      pad: string;
      /** The header row, a `<tr>`. */
      head: ReactNode;
      rows: SheetRow[];
      /** The totals row, a `<tr>`. */
      total?: ReactNode;
    };

export type TableItem = Extract<SheetItem, { kind: "table" }>;

type Row = { entry: Entry; index: number; r: EntryResult };

/** An extras table carries a zone column only when some extra has a zone. */
const zonesExtras = (project: Project) => project.extras.some((x) => x.zone.trim() !== "");

/** A quantity as counted: whole numbers bare, metres to three places. */
const fmtQty = (q: number) => fmtExact(q, 3);

type Column = {
  key: ColumnKey;
  head: string;
  right?: boolean;
  cell: (row: Row) => ReactNode;
  /** The totals-row figure, for the columns that have one. */
  total?: ReactNode;
};

const TH = "border-b border-ink py-[0.4em] pr-[0.6em] text-left font-bold";
const TD = "border-b border-mist py-[0.4em] pr-[0.6em] align-top";
const TF = "border-t-[1.5px] border-ink py-[0.55em] pr-[0.6em] font-bold tabular-nums";
/* `text-ink` ON EVERY HEADING, not inherited from the root. The app's base
 * layer colours h1–h6 with the THEME heading colour, which is cream in dark
 * mode — so in the export preview, on white paper, every heading on the sheet
 * went invisible. Printing hid it (the print palette forces ink); the preview,
 * which is on screen, did not. */
const H2 = "mt-[1.6em] text-[1.2em] font-bold text-ink";

export function sheetItems(project: Project, options: PrintOptions): SheetItem[] {
  const { units: us, mode } = project;
  const { sections: on, columns: col, header } = options;
  const au = areaUnit(us);
  const mu = massUnit(us);
  const ru = runUnit(us);
  const totals = computeTotals(project);
  const zonesExist = hasZones(totals);
  const showRates = hasRates(project.rates);
  const showAnc = hasAncillaries(project.ancillaries);
  const items: SheetItem[] = [];

  const rows: Row[] = project.entries.map((entry, i) => ({
    entry,
    index: i + 1,
    r: computeFor(project, entry),
  }));

  /* THE SCHEDULE'S COLUMNS, AS DATA. The header, every row and the totals row
   * are generated from the one visible list, and the totals label spans
   * whatever leading columns carry no total. */
  const all: Column[] = [
    { key: "index", head: "#", cell: (row) => row.index },
    { key: "zone", head: "Zone", cell: (row) => row.entry.zone },
    {
      key: "fitting",
      head: "Fitting",
      cell: (row) => (
        <>
          {SPECS[row.entry.fitting.kind].name}
          {/* Line notes ride under the fitting name, so they share its switch
            * — the panel disables "Line notes" when "Fitting" is off. */}
          {col.notes && row.entry.note && (
            <span className="block text-[0.85em]">{row.entry.note}</span>
          )}
        </>
      ),
    },
    {
      key: "dimensions",
      head: "Dimensions",
      cell: (row) => <span className="tabular-nums">{describeFitting(row.entry.fitting, us)}</span>,
    },
    { key: "qty", head: "Qty", right: true, cell: (row) => row.entry.qty, total: totals.pieces },
    { key: "gauge", head: "Gauge", right: true, cell: (row) => `${row.r.gauge} ga` },
    {
      key: "net",
      head: `Net ${au}`,
      right: true,
      cell: (row) => fmtArea(row.r.netAreaMinor),
      total: fmtArea(totals.netAreaMinor),
    },
    { key: "waste", head: "Waste", right: true, cell: (row) => `${row.entry.waste}%` },
    {
      key: "gross",
      head: `Gross ${au}`,
      right: true,
      cell: (row) => fmtArea(row.r.grossAreaMinor),
      total: fmtArea(totals.grossAreaMinor),
    },
    {
      key: "weight",
      head: `Weight ${mu}`,
      right: true,
      cell: (row) => fmtMass(row.r.massMinor),
      total: fmtMass(totals.massMinor),
    },
  ];
  /* A zone column with no zones in the job is a column of blanks. */
  const visible = all.filter((c) => col[c.key] && (c.key !== "zone" || zonesExist));
  const lead = visible.findIndex((c) => c.total !== undefined);
  const labelSpan = lead === -1 ? visible.length : lead;

  const clientLine = [
    header.client.trim() && `Client: ${header.client.trim()}`,
    header.preparedBy.trim() && `Prepared by: ${header.preparedBy.trim()}`,
  ].filter(Boolean);

  const params: [string, string][] = [
    ...(on.date ? ([["Date", new Date().toLocaleDateString("en-GB")]] as [string, string][]) : []),
    [
      "Standard",
      mode === "billing"
        ? "Commercial billing — mean perimeter × centreline"
        : "Shop fabrication — true unfolded blank",
    ],
    ["Units", us === "metric" ? "Metric (mm, m², kg)" : "Imperial (in, ft², lb)"],
    ["Material", MATERIALS[project.material].name],
  ];

  if (on.letterhead) {
    items.push({
      kind: "block",
      key: "masthead",
      node: (
        /* A LETTERHEAD, not a left-aligned stack: a centred masthead with the
         * job under it, which is what a title block looks like on any drawing
         * or schedule a QS has ever been handed. The mark is inline SVG in the
         * print colour so it survives "background graphics off", the default
         * in every browser's print dialogue. */
        <header className="flex flex-col items-center border-b-[1.5px] border-ink pb-[1em] text-center">
          {on.logo && <PrintLockup />}
          {header.company.trim() && (
            <p className={`${on.logo ? "mt-[0.6em]" : ""} text-[1.15em] font-bold`}>
              {header.company.trim()}
            </p>
          )}
          <h1 className="mt-[0.3em] text-[1.9em] font-bold leading-tight text-ink">
            {header.title.trim() || DEFAULT_TITLE}
          </h1>
          {on.jobLine && (
            <>
              <p className="mt-[0.15em] text-[1.2em]">{project.name}</p>
              {project.reference && <p className="mt-[0.1em]">Ref {project.reference}</p>}
            </>
          )}
        </header>
      ),
    });
  }

  /* Filled text always prints and empty text never does: the fields are their
   * own switch, independent of the masthead, so a client line can go out on a
   * sheet with no letterhead at all. */
  if (clientLine.length > 0) {
    items.push({
      kind: "block",
      key: "client",
      node: (
        <p className="border-b border-mist py-[0.45em] text-center text-[0.95em]">
          {clientLine.join("   ·   ")}
        </p>
      ),
    });
  }

  if (on.parameters) {
    items.push({
      kind: "block",
      key: "parameters",
      node: (
        <dl className="flex flex-wrap justify-center gap-x-[2.2em] gap-y-[0.2em] border-b border-mist py-[0.5em] text-[0.9em]">
          {params.map(([term, value]) => (
            <div key={term} className="flex gap-[0.4em]">
              <dt className="font-bold">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ),
    });
  }

  /* Header notes are split on blank lines, so a long scope note can run over
   * a page rather than being one block too tall to place. */
  const notes = header.notes.trim();
  if (notes) {
    notes.split(/\n\s*\n/).forEach((para, i) => {
      items.push({
        kind: "block",
        key: `notes-${i}`,
        node: <p className="whitespace-pre-line pt-[0.9em] text-[0.95em]">{para}</p>,
      });
    });
  }

  if (on.schedule && visible.length > 0) {
    items.push({
      kind: "table",
      key: "schedule",
      label: "Schedule",
      pad: "1.2em",
      head: (
        <tr>
          {visible.map((c) => (
            <th key={c.key} className={`${TH}${c.right ? " text-right" : ""}`}>
              {c.head}
            </th>
          ))}
        </tr>
      ),
      rows: rows.map((row) => ({
        key: row.entry.id,
        node: (
          <tr key={row.entry.id}>
            {visible.map((c) => (
              <td key={c.key} className={`${TD}${c.right ? " text-right tabular-nums" : ""}`}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ),
      })),
      total:
        on.totalsRow && lead !== -1 ? (
          <tr>
            {labelSpan > 0 && (
              <td className={TF} colSpan={labelSpan}>
                Total
              </td>
            )}
            {visible.slice(labelSpan).map((c, i) => (
              <td key={c.key} className={`${TF}${c.right ? " text-right" : ""}`}>
                {/* With every non-total column switched off there is no cell
                  * left to hold the word, so the first figure carries it
                  * rather than the row losing its label. */}
                {labelSpan === 0 && i === 0 ? <>Total {c.total}</> : c.total}
              </td>
            ))}
          </tr>
        ) : undefined,
    });
  }

  if (on.byGauge && totals.byGauge.length > 0) {
    items.push({
      kind: "table",
      key: "gauge",
      heading: <h2 className={H2}>Material by gauge</h2>,
      label: "Material by gauge",
      pad: "0.5em",
      head: (
        <tr>
          <th className={TH}>Gauge</th>
          <th className={TH}>Thickness</th>
          <th className={`${TH} text-right`}>Pieces</th>
          <th className={`${TH} text-right`}>Gross {au}</th>
          <th className={`${TH} text-right`}>Weight {mu}</th>
          {on.sheetsColumn && <th className={`${TH} text-right`}>Sheets (est.)</th>}
        </tr>
      ),
      rows: totals.byGauge.map((g) => ({
        key: g.gauge,
        node: (
          <tr key={g.gauge}>
            <td className={`${TD} tabular-nums`}>{g.gauge} ga</td>
            <td className={`${TD} tabular-nums`}>{fmt(g.thicknessMm, 2)} mm</td>
            <td className={`${TD} text-right tabular-nums`}>{g.pieces}</td>
            <td className={`${TD} text-right tabular-nums`}>{fmtArea(g.grossAreaMinor)}</td>
            <td className={`${TD} text-right tabular-nums`}>{fmtMass(g.massMinor)}</td>
            {on.sheetsColumn && <td className={`${TD} text-right tabular-nums`}>{g.sheets}</td>}
          </tr>
        ),
      })),
    });
  }

  if (on.byZone && zonesExist) {
    items.push({
      kind: "table",
      key: "zones",
      heading: <h2 className={H2}>By zone</h2>,
      label: "By zone",
      pad: "0.5em",
      head: (
        <tr>
          <th className={TH}>Zone</th>
          <th className={`${TH} text-right`}>Lines</th>
          <th className={`${TH} text-right`}>Pieces</th>
          <th className={`${TH} text-right`}>Gross {au}</th>
          <th className={`${TH} text-right`}>Weight {mu}</th>
          {showRates && <th className={`${TH} text-right`}>Value {project.rates.label}</th>}
        </tr>
      ),
      rows: totals.byZone.map((z) => ({
        key: z.zone || "__none",
        node: (
          <tr key={z.zone || "__none"}>
            <td className={TD}>{z.zone || "Not assigned"}</td>
            <td className={`${TD} text-right tabular-nums`}>{z.lines}</td>
            <td className={`${TD} text-right tabular-nums`}>{z.pieces}</td>
            <td className={`${TD} text-right tabular-nums`}>{fmtArea(z.grossAreaMinor)}</td>
            <td className={`${TD} text-right tabular-nums`}>{fmtMass(z.massMinor)}</td>
            {showRates && (
              <td className={`${TD} text-right tabular-nums`}>{fmtValue(z.valueMinor)}</td>
            )}
          </tr>
        ),
      })),
    });
  }

  const alsoCounted =
    (showAnc || showRates) &&
    (totals.insulationAreaMinor > 0 || totals.flangeEnds > 0 || totals.supports > 0 || showRates);

  if (on.alsoCounted && alsoCounted) {
    items.push({
      kind: "block",
      key: "also",
      node: (
        <section>
          <h2 className={H2}>Also counted</h2>
          <dl className="mt-[0.5em] grid grid-cols-2 gap-x-[2.4em] gap-y-[0.2em]">
            {totals.insulationAreaMinor > 0 && (
              <div className="flex justify-between border-b border-mist py-[0.3em]">
                <dt>Insulation, outer face</dt>
                <dd className="tabular-nums">
                  {fmtArea(totals.insulationAreaMinor)} {au}
                </dd>
              </div>
            )}
            {totals.flangeEnds > 0 && (
              <>
                <div className="flex justify-between border-b border-mist py-[0.3em]">
                  <dt>Flange</dt>
                  <dd className="tabular-nums">
                    {fmtRun(totals.flangeRunMinor)} {ru} over {totals.flangeEnds} ends
                  </dd>
                </div>
                {totals.corners > 0 && (
                  <div className="flex justify-between border-b border-mist py-[0.3em]">
                    <dt>Corner pieces</dt>
                    <dd className="tabular-nums">{totals.corners}</dd>
                  </div>
                )}
              </>
            )}
            {totals.supports > 0 && (
              <div className="flex justify-between border-b border-mist py-[0.3em]">
                <dt>Hangers</dt>
                <dd className="tabular-nums">{totals.supports}</dd>
              </div>
            )}
            {showRates && (
              <div className="flex justify-between border-b border-ink py-[0.3em] font-bold">
                <dt>Value at the stated rates</dt>
                <dd className="tabular-nums">
                  {fmtValue(totals.valueMinor)} {project.rates.label}
                </dd>
              </div>
            )}
          </dl>
        </section>
      ),
    });
  }

  /* THE EXTRAS: dampers, terminals, accessories, custom lines. Their own
   * table, grouped by category under a label row, and said out loud to be
   * outside the sheet-metal figures above — a damper is counted here, never
   * added to the duct's area or weight. Rate and value appear only when some
   * line has a rate, like the schedule's own value column. */
  const extras = computeExtras(project.extras);
  if (on.extras && extras.rows.length > 0) {
    const cols = 5 + (extras.priced ? 2 : 0) + (zonesExtras(project) ? 1 : 0);
    const showZone = zonesExtras(project);
    const rowsOut: SheetRow[] = [];
    for (const cat of extras.byCategory) {
      rowsOut.push({
        key: `cat-${cat.category}`,
        node: (
          <tr key={`cat-${cat.category}`}>
            <td colSpan={cols} className="pb-[0.2em] pt-[0.7em] text-[0.85em] font-bold uppercase tracking-[0.06em]">
              {cat.label}
            </td>
          </tr>
        ),
      });
      for (const r of extras.rows.filter((x) => x.extra.category === cat.category)) {
        const x = r.extra;
        rowsOut.push({
          key: x.id,
          node: (
            <tr key={x.id}>
              <td className={TD}>{r.index}</td>
              {showZone && <td className={TD}>{x.zone}</td>}
              <td className={TD}>
                {x.item}
                {x.note && <span className="block text-[0.85em]">{x.note}</span>}
              </td>
              <td className={`${TD} tabular-nums`}>{describeExtraSize(x, us)}</td>
              <td className={`${TD} text-right tabular-nums`}>{fmtQty(x.qty)}</td>
              <td className={TD}>{x.unit}</td>
              {extras.priced && (
                <>
                  <td className={`${TD} text-right tabular-nums`}>{x.rate > 0 ? fmtValue(toValueMinor(x.rate)) : ""}</td>
                  <td className={`${TD} text-right tabular-nums`}>{r.valueMinor ? fmtValue(r.valueMinor) : ""}</td>
                </>
              )}
            </tr>
          ),
        });
      }
    }
    items.push({
      kind: "table",
      key: "extras",
      heading: (
        <div>
          <h2 className={H2}>Dampers, terminals and accessories</h2>
          <p className="mt-[0.2em] text-[0.85em] text-slate">
            Counted items. Not included in the sheet-metal area or weight above.
          </p>
        </div>
      ),
      label: "Dampers, terminals and accessories",
      pad: "0.5em",
      head: (
        <tr>
          <th className={TH}>#</th>
          {showZone && <th className={TH}>Zone</th>}
          <th className={TH}>Item</th>
          <th className={TH}>Size ({us === "metric" ? "mm" : "in"})</th>
          <th className={`${TH} text-right`}>Qty</th>
          <th className={TH}>Unit</th>
          {extras.priced && (
            <>
              <th className={`${TH} text-right`}>Rate {project.rates.label}</th>
              <th className={`${TH} text-right`}>Value {project.rates.label}</th>
            </>
          )}
        </tr>
      ),
      rows: rowsOut,
      total: extras.priced ? (
        <tr>
          <td className={TF} colSpan={cols - 1}>
            Total, {extras.rows.length} {extras.rows.length === 1 ? "item" : "items"}
          </td>
          <td className={`${TF} text-right`}>{fmtValue(extras.valueMinor)}</td>
        </tr>
      ) : undefined,
    });
  }

  if (on.basis) {
    /* One block per note, so the basis can run over a page; the heading keeps
     * its first note with it. */
    items.push({
      kind: "block",
      key: "basis",
      keepWithNext: 1,
      node: <h2 className={`${H2} pb-[0.25em]`}>Basis of the quantities</h2>,
    });
    assumptions(project).forEach((a, i) => {
      items.push({
        kind: "block",
        key: `basis-${i}`,
        node: <p className="pt-[0.25em] text-[0.9em] leading-snug">{a}</p>,
      });
    });
  }

  if (on.credit || on.disclaimer) {
    items.push({
      kind: "block",
      key: "credit",
      /* Two lines of credit alone on a last page is a page printed for
       * nothing; it takes the last note over with it instead. */
      keepWithPrevious: true,
      node: (
        <p className="mt-[1.6em] border-t border-mist pt-[0.5em] text-center text-[0.85em]">
          {on.credit && APP_CREDIT}
          {on.credit && on.disclaimer && <br />}
          {on.disclaimer &&
            "Quantities are calculated from the dimensions entered above and should be checked against the project specification before being used to order or to invoice."}
        </p>
      ),
    });
  }

  return items;
}

/* ---- drawing the pieces -------------------------------------------------------
 *
 * Each piece is wrapped in a `flow-root` box, in the measurer and on the page
 * alike. A flow root contains its children's margins, so a heading's top
 * margin is inside the box that was measured instead of collapsing into its
 * neighbour on one side and not the other — and the heights add up on the page
 * exactly as they were measured.
 */

export function SheetBlock({ node }: { node: ReactNode }) {
  return <div className="flow-root">{node}</div>;
}

export function TableHeading({ item }: { item: TableItem }) {
  return <div className="flow-root">{item.heading}</div>;
}

/** The line a table prints above its header row on every page after its first. */
export function TableContinued({ item }: { item: TableItem }) {
  return (
    <div className="flow-root">
      <p className="pt-[0.6em] text-[0.85em] italic text-slate">{item.label} (continued)</p>
    </div>
  );
}

/**
 * A table, or the part of one that falls on a page.
 *
 * `cols` are the column widths measured from the WHOLE table. An auto-layout
 * table sizes its columns to the rows it holds, so the rows dealt to page 2
 * would size page 2's columns differently — different wrapping, different row
 * heights, and the measurements the page was packed with would stop being
 * true. Fixed layout at the widths of the whole table keeps every part of it
 * the same shape as the table that was measured.
 */
export function SheetTable({
  item,
  rows,
  total,
  cols,
}: {
  item: TableItem;
  rows: SheetRow[];
  total: boolean;
  cols?: number[];
}) {
  return (
    <div className="flow-root" style={{ paddingTop: item.pad }}>
      <table
        className="w-full border-collapse"
        style={cols ? { tableLayout: "fixed" } : undefined}
      >
        {cols && (
          <colgroup>
            {cols.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        )}
        <thead>{item.head}</thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.key}>{r.node}</Fragment>
          ))}
        </tbody>
        {total && item.total && <tfoot>{item.total}</tfoot>}
      </table>
    </div>
  );
}
