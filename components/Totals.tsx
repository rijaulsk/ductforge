"use client";

import {
  type Totals as TotalsData,
  hasAncillaries,
  hasRates,
  hasZones,
} from "@/lib/duct/compute";
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
import { Eyebrow, Note, Stat } from "./ui";

/* The bottom line, and the purchase order under it.
 *
 * Sheet counts are grouped by gauge and never totalled into one number that
 * looks orderable: 22 ga cannot be cut out of a 24 ga sheet, so "41 sheets" on
 * its own would be a figure with no meaning at a merchant's counter.
 */

export default function Totals({
  totals,
  project,
}: {
  totals: TotalsData;
  project: Project;
}) {
  const units = project.units;
  const au = areaUnit(units);
  const mu = massUnit(units);
  const ru = runUnit(units);
  const sheetLabel = units === "metric" ? "1200 × 2400 mm" : "4 × 8 ft";
  const showRates = hasRates(project.rates);
  const showAncillaries = hasAncillaries(project.ancillaries);
  const showZones = hasZones(totals);

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
        <Stat
          label="Sheet weight"
          value={fmtMass(totals.massMinor)}
          unit={mu}
          sub={MATERIALS[project.material].name.toLowerCase()}
        />
      </div>

      {showRates && (
        <div className="rounded-card border-[1.5px] border-rule bg-sunk p-5">
          <Stat
            label="Value at your rates"
            value={fmtValue(totals.valueMinor)}
            unit={project.rates.label || undefined}
            sub={[
              project.rates.perKg > 0
                ? `${fmt(project.rates.perKg, 2)} per ${mu}`
                : null,
              project.rates.perM2 > 0 ? `${fmt(project.rates.perM2, 2)} per ${au}` : null,
            ]
              .filter(Boolean)
              .join(" + ")}
          />
        </div>
      )}

      {showAncillaries && (
        <div>
          <Eyebrow>Also counted</Eyebrow>
          <div className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {totals.insulationAreaMinor > 0 && (
              <Stat
                label="Insulation"
                value={fmtArea(totals.insulationAreaMinor)}
                unit={au}
                sub="outer face"
              />
            )}
            {totals.flangeEnds > 0 && (
              <>
                <Stat
                  label="Flange"
                  value={fmtRun(totals.flangeRunMinor)}
                  unit={ru}
                  sub={`${totals.flangeEnds} ends`}
                />
                {totals.corners > 0 && (
                  <Stat
                    label="Corner pieces"
                    value={String(totals.corners)}
                    sub="four per rectangular end"
                  />
                )}
              </>
            )}
            {totals.supports > 0 && (
              <Stat label="Hangers" value={String(totals.supports)} sub="one per piece, plus spacing" />
            )}
          </div>
        </div>
      )}

      {showZones && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Quantities by zone</caption>
            <thead>
              <tr className="border-b-[1.5px] border-line text-small">
                <th scope="col" className="py-2.5 pr-3 font-medium text-body">
                  Zone
                </th>
                <th scope="col" className="py-2.5 pr-3 text-right font-medium text-body">
                  Lines
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
                {showRates && (
                  <th scope="col" className="py-2.5 text-right font-medium text-body">
                    Value {project.rates.label}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {totals.byZone.map((z) => (
                <tr key={z.zone || "__none"} className="border-b border-rule">
                  <th scope="row" className="py-2.5 pr-3 font-medium text-heading">
                    {z.zone || <span className="font-normal text-muted">Not assigned</span>}
                  </th>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-heading">{z.lines}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-heading">{z.pieces}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-heading">
                    {fmtArea(z.grossAreaMinor)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-heading">
                    {fmtMass(z.massMinor)}
                  </td>
                  {showRates && (
                    <td className="py-2.5 text-right font-medium tabular-nums text-heading">
                      {fmtValue(z.valueMinor)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
