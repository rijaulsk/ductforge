import { computeEntry, computeTotals } from "../duct/compute";
import { SPECS } from "../duct/formulas";
import type { Project } from "../duct/types";
import {
  areaUnit,
  densityUnit,
  fromAreaMinor,
  fromMassMinor,
  fromMm,
  lengthUnit,
  massUnit,
} from "../duct/units";
import { wasteDetail } from "../duct/waste";

/* CSV for spreadsheets and ERP quoting.
 *
 * TWO THINGS THIS FILE IS STRICT ABOUT.
 *
 * It writes every INPUT alongside every result. A schedule that exports only
 * areas is unauditable the moment it leaves the app: nobody can tell whether
 * the 6.72 m² was billing or shop, at what allowance, or from what dimensions.
 * So the row carries the fitting's own dimensions, the mode, the unit system,
 * the waste percentage and the gauge, and the file ends with a stated
 * assumptions block. Opened in a year, it still explains itself.
 *
 * And it quotes properly (RFC 4180) with a UTF-8 BOM, because a job reference
 * with a comma in it must not shift every column right, and because Excel
 * reads a BOM-less UTF-8 file as the system codepage and turns m² into mÂ².
 */

const BOM = "﻿";

function cell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cells: (string | number)[]) => cells.map(cell).join(",");

/** Every dimension key any fitting uses, so the columns line up across kinds. */
const DIM_COLUMNS = ["w", "h", "l", "r", "theta", "o", "f", "w1", "h1", "w2", "h2", "w3"] as const;

export function toCsv(project: Project): string {
  const { units: us, mode } = project;
  const len = lengthUnit(us);
  const lines: string[] = [];

  lines.push(row(["DuctForge takeoff"]));
  lines.push(row(["Project", project.name]));
  lines.push(row(["Reference", project.reference]));
  lines.push(row(["Exported", new Date().toISOString()]));
  lines.push(
    row([
      "Measurement standard",
      mode === "billing"
        ? "Commercial billing — mean perimeter x centreline length"
        : "Shop fabrication — true unfolded blank",
    ]),
  );
  lines.push(row(["Units", us === "metric" ? "Metric (mm, m2, kg)" : "Imperial (in, ft2, lb)"]));
  lines.push("");

  lines.push(
    row([
      "#",
      "Fitting",
      "Qty",
      ...DIM_COLUMNS.map((d) => `${d.toUpperCase()} (${d === "theta" ? "deg" : len})`),
      "Max dim",
      "Gauge",
      "Gauge source",
      `Thickness (mm)`,
      `Density (${densityUnit(us)})`,
      `Net area (${areaUnit(us)})`,
      "Waste %",
      `Gross area (${areaUnit(us)})`,
      `Weight (${massUnit(us)})`,
      "Formula",
      "Working",
      "Note",
    ]),
  );

  project.entries.forEach((entry, i) => {
    const r = computeEntry(entry, mode, us);
    const spec = SPECS[entry.fitting.kind];
    const dims = entry.fitting as unknown as Record<string, number | undefined>;
    lines.push(
      row([
        i + 1,
        spec.name,
        entry.qty,
        ...DIM_COLUMNS.map((d) => {
          const v = dims[d];
          if (v === undefined) return "";
          return d === "theta" ? v : Number(fromMm(v, us).toFixed(us === "metric" ? 1 : 3));
        }),
        Number(fromMm(r.maxDimMm, us).toFixed(us === "metric" ? 1 : 3)),
        `${r.gauge} ga`,
        r.gaugeAuto ? "table" : "manual override",
        r.thicknessMm,
        r.density,
        fromAreaMinor(r.netAreaMinor),
        entry.waste,
        fromAreaMinor(r.grossAreaMinor),
        fromMassMinor(r.massMinor),
        r.expression,
        r.substitution,
        entry.note,
      ]),
    );
  });

  const totals = computeTotals(project.entries, mode, us);

  lines.push("");
  lines.push(row(["Totals", "", totals.pieces, ...DIM_COLUMNS.map(() => "")]));
  lines.push(row(["Net area", fromAreaMinor(totals.netAreaMinor), areaUnit(us)]));
  lines.push(row(["Waste", fromAreaMinor(totals.wasteAreaMinor), areaUnit(us)]));
  lines.push(row(["Gross area", fromAreaMinor(totals.grossAreaMinor), areaUnit(us)]));
  lines.push(row(["Weight", fromMassMinor(totals.massMinor), massUnit(us)]));

  lines.push("");
  lines.push(row(["By gauge"]));
  lines.push(
    row([
      "Gauge",
      "Pieces",
      `Gross area (${areaUnit(us)})`,
      `Weight (${massUnit(us)})`,
      "Sheets (estimate)",
    ]),
  );
  for (const g of totals.byGauge) {
    lines.push(
      row([
        `${g.gauge} ga`,
        g.pieces,
        fromAreaMinor(g.grossAreaMinor),
        fromMassMinor(g.massMinor),
        g.sheets,
      ]),
    );
  }

  lines.push("");
  lines.push(row(["Stated assumptions"]));
  for (const line of assumptions(project)) lines.push(row([line]));

  return BOM + lines.join("\r\n") + "\r\n";
}

/** The caveats that travel with every number this app produces. Shared by the
 * CSV footer and the printed BOQ sheet so the two can never disagree. */
export function assumptions(project: Project): string[] {
  const detail = wasteDetail(project.waste);
  return [
    project.mode === "billing"
      ? "Areas are measured to the commercial billing standard: nominal mean perimeter x centreline length (BOQ / IS 655 / DW144 practice)."
      : "Areas are the true unfolded sheet blank, including slant hypotenuses and heel arc expansion. They are not a billing quantity.",
    `Default waste allowance ${project.waste}%${detail ? ` - ${detail}` : ""}. Individual lines may override it; each row states its own.`,
    "Gauge is selected from the largest single duct dimension only. Real SMACNA selection also depends on pressure class and reinforcement spacing - check against the project specification. Any line may override the gauge by hand.",
    "Sheet weight is bare steel at 7850 kg/m3 and excludes the galvanising coating, stiffeners, flanges, gaskets and fixings.",
    "Sheet counts are a nesting estimate: gross area divided by one 1200x2400 mm (4x8 ft) sheet, rounded up, per gauge. They ignore offcut reuse and blank shape.",
    "Reducers are calculated as concentric transitions. Y-piece shop areas develop each branch as an elbow on its own width and exclude the crotch plate.",
  ];
}
