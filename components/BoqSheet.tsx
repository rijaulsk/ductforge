"use client";

import type { ReactNode } from "react";
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
  fmtMass,
  fmtRun,
  fmtValue,
  massUnit,
  runUnit,
} from "@/lib/duct/units";
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
  MARGIN_MM,
  type PrintOptions,
  TEXT_PT,
  pageMm,
} from "@/lib/export/printOptions";
import { APP_CREDIT } from "@/lib/site";

/* The issuable document.
 *
 * ONE COMPONENT, THREE USES, and that is the property the export studio rests
 * on. The same function renders the live preview in the export dialog, the
 * always-mounted print target (so Ctrl+P prints the configured sheet too), and
 * nothing else — both read the options saved on the Project, so what the
 * preview shows and what the printer produces cannot disagree.
 *
 * It is not the screen with the controls hidden. A quantity sheet that leaves
 * the building carries its own context by default: the standard, the units, the
 * allowance and every caveat. Every one of those can now be switched off for an
 * issued copy — see lib/export/printOptions.ts for the honesty rule's new shape
 * — but they all start on, and the assumptions text is still the one function
 * the CSV footer uses, so the two documents cannot drift.
 *
 * SIZES ARE `em`, all of them, off one root size (9 / 10 / 11 pt). That is what
 * lets "compact" and "large" scale the whole sheet with one number instead of a
 * second set of classes that would eventually disagree with the first.
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
 * Emitted as a `<style>` beside the print target rather than living in
 * globals.css, because the paper is a per-takeoff choice now and a stylesheet
 * cannot read it. Explicit dimensions rather than the `A4 landscape` keywords:
 * one form, the same numbers the preview uses to draw its page, so the two
 * cannot be measuring different pieces of paper.
 */
export function PrintPageStyle({ page }: { page: PrintOptions["page"] }) {
  const { w, h } = pageMm(page);
  return (
    <style>{`@media print { @page { size: ${w}mm ${h}mm; margin: ${MARGIN_MM}mm; } }`}</style>
  );
}

type Row = { entry: Entry; index: number; r: EntryResult };

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
const H2 = "mt-[1.6em] text-[1.2em] font-bold";

