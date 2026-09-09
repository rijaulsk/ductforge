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
import RefTable from "./RefTable";

/* The bottom line, and the purchase order under it.
 *
 * Sheet counts are grouped by gauge and never totalled into one number that
 * looks orderable: 22 ga cannot be cut out of a 24 ga sheet, so "41 sheets" on
 * its own would be a figure with no meaning at a merchant's counter.
 */

/* The two summaries below were `overflow-x-auto` at every width: "Material by
 * gauge" is five columns and "By zone" up to six, so at 320px the gauge table
 * hid 62px of itself — a purchase quantity you had to swipe a table to find.
 * They render through RefTable now, which stacks them instead. */

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
        <RefTable
          dense
          rightAlign={[1, 2, 3, 4, 5]}
          caption="Quantities by zone"
          cols={[
            "Zone",
            "Lines",
            "Pieces",
            `Gross ${au}`,
            `Weight ${mu}`,
            ...(showRates ? [`Value ${project.rates.label}`] : []),
          ]}
          rows={totals.byZone.map((z) => ({
            key: z.zone || "__none",
            head: z.zone || <span className="font-normal text-muted">Not assigned</span>,
            cells: [
              z.lines,
              z.pieces,
              fmtArea(z.grossAreaMinor),
              fmtMass(z.massMinor),
              ...(showRates ? [fmtValue(z.valueMinor)] : []),
            ],
          }))}
        />
      )}

      {totals.byGauge.length > 0 && (
        <RefTable
          dense
          rightAlign={[1, 2, 3, 4]}
          caption="Material by gauge"
          cols={["Gauge", "Pieces", `Gross ${au}`, `Weight ${mu}`, "Sheets"]}
          rows={totals.byGauge.map((g) => ({
            key: String(g.gauge),
            head: (
              <span className="tabular-nums">
                {g.gauge} ga
                <span className="ml-2 font-normal text-small text-muted">
                  {fmt(g.thicknessMm, 2)} mm
                </span>
              </span>
            ),
            cells: [g.pieces, fmtArea(g.grossAreaMinor), fmtMass(g.massMinor), g.sheets],
          }))}
        />
      )}

      <Note label="Sheets">
        A nesting estimate only: gross area divided by one {sheetLabel} sheet, rounded up, per
        gauge. It takes no account of offcut reuse or of blanks that do not tile.
      </Note>
    </div>
  );
}
