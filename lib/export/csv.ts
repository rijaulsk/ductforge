import { computeFor, computeTotals } from "../duct/compute";
import { describeFitting } from "../duct/describe";
import { SPECS } from "../duct/formulas";
import { MATERIALS } from "../duct/material";
import type { Project } from "../duct/types";
import {
  PRECISION,
  type UnitSystem,
  areaUnit,
  densityUnit,
  fmtExact,
  fromAreaMinor,
  fromMassMinor,
  fromMm,
  fromRunMinor,
  fromValueMinor,
  lengthUnit,
  massUnit,
  runUnit,
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
const DIM_COLUMNS = [
  "w",
  "h",
  "l",
  "r",
  "theta",
  "o",
  "f",
  "w1",
  "h1",
  "w2",
  "h2",
  "w3",
  "d",
  "d1",
  "d2",
  "gores",
] as const;

/**
 * A dimension, for the file rather than the screen.
 *
 * Six decimals, not the one or three the screen shows. An exported dimension
 * is an INPUT — somebody will read it back, or re-enter it — and rounding an
 * imperial width to three decimals loses about a thousandth of a millimetre
 * every time the file goes round. Six is exact to twenty-five nanometres and
 * still reads as a number.
 */
function exportLength(mm: number, us: UnitSystem): number {
  return Number(fromMm(mm, us).toFixed(6));
}

function dimUnit(key: string, len: string): string {
  if (key === "theta") return "deg";
  if (key === "gores") return "count";
  return len;
}

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

  lines.push(row(["Material", MATERIALS[project.material].name]));
  if (project.ancillaries.insulationMm > 0) {
    lines.push(row(["Insulation", `${project.ancillaries.insulationMm} mm on the outer face`]));
  }
  lines.push("");

  lines.push(
    row([
      "#",
      "Zone",
      "Fitting",
      "Qty",
      ...DIM_COLUMNS.map((d) => `${d.toUpperCase()} (${dimUnit(d, len)})`),
      "Max dim",
      "Gauge",
      "Gauge source",
      `Thickness (mm)`,
      `Density (${densityUnit(us)})`,
      `Net area (${areaUnit(us)})`,
      "Waste %",
      `Gross area (${areaUnit(us)})`,
      `Weight (${massUnit(us)})`,
      `Insulation (${areaUnit(us)})`,
      "Pieces",
      "Flange ends",
      `Flange (${runUnit(us)})`,
      "Corners",
      "Hangers",
      `Value (${project.rates.label || "rate"})`,
      "Formula",
      "Working",
      "Note",
    ]),
  );

  project.entries.forEach((entry, i) => {
    const r = computeFor(project, entry);
    const spec = SPECS[entry.fitting.kind];
    const dims = entry.fitting as unknown as Record<string, number | undefined>;
    lines.push(
      row([
        i + 1,
        entry.zone,
        spec.name,
        entry.qty,
        ...DIM_COLUMNS.map((d) => {
          const v = dims[d];
          if (v === undefined) return "";
          /* Angles and counts are not lengths and must not be converted. */
          if (d === "theta" || d === "gores") return v;
          return exportLength(v, us);
        }),
        exportLength(r.maxDimMm, us),
        `${r.gauge} ga`,
        r.gaugeAuto ? (r.gaugeCaveat ? "table (rectangular, see notes)" : "table") : "manual override",
        r.thicknessMm,
        r.density,
        fromAreaMinor(r.netAreaMinor),
        entry.waste,
        fromAreaMinor(r.grossAreaMinor),
        fromMassMinor(r.massMinor),
        r.insulationAreaMinor ? fromAreaMinor(r.insulationAreaMinor) : "",
        r.pieces,
        r.flangeEnds || "",
        r.flangeRunMinor ? fromRunMinor(r.flangeRunMinor) : "",
        r.corners || "",
        r.supports || "",
        r.valueMinor ? fromValueMinor(r.valueMinor) : "",
        r.expression,
        r.substitution,
        entry.note,
      ]),
    );
  });

  const totals = computeTotals(project);

  lines.push("");
  lines.push(row(["Totals"]));
  lines.push(row(["Pieces", totals.pieces]));
  lines.push(row(["Net area", fromAreaMinor(totals.netAreaMinor), areaUnit(us)]));
  lines.push(row(["Waste", fromAreaMinor(totals.wasteAreaMinor), areaUnit(us)]));
  lines.push(row(["Gross area", fromAreaMinor(totals.grossAreaMinor), areaUnit(us)]));
  lines.push(row(["Weight", fromMassMinor(totals.massMinor), massUnit(us)]));
  if (totals.insulationAreaMinor > 0) {
    lines.push(row(["Insulation", fromAreaMinor(totals.insulationAreaMinor), areaUnit(us)]));
  }
  if (totals.flangeEnds > 0) {
    lines.push(row(["Flange ends", totals.flangeEnds]));
    lines.push(row(["Flange", fromRunMinor(totals.flangeRunMinor), runUnit(us)]));
    if (totals.corners > 0) lines.push(row(["Corner pieces", totals.corners]));
  }
  if (totals.supports > 0) lines.push(row(["Hangers", totals.supports]));
  if (totals.valueMinor > 0) {
    lines.push(row(["Value", fromValueMinor(totals.valueMinor), project.rates.label]));
  }

  if (totals.byZone.some((z) => z.zone !== "")) {
    lines.push("");
    lines.push(row(["By zone"]));
    lines.push(
      row([
        "Zone",
        "Lines",
        "Pieces",
        `Gross area (${areaUnit(us)})`,
        `Weight (${massUnit(us)})`,
        `Value (${project.rates.label || "rate"})`,
      ]),
    );
    for (const z of totals.byZone) {
      lines.push(
        row([
          z.zone || "Not assigned",
          z.lines,
          z.pieces,
          fromAreaMinor(z.grossAreaMinor),
          fromMassMinor(z.massMinor),
          z.valueMinor ? fromValueMinor(z.valueMinor) : "",
        ]),
      );
    }
  }

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

/**
 * The detailed calculation report.
 *
 * NOT a second calculation, and not a "precision mode" — the same
 * `computeFor` result the screen shows, with its `steps` written out. There is
 * no arithmetic in this function at all; if there were, it would be a second
 * implementation of the engine and the two would eventually disagree.
 *
 * It carries the standard report's rows first, so one file answers both
 * questions: what are the quantities, and how were they arrived at.
 */
export function toDetailedCsv(project: Project): string {
  const { units: us, mode } = project;
  const lines: string[] = [toCsv(project).replace(BOM, "")];

  lines.push("");
  lines.push(row(["Calculation details"]));
  lines.push(
    row([
      "Every value below is from the same calculation as the rows above. '=' means the operands",
    ]),
  );
  lines.push(
    row([
      "shown reproduce the value shown; '~' means the value was computed from more precision than is printed.",
    ]),
  );

  project.entries.forEach((entry, i) => {
    const r = computeFor(project, entry);
    const spec = SPECS[entry.fitting.kind];
    lines.push("");
    lines.push(
      row([
        `Line ${i + 1}`,
        spec.name,
        describeFitting(entry.fitting, us),
        mode === "billing" ? "Commercial billing" : "Shop fabrication",
      ]),
    );
    lines.push(row(["Formula", r.expression]));
    lines.push(row(["Step", "Working", "", "Value", "Unit"]));
    for (const s of r.steps) {
      lines.push(
        row([s.label, s.working, s.exact ? "=" : "~", fmtExact(s.value, PRECISION.detail), s.unit]),
      );
    }
    lines.push(
      row([
        "Displayed",
        `net ${fromAreaMinor(r.netAreaMinor)} ${areaUnit(us)}`,
        "",
        `gross ${fromAreaMinor(r.grossAreaMinor)}`,
        `weight ${fromMassMinor(r.massMinor)} ${massUnit(us)}`,
      ]),
    );
  });

  return BOM + lines.join("\r\n") + "\r\n";
}

/** The caveats that travel with every number this app produces. Shared by the
 * CSV footer and the printed BOQ sheet so the two can never disagree. */
export function assumptions(project: Project): string[] {
  const detail = wasteDetail(project.waste);
  const anc = project.ancillaries;
  const hasRound = project.entries.some((e) => e.fitting.kind.startsWith("round-"));
  return [
    ...(hasRound
      ? [
          "Round duct is graded on the RECTANGULAR gauge table, because that is the table this app has. SMACNA publishes a separate and generally lighter one for round and spiral duct, so these figures over-specify it. Override the gauge on any line where your specification differs.",
        ]
      : []),
    ...(anc.insulationMm > 0
      ? [
          `Insulation is measured on the outer face at ${anc.insulationMm} mm: the billing formula re-run with every cross-section dimension grown by twice the thickness, with the centreline unmoved.`,
        ]
      : []),
    ...(anc.standardLengthMm > 0
      ? [
          `Flanges are counted as two ends per piece, a straight run being as many pieces as a ${anc.standardLengthMm} mm supplied length divides into. Corner pieces are four per rectangular end; round flanges have none.`,
        ]
      : []),
    ...(anc.supportSpacingMm > 0
      ? [
          `Hangers are one per piece plus one for every further full ${anc.supportSpacingMm} mm of centreline run.`,
        ]
      : []),
    ...(project.rates.perKg > 0 || project.rates.perM2 > 0
      ? [
          "Values are the estimator's own rates applied to these quantities. They are not a price this app produced.",
        ]
      : []),
    project.mode === "billing"
      ? "Areas are measured to the commercial billing standard: nominal mean perimeter x centreline length (BOQ / IS 655 / DW144 practice)."
      : "Areas are the true unfolded sheet blank, including slant hypotenuses and heel arc expansion. They are not a billing quantity.",
    `Default waste allowance ${project.waste}%${detail ? ` - ${detail}` : ""}. Individual lines may override it; each row states its own.`,
    "Gauge is selected from the largest single duct dimension only. Real SMACNA selection also depends on pressure class and reinforcement spacing - check against the project specification. Any line may override the gauge by hand.",
    `Sheet weight is ${MATERIALS[project.material].name.toLowerCase()} at ${MATERIALS[project.material].density} kg/m3, on the gross area. It excludes any coating, stiffeners, flange steel, gaskets and fixings.`,
    "Sheet counts are a nesting estimate: gross area divided by one 1200x2400 mm (4x8 ft) sheet, rounded up, per gauge. They ignore offcut reuse and blank shape.",
    "Reducers are calculated as concentric transitions. Y-piece shop areas develop each branch as an elbow on its own width and exclude the crotch plate.",
  ];
}