export default function BoqSheet({
  project,
  options,
}: {
  project: Project;
  options: PrintOptions;
}) {
  const { units: us, mode } = project;
  const { sections: on, columns: col, header, page } = options;
  const au = areaUnit(us);
  const mu = massUnit(us);
  const ru = runUnit(us);
  const totals = computeTotals(project);
  const zonesExist = hasZones(totals);
  const showRates = hasRates(project.rates);
  const showAnc = hasAncillaries(project.ancillaries);

  const rows: Row[] = project.entries.map((entry, i) => ({
    entry,
    index: i + 1,
    r: computeFor(project, entry),
  }));

  /* THE SCHEDULE'S COLUMNS, AS DATA. The sheet used to hard-code ten cells and
   * a `colSpan={showZone ? 4 : 3}` for the totals label, which is arithmetic
   * that is only right for one set of columns. With any column switchable, the
   * header, every row and the totals row are generated from the one visible
   * list instead, and the label spans whatever leading columns carry no total. */
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

  const alsoCounted =
    (showAnc || showRates) &&
    (totals.insulationAreaMinor > 0 || totals.flangeEnds > 0 || totals.supports > 0 || showRates);

  return (
    <div
      className="bg-paper text-ink"
      style={{ fontSize: `${TEXT_PT[page.text]}pt`, lineHeight: 1.35 }}
    >
      {on.letterhead && (
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
          <h1 className="mt-[0.3em] text-[1.9em] font-bold leading-tight">
            {header.title.trim() || DEFAULT_TITLE}
          </h1>
          {on.jobLine && (
            <>
              <p className="mt-[0.15em] text-[1.2em]">{project.name}</p>
              {project.reference && <p className="mt-[0.1em]">Ref {project.reference}</p>}
            </>
          )}
        </header>
      )}

      {/* Filled text always prints and empty text never does: the fields are
        * their own switch, independent of the masthead, so a client line can
        * go out on a sheet with no letterhead at all. */}
      {clientLine.length > 0 && (
        <p className="border-b border-mist py-[0.45em] text-center text-[0.95em]">
          {clientLine.join("   ·   ")}
        </p>
      )}

      {on.parameters && (
        <dl className="flex flex-wrap justify-center gap-x-[2.2em] gap-y-[0.2em] border-b border-mist py-[0.5em] text-[0.9em]">
          {params.map(([term, value]) => (
            <div key={term} className="flex gap-[0.4em]">
              <dt className="font-bold">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {header.notes.trim() && (
        <p className="mt-[0.9em] whitespace-pre-line text-[0.95em]">{header.notes.trim()}</p>
      )}

      {on.schedule && visible.length > 0 && (
        <table className="mt-[1.2em] w-full border-collapse">
          <thead>
            <tr>
              {visible.map((c) => (
                <th key={c.key} className={`${TH}${c.right ? " text-right" : ""}`}>
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              /* A line never splits across two pages. */
              <tr key={row.entry.id} className="break-inside-avoid">
                {visible.map((c) => (
                  <td
                    key={c.key}
                    className={`${TD}${c.right ? " text-right tabular-nums" : ""}`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {on.totalsRow && lead !== -1 && (
            <tfoot>
              <tr className="break-inside-avoid">
                {labelSpan > 0 && (
                  <td className={TF} colSpan={labelSpan}>
                    Total
                  </td>
                )}
                {visible.slice(labelSpan).map((c, i) => (
                  <td key={c.key} className={`${TF}${c.right ? " text-right" : ""}`}>
                    {/* With every non-total column switched off there is no
                      * cell left to hold the word, so the first figure carries
                      * it rather than the row losing its label. */}
                    {labelSpan === 0 && i === 0 ? <>Total {c.total}</> : c.total}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {on.byGauge && totals.byGauge.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className={H2}>Material by gauge</h2>
          <table className="mt-[0.5em] w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Gauge</th>
                <th className={TH}>Thickness</th>
                <th className={`${TH} text-right`}>Pieces</th>
                <th className={`${TH} text-right`}>Gross {au}</th>
                <th className={`${TH} text-right`}>Weight {mu}</th>
                {on.sheetsColumn && <th className={`${TH} text-right`}>Sheets (est.)</th>}
              </tr>
            </thead>
            <tbody>
              {totals.byGauge.map((g) => (
                <tr key={g.gauge} className="break-inside-avoid">
                  <td className={`${TD} tabular-nums`}>{g.gauge} ga</td>
                  <td className={`${TD} tabular-nums`}>{fmt(g.thicknessMm, 2)} mm</td>
                  <td className={`${TD} text-right tabular-nums`}>{g.pieces}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtArea(g.grossAreaMinor)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtMass(g.massMinor)}</td>
                  {on.sheetsColumn && (
                    <td className={`${TD} text-right tabular-nums`}>{g.sheets}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {on.byZone && zonesExist && (
        <section className="break-inside-avoid">
          <h2 className={H2}>By zone</h2>
          <table className="mt-[0.5em] w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Zone</th>
                <th className={`${TH} text-right`}>Lines</th>
                <th className={`${TH} text-right`}>Pieces</th>
                <th className={`${TH} text-right`}>Gross {au}</th>
                <th className={`${TH} text-right`}>Weight {mu}</th>
                {showRates && (
                  <th className={`${TH} text-right`}>Value {project.rates.label}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {totals.byZone.map((z) => (
                <tr key={z.zone || "__none"} className="break-inside-avoid">
                  <td className={TD}>{z.zone || "Not assigned"}</td>
                  <td className={`${TD} text-right tabular-nums`}>{z.lines}</td>
                  <td className={`${TD} text-right tabular-nums`}>{z.pieces}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtArea(z.grossAreaMinor)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtMass(z.massMinor)}</td>
                  {showRates && (
                    <td className={`${TD} text-right tabular-nums`}>{fmtValue(z.valueMinor)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {on.alsoCounted && alsoCounted && (
        <section className="break-inside-avoid">
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
      )}

      {on.basis && (
        <section>
          <h2 className={H2}>Basis of the quantities</h2>
          <ul className="mt-[0.5em] space-y-[0.25em]">
            {assumptions(project).map((a) => (
              <li key={a} className="text-[0.9em] leading-snug">
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(on.credit || on.disclaimer) && (
        <p className="mt-[1.6em] break-inside-avoid border-t border-mist pt-[0.5em] text-center text-[0.85em]">
          {on.credit && APP_CREDIT}
          {on.credit && on.disclaimer && <br />}
          {on.disclaimer &&
            "Quantities are calculated from the dimensions entered above and should be checked against the project specification before being used to order or to invoice."}
        </p>
      )}
    </div>
  );
}
