"use client";

import {
  computeFor,
  computeTotals,
  hasAncillaries,
  hasRates,
  hasZones,
} from "@/lib/duct/compute";
import { describeFitting } from "@/lib/duct/describe";
import { SPECS } from "@/lib/duct/formulas";
import { MATERIALS } from "@/lib/duct/material";
import type { Project } from "@/lib/duct/types";
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
import { assumptions } from "@/lib/export/csv";
import { APP_CREDIT, MAKER_NAME } from "@/lib/site";

/* The issuable document.
 *
 * Only rendered on paper (`hidden print:block`), and it is not the screen with
 * the controls hidden — a quantity sheet that leaves the building has to carry
 * its own context: which standard was measured to, in what units, at what
 * allowance, and every caveat behind the gauge and the sheet count. The
 * assumptions block is the same text the CSV footer uses, from one function,
 * so the two documents can never drift apart.
 */

export default function BoqSheet({ project }: { project: Project }) {
  const { units: us, mode } = project;
  const au = areaUnit(us);
  const mu = massUnit(us);
  const ru = runUnit(us);
  const totals = computeTotals(project);
  const showZone = hasZones(totals);
  const showRates = hasRates(project.rates);
  const showAnc = hasAncillaries(project.ancillaries);
  const th = "border-b border-ink py-1.5 pr-2 text-left text-[10pt] font-bold";
  const td = "border-b border-mist py-1.5 pr-2 text-[10pt]";

  return (
    <div className="hidden print:block">
      {/* A LETTERHEAD, not a left-aligned stack.
        *
        * This is a document somebody issues, and an issued document has a
        * centred masthead with the job under it and the parameters in a ruled
        * band — that is what a title block looks like on any drawing or
        * schedule a QS has ever been handed. The old header was the same
        * information dumped left-aligned with the mark nowhere, which read as
        * a screenshot rather than a deliverable.
        *
        * The mark is inline SVG in the print colour so it survives the
        * "background graphics off" default in every browser's print dialogue —
        * a logo that disappears when somebody prints is worse than none. */}
      <header className="mb-5">
        <div className="flex flex-col items-center border-b-[1.5px] border-ink pb-4 text-center">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden="true">
              <path
                d="M0 100L0 0L100 0L100 30L50 30A20 20 0 0 0 30 50L30 100Z"
                fill="#221D17"
              />
            </svg>
            <span className="text-[11pt] font-bold tracking-tight text-ink">
              Duct<span className="font-bold">Forge</span>
            </span>
            <span className="text-[9pt] text-ink">by {MAKER_NAME}</span>
          </div>
          <h1 className="mt-3 text-[19pt] font-bold leading-tight text-ink">
            Duct takeoff schedule
          </h1>
          <p className="mt-1 text-[12pt] text-ink">{project.name}</p>
          {project.reference && (
            <p className="mt-0.5 text-[10pt] text-ink">Ref {project.reference}</p>
          )}
        </div>

        <dl className="flex flex-wrap justify-center gap-x-8 gap-y-1 border-b border-mist py-2 text-[9pt]">
          {[
            ["Date", new Date().toLocaleDateString("en-GB")],
            [
              "Standard",
              mode === "billing"
                ? "Commercial billing — mean perimeter × centreline"
                : "Shop fabrication — true unfolded blank",
            ],
            ["Units", us === "metric" ? "Metric (mm, m², kg)" : "Imperial (in, ft², lb)"],
            ["Material", MATERIALS[project.material].name],
          ].map(([term, value]) => (
            <div key={term} className="flex gap-1.5">
              <dt className="font-bold">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>#</th>
            {showZone && <th className={th}>Zone</th>}
            <th className={th}>Fitting</th>
            <th className={th}>Dimensions</th>
            <th className={`${th} text-right`}>Qty</th>
            <th className={`${th} text-right`}>Gauge</th>
            <th className={`${th} text-right`}>Net {au}</th>
            <th className={`${th} text-right`}>Waste</th>
            <th className={`${th} text-right`}>Gross {au}</th>
            <th className={`${th} text-right`}>Weight {mu}</th>
          </tr>
        </thead>
        <tbody>
          {project.entries.map((entry, i) => {
            const r = computeFor(project, entry);
            return (
              <tr key={entry.id}>
                <td className={td}>{i + 1}</td>
                {showZone && <td className={td}>{entry.zone}</td>}
                <td className={td}>
                  {SPECS[entry.fitting.kind].name}
                  {entry.note && <span className="block text-[8.5pt]">{entry.note}</span>}
                </td>
                <td className={`${td} tabular-nums`}>{describeFitting(entry.fitting, us)}</td>
                <td className={`${td} text-right tabular-nums`}>{entry.qty}</td>
                <td className={`${td} text-right tabular-nums`}>{r.gauge} ga</td>
                <td className={`${td} text-right tabular-nums`}>{fmtArea(r.netAreaMinor)}</td>
                <td className={`${td} text-right tabular-nums`}>{entry.waste}%</td>
                <td className={`${td} text-right tabular-nums`}>{fmtArea(r.grossAreaMinor)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtMass(r.massMinor)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              className="border-t-[1.5px] border-ink py-2 pr-2 text-[10pt] font-bold"
              colSpan={showZone ? 4 : 3}
            >
              Total
            </td>
            <td className="border-t-[1.5px] border-ink py-2 pr-2 text-right text-[10pt] font-bold tabular-nums">
              {totals.pieces}
            </td>
            <td className="border-t-[1.5px] border-ink" />
            <td className="border-t-[1.5px] border-ink py-2 pr-2 text-right text-[10pt] font-bold tabular-nums">
              {fmtArea(totals.netAreaMinor)}
            </td>
            <td className="border-t-[1.5px] border-ink" />
            <td className="border-t-[1.5px] border-ink py-2 pr-2 text-right text-[10pt] font-bold tabular-nums">
              {fmtArea(totals.grossAreaMinor)}
            </td>
            <td className="border-t-[1.5px] border-ink py-2 pr-2 text-right text-[10pt] font-bold tabular-nums">
              {fmtMass(totals.massMinor)}
            </td>
          </tr>
        </tfoot>
      </table>

      {totals.byGauge.length > 0 && (
        <>
          <h2 className="mt-6 text-[12pt] font-bold text-ink">Material by gauge</h2>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Gauge</th>
                <th className={th}>Thickness</th>
                <th className={`${th} text-right`}>Pieces</th>
                <th className={`${th} text-right`}>Gross {au}</th>
                <th className={`${th} text-right`}>Weight {mu}</th>
                <th className={`${th} text-right`}>Sheets (est.)</th>
              </tr>
            </thead>
            <tbody>
              {totals.byGauge.map((g) => (
                <tr key={g.gauge}>
                  <td className={`${td} tabular-nums`}>{g.gauge} ga</td>
                  <td className={`${td} tabular-nums`}>{fmt(g.thicknessMm, 2)} mm</td>
                  <td className={`${td} text-right tabular-nums`}>{g.pieces}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtArea(g.grossAreaMinor)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtMass(g.massMinor)}</td>
                  <td className={`${td} text-right tabular-nums`}>{g.sheets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {showZone && (
        <>
          <h2 className="mt-6 text-[12pt] font-bold text-ink">By zone</h2>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Zone</th>
                <th className={`${th} text-right`}>Lines</th>
                <th className={`${th} text-right`}>Pieces</th>
                <th className={`${th} text-right`}>Gross {au}</th>
                <th className={`${th} text-right`}>Weight {mu}</th>
                {showRates && (
                  <th className={`${th} text-right`}>Value {project.rates.label}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {totals.byZone.map((z) => (
                <tr key={z.zone || "__none"}>
                  <td className={td}>{z.zone || "Not assigned"}</td>
                  <td className={`${td} text-right tabular-nums`}>{z.lines}</td>
                  <td className={`${td} text-right tabular-nums`}>{z.pieces}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtArea(z.grossAreaMinor)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtMass(z.massMinor)}</td>
                  {showRates && (
                    <td className={`${td} text-right tabular-nums`}>{fmtValue(z.valueMinor)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(showAnc || showRates) && (
        <>
          <h2 className="mt-6 text-[12pt] font-bold text-ink">Also counted</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-[10pt]">
            {totals.insulationAreaMinor > 0 && (
              <div className="flex justify-between border-b border-mist py-1">
                <dt>Insulation, outer face</dt>
                <dd className="tabular-nums">
                  {fmtArea(totals.insulationAreaMinor)} {au}
                </dd>
              </div>
            )}
            {totals.flangeEnds > 0 && (
              <>
                <div className="flex justify-between border-b border-mist py-1">
                  <dt>Flange</dt>
                  <dd className="tabular-nums">
                    {fmtRun(totals.flangeRunMinor)} {ru} over {totals.flangeEnds} ends
                  </dd>
                </div>
                {totals.corners > 0 && (
                  <div className="flex justify-between border-b border-mist py-1">
                    <dt>Corner pieces</dt>
                    <dd className="tabular-nums">{totals.corners}</dd>
                  </div>
                )}
              </>
            )}
            {totals.supports > 0 && (
              <div className="flex justify-between border-b border-mist py-1">
                <dt>Hangers</dt>
                <dd className="tabular-nums">{totals.supports}</dd>
              </div>
            )}
            {showRates && (
              <div className="flex justify-between border-b border-ink py-1 font-bold">
                <dt>Value at the stated rates</dt>
                <dd className="tabular-nums">
                  {fmtValue(totals.valueMinor)} {project.rates.label}
                </dd>
              </div>
            )}
          </dl>
        </>
      )}

      <h2 className="mt-6 text-[12pt] font-bold text-ink">Basis of the quantities</h2>
      <ul className="mt-2 space-y-1">
        {assumptions(project).map((a) => (
          <li key={a} className="text-[9pt] leading-snug">
            {a}
          </li>
        ))}
      </ul>

      <p className="mt-6 border-t border-mist pt-2 text-center text-[8.5pt]">
        {APP_CREDIT}
        <br />
        Quantities are calculated from the dimensions entered above and should be checked against
        the project specification before being used to order or to invoice.
      </p>
    </div>
  );
}
