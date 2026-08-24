"use client";

import type { EntryResult } from "@/lib/duct/compute";
import { bandRange, bandFor } from "@/lib/duct/gauge";
import type { Mode } from "@/lib/duct/types";
import {
  type UnitSystem,
  areaUnit,
  densityUnit,
  fmt,
  fmtArea,
  fmtLength,
  fmtMass,
  massUnit,
  squareLengthUnit,
} from "@/lib/duct/units";
import { Note, Stat } from "./ui";

/* What the numbers are, and where they came from.
 *
 * The working line is not decoration. Everything else on this screen is a
 * result the user has to take on trust; the substituted formula is the one
 * thing they can check with the calculator on their desk. It is why the
 * formula registry hands back a substituted string rather than just a number.
 */

export default function ResultPanel({
  result,
  units,
  mode,
  qty,
  waste,
}: {
  result: EntryResult;
  units: UnitSystem;
  mode: Mode;
  qty: number;
  waste: number;
}) {
  const au = areaUnit(units);
  const band = bandFor(result.gauge);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Stat
          label="Net area"
          value={fmtArea(result.netAreaMinor)}
          unit={au}
          sub={qty > 1 ? `${fmtArea(result.netEachMinor)} ${au} each × ${qty}` : undefined}
        />
        <Stat
          label="Gross area"
          value={fmtArea(result.grossAreaMinor)}
          unit={au}
          sub={`net + ${fmt(waste, waste % 1 === 0 ? 0 : 1)}% allowance`}
        />
        <Stat
          label="Gauge"
          value={`${result.gauge} ga`}
          sub={`${fmt(band.thicknessMm, 2)} mm · ${result.gaugeAuto ? bandRange(band, units) : "manual override"}`}
        />
        <Stat
          label="Weight"
          value={fmtMass(result.massMinor)}
          unit={massUnit(units)}
          sub={`at ${fmt(result.density, units === "metric" ? 2 : 3)} ${densityUnit(units)}`}
        />
      </div>

      <div className="rounded-card border-[1.5px] border-rule bg-sunk p-4">
        <p className="text-eyebrow uppercase text-accent">
          {mode === "billing" ? "Commercial billing standard" : "Shop fabrication standard"}
        </p>
        <p className="mt-2 font-medium text-heading">{result.expression}</p>
        <p className="mt-2 break-words text-small tabular-nums text-body">
          {result.substitution} = {fmt(result.netEachSquare, 0)} {squareLengthUnit(units)} ={" "}
          <span className="font-bold text-heading">
            {fmtArea(result.netEachMinor)} {au}
          </span>{" "}
          per piece
        </p>
        <p className="mt-2 text-small text-muted">
          Largest dimension {fmtLength(result.maxDimMm, units)}{" "}
          {units === "metric" ? "mm" : "in"} — {result.gaugeAuto ? "which selects" : "would select"}{" "}
          {result.gauge} ga.
        </p>
      </div>

      {result.note && <Note>{result.note}</Note>}
    </div>
  );
}
