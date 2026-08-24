"use client";

import type { Totals as TotalsData } from "@/lib/duct/compute";
import { type UnitSystem, areaUnit, fmt, fmtArea, fmtMass, massUnit } from "@/lib/duct/units";
import { Note, Stat } from "./ui";

/* The bottom line, and the purchase order under it.
 *
 * Sheet counts are grouped by gauge and never totalled into one number that
 * looks orderable: 22 ga cannot be cut out of a 24 ga sheet, so "41 sheets" on
 * its own would be a figure with no meaning at a merchant's counter.
 */

export default function Totals({
  totals,
  units,
}: {
  totals: TotalsData;
  units: UnitSystem;
}) {
  const au = areaUnit(units);
  const mu = massUnit(units);
  const sheetLabel = units === "metric" ? "1200 × 2400 mm" : "4 × 8 ft";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Stat
          label="Net area"
          value={fmtArea(totals.netAreaMinor)}
          unit={au}
          sub={`${totals.lines} ${totals.lines === 1 ? "line" : "lines"}, ${totals.pieces} ${
            totals.pieces === 1 ? "piece" : "pieces"
          }`}
        />
        <Stat
          label="Waste allowance"
          value={fmtArea(totals.wasteAreaMinor)}
          unit={au}
          sub={
            totals.netAreaMinor > 0
              ? `${fmt((totals.wasteAreaMinor / totals.netAreaMinor) * 100, 1)}% of net`
              : undefined
          }
        />
        <Stat label="Gross area" value={fmtArea(totals.grossAreaMinor)} unit={au} sub="material to buy" />
        <Stat label="Sheet weight" value={fmtMass(totals.massMinor)} unit={mu} sub="bare steel" />
      </div>

      {totals.byGauge.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Material by gauge</caption>
            <thead>
              <tr className="border-b-[1.5px] border-line text-small">
                <th scope="col" className="py-2.5 pr-3 font-medium text-body">
                  Gauge
                </th>
                <th scope="col" className="py-2.5 pr-3 text-right font-medium text-body">
                  Pieces
                </th>
                <th scope="col" className="py-2.5 pr-3 text-right font-medium text-body">
                  Gross {au}
                </th>
                <th scope="col" className="py-2.5 pr-3 text-right font-medium text-body">
                  Weight {mu}
                </th>
                <th scope="col" className="py-2.5 text-right font-medium text-body">
                  Sheets
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.byGauge.map((g) => (
                <tr key={g.gauge} className="border-b border-rule">
                  <th scope="row" className="py-2.5 pr-3 font-medium tabular-nums text-heading">
                    {g.gauge} ga
                    <span className="ml-2 font-normal text-small text-muted">
                      {fmt(g.thicknessMm, 2)} mm
                    </span>
                  </th>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-heading">{g.pieces}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-heading">
                    {fmtArea(g.grossAreaMinor)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-heading">
                    {fmtMass(g.massMinor)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-heading">
                    {g.sheets}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Note label="Sheets">
        A nesting estimate only: gross area divided by one {sheetLabel} sheet, rounded up, per
        gauge. It takes no account of offcut reuse or of blanks that do not tile.
      </Note>
    </div>
  );
}
