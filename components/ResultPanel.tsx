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
  fmtExact,
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
        {/* THE WORKING HAS TO MULTIPLY OUT.
          * Every number on this line is the one the calculation actually used,
          * at enough precision to reproduce the answer beside it. It used to
          * print whole millimetres — so an elbow whose centreline arc is
          * 1217.3671 mm showed "× 1217" next to an area computed from the real
          * arc, and anyone who checked it found it did not agree. The rounded
          * figure a schedule bills is stated separately, and labelled. */}
        <p className="mt-2 break-words text-small tabular-nums text-body">
          {result.substitution} = {fmtExact(result.netEachSquare, 2)}{" "}
          {squareLengthUnit(units)}
        </p>
        <p className="mt-1 break-words text-small tabular-nums text-body">
          = <span className="font-bold text-heading">{fmtExact(result.netEachArea, 6)} {au}</span>{" "}
          per piece
          {qty > 1 && <> × {qty} pieces = {fmtExact(result.netArea, 6)} {au}</>}
        </p>
        <p className="mt-1 text-small text-muted">
          Rounded to {fmtArea(result.netAreaMinor)} {au} for the schedule.
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
