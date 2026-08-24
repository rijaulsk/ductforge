"use client";

import type { Totals } from "@/lib/duct/compute";
import { SPECS } from "@/lib/duct/formulas";
import {
  type UnitSystem,
  areaUnit,
  fmt,
  fmtArea,
  fmtMass,
  fromAreaMinor,
  massUnit,
} from "@/lib/duct/units";
import { Eyebrow } from "./ui";

/* Where the job's material actually is.
 *
 * Rules these charts follow, all of them learned the hard way elsewhere:
 *   · One series, one hue. Colour encodes nothing here — every bar in a chart
 *     is the same colour, because the CATEGORY is already written next to it.
 *     Clay never appears: it is the CTA colour, and a chart painted in it
 *     would blow the 2%-per-viewport ration in one glance.
 *   · The value is printed outside the bar, in a fixed-width column, so every
 *     bar starts and ends on the same two baselines and short bars stay
 *     readable.
 *   · Every number in a bar is also in the text. Nothing here is the only
 *     place a figure appears, and nothing hides in a tooltip.
 */

function Bars({
  rows,
  unit,
  empty,
}: {
  rows: { key: string; label: string; value: number; text: string }[];
  unit: string;
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (rows.length === 0 || max <= 0) {
    return <p className="text-small text-muted">{empty}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[7.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr_5.5rem]"
        >
          <span className="text-small text-body">{r.label}</span>
          <span
            className="col-span-2 h-2.5 overflow-hidden rounded-full bg-sunk sm:col-span-1"
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full bg-series-1"
              style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }}
            />
          </span>
          <span className="text-small tabular-nums text-heading sm:text-right">
            {r.text}
            <span className="ml-1 text-muted">{unit}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ChartsPanel({
  totals,
  units,
}: {
  totals: Totals;
  units: UnitSystem;
}) {
  const au = areaUnit(units);
  const mu = massUnit(units);

  const net = fromAreaMinor(totals.netAreaMinor);
  const waste = fromAreaMinor(totals.wasteAreaMinor);
  const gross = net + waste;
  const netPct = gross > 0 ? (net / gross) * 100 : 100;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <Eyebrow>Gross area by fitting type</Eyebrow>
        <div className="mt-4">
          <Bars
            unit={au}
            empty="Nothing scheduled yet."
            rows={totals.byKind.map((k) => ({
              key: k.kind,
              label: SPECS[k.kind].name,
              value: k.grossAreaMinor,
              text: fmtArea(k.grossAreaMinor),
            }))}
          />
        </div>
      </div>

      <div>
        <Eyebrow>Weight by gauge</Eyebrow>
        <div className="mt-4">
          <Bars
            unit={mu}
            empty="Nothing scheduled yet."
            rows={totals.byGauge.map((g) => ({
              key: g.gauge,
              label: `${g.gauge} ga · ${fmt(g.thicknessMm, 2)} mm`,
              value: g.massMinor,
              text: fmtMass(g.massMinor),
            }))}
          />
        </div>
      </div>

      <div className="lg:col-span-2">
        <Eyebrow>Net against allowance</Eyebrow>
        <div
          className="mt-4 flex h-4 overflow-hidden rounded-full border border-rule"
          aria-hidden="true"
        >
          <span className="bg-series-1" style={{ width: `${netPct}%` }} />
          <span className="flex-1 bg-series-3" />
        </div>
        <p className="mt-3 text-small tabular-nums text-body">
          <span className="font-medium text-heading">
            {fmtArea(totals.netAreaMinor)} {au}
          </span>{" "}
          of duct, plus{" "}
          <span className="font-medium text-heading">
            {fmtArea(totals.wasteAreaMinor)} {au}
          </span>{" "}
          of seam, flange and scrap allowance —{" "}
          <span className="font-medium text-heading">
            {fmtArea(totals.grossAreaMinor)} {au}
          </span>{" "}
          of sheet to buy.
        </p>
      </div>
    </div>
  );
}
