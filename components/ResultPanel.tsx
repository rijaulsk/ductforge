"use client";

import type { EntryResult } from "@/lib/duct/compute";
import { bandRange, bandFor } from "@/lib/duct/gauge";
import type { Mode } from "@/lib/duct/types";
import {
  type UnitSystem,
  areaUnit,
  densityUnit,
  PRECISION,
  fmt,
  fmtArea,
  fmtExact,
  fmtLength,
  fmtMass,
  massUnit,
} from "@/lib/duct/units";
import CalculationDetails from "./CalculationDetails";
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
        <p className="mt-2 break-words font-medium text-heading">{result.expression}</p>
        {/* The ordinary view stays commercial: formula, answer, and a way in to
          * the working. The working itself is one click away in Calculation
          * details, so the normal screen is not a maths lesson — and it is
          * formatted from the same steps the export writes. */}
        <p className="mt-2 break-words tabular-nums text-body">
          <span aria-hidden="true">≈</span>{" "}
          <span className="font-bold text-heading">
            {fmtExact(result.netEachArea, PRECISION.detail)} {au}
          </span>{" "}
          per piece, shown as {fmtArea(result.netEachMinor)} {au}
        </p>
        <div className="mt-3">
          <CalculationDetails
            steps={result.steps}
            expression={result.expression}
            standard={
              mode === "billing" ? "Commercial billing standard" : "Shop fabrication standard"
            }
            displayed={`${fmtArea(result.netAreaMinor)} ${au}`}
          />
        </div>
        <p className="mt-3 text-small text-muted">
          Largest dimension {fmtLength(result.maxDimMm, units)}{" "}
          {units === "metric" ? "mm" : "in"} — {result.gaugeAuto ? "which selects" : "would select"}{" "}
          {result.gauge} ga.
        </p>
      </div>

      {result.note && <Note>{result.note}</Note>}
    </div>
  );
}
