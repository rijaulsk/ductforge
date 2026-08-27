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
import { APP_BYLINE, APP_CREDIT, SITE_URL } from "../site";

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
 *
 * LAYOUT. Letterhead, then named sections separated by a blank row, then the
 * credit line last. Within a section a line is one of exactly three shapes —
 * see `section`, `pair` and `row` below. Both exports are the same body: the
 * detailed file is the standard file plus a calculation-details section, from
 * one function, so the two can never drift apart.
 */

const BOM = "﻿";

function cell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cells: (string | number)[]) => cells.map(cell).join(",");

/* THE THREE SHAPES A LINE IN THIS FILE IS ALLOWED TO TAKE.
 *
 * Before these, the file was a run of bare rows — a title, some pairs, a table,
 * more pairs — with nothing marking where one block ended and the next began,
 * and with labels landing in whichever column the author happened to pick.
 * Opened in a spreadsheet that is a wall of cells you have to decode.
 *
 * Now: a section heading is upper case and alone on its row, a label/value pair
 * always puts the label in column A, the value in B and any unit in C, and a
 * table is a header row followed by rows of the same width. Column B therefore
 * lines up from the top of the file to the bottom, which is the whole trick.
 */
const section = (title: string) => row([title.toUpperCase()]);

const pair = (label: string, value: string | number, unit = "") =>
  row(unit ? [label, value, unit] : [label, value]);

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

/** Wrap a body in the things every file this module writes must carry: the BOM
 * Excel needs to read UTF-8, and the credit line, last, at the actual end. */
const file = (lines: string[]) => BOM + [...lines, "", row([APP_CREDIT])].join("\r\n") + "\r\n";

/* The standard report's rows — without the mark and without the credit, so the
 * detailed report can carry all of them and still close the file itself
 * rather than having a credit line stranded in its middle. */
function standardLines(project: Project, subtitle: string): string[] {
  const { units: us, mode } = project;
  const len = lengthUnit(us);
  const lines: string[] = [];

  /* The letterhead. Same words as the printed sheet's masthead, because a
   * takeoff that leaves this app should name where it came from whichever
   * door it went out of. */
  lines.push(row([APP_BYLINE]));
  lines.push(row([subtitle, SITE_URL.replace("https://", "")]));
  lines.push("");

  lines.push(section("Job"));
  lines.push(pair("Project", project.name));
  lines.push(pair("Reference", project.reference));
  lines.push(pair("Exported", new Date().toISOString()));
  lines.push(
    pair(
      "Measurement standard",
      mode === "billing"
        ? "Commercial billing - mean perimeter x centreline length"
        : "Shop fabrication - true unfolded blank",
    ),
  );
  lines.push(pair("Units", us === "metric" ? "Metric (mm, m2, kg)" : "Imperial (in, ft2, lb)"));
  lines.push(pair("Material", MATERIALS[project.material].name));
  if (project.ancillaries.insulationMm > 0) {
    lines.push(pair("Insulation", `${project.ancillaries.insulationMm} mm on the outer face`));
  }
  lines.push("");

  lines.push(section("Schedule"));
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
  lines.push(section("Totals"));
  lines.push(pair("Lines", project.entries.length));
  lines.push(pair("Pieces", totals.pieces));
  lines.push(pair("Net area", fromAreaMinor(totals.netAreaMinor), areaUnit(us)));
  lines.push(pair("Waste", fromAreaMinor(totals.wasteAreaMinor), areaUnit(us)));
  lines.push(pair("Gross area", fromAreaMinor(totals.grossAreaMinor), areaUnit(us)));
  lines.push(pair("Weight", fromMassMinor(totals.massMinor), massUnit(us)));
  if (totals.insulationAreaMinor > 0) {
    lines.push(pair("Insulation", fromAreaMinor(totals.insulationAreaMinor), areaUnit(us)));
  }
  if (totals.flangeEnds > 0) {
    lines.push(pair("Flange ends", totals.flangeEnds, "ends"));
    lines.push(pair("Flange", fromRunMinor(totals.flangeRunMinor), runUnit(us)));
    if (totals.corners > 0) lines.push(pair("Corner pieces", totals.corners, "off"));
  }
  if (totals.supports > 0) lines.push(pair("Hangers", totals.supports, "off"));
  if (totals.valueMinor > 0) {
    lines.push(pair("Value", fromValueMinor(totals.valueMinor), project.rates.label));
  }

  if (totals.byZone.some((z) => z.zone !== "")) {
    lines.push("");
    lines.push(section("By zone"));
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
  lines.push(section("By gauge"));
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

  /* Numbered, and the number is in its own column, so a reader can point at
   * "basis 4" in an email and both people are looking at the same sentence. */
  lines.push("");
  lines.push(section("Basis of the quantities"));
  assumptions(project).forEach((line, i) => lines.push(row([i + 1, line])));

  return lines;
}

/** The takeoff, as a spreadsheet. */
export function toCsv(project: Project): string {
  return file(standardLines(project, "Duct takeoff schedule"));
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
  const lines = standardLines(project, "Duct takeoff schedule with calculation details");

  lines.push("");
  lines.push(section("Calculation details"));
  /* The legend is a pair, not a paragraph dumped into column A. Two sentences
   * that used to run off the edge of the sheet as one 100-character cell. */
  lines.push(pair("Basis", "Every value below is from the same calculation as the schedule above."));
  lines.push(pair("=", "The operands shown reproduce the value shown exactly."));
  lines.push(pair("~", "The value was computed from more precision than is printed here."));
  lines.push(pair("Precision", `${PRECISION.detail} decimal places`));

  project.entries.forEach((entry, i) => {
    const r = computeFor(project, entry);
    const spec = SPECS[entry.fitting.kind];

    lines.push("");
    lines.push(section(`Line ${i + 1} — ${spec.name}`));
    lines.push(pair("Dimensions", describeFitting(entry.fitting, us)));
    lines.push(pair("Standard", mode === "billing" ? "Commercial billing" : "Shop fabrication"));
    lines.push(pair("Formula", r.expression));
    lines.push(pair("Substituted", r.substitution));
    lines.push("");

    /* Five columns, every row the same width, the exactness marker in its own
     * narrow column between the working and the value — so a reader scanning
     * down sees at a glance which lines are rounded. */
    lines.push(row(["Step", "Working", "", "Value", "Unit"]));
    for (const s of r.steps) {
      lines.push(
        row([s.label, s.working, s.exact ? "=" : "~", fmtExact(s.value, PRECISION.detail), s.unit]),
      );
    }

    lines.push("");
    lines.push(pair("Net area, as displayed", fromAreaMinor(r.netAreaMinor), areaUnit(us)));
    lines.push(pair("Gross area, as displayed", fromAreaMinor(r.grossAreaMinor), areaUnit(us)));
    lines.push(pair("Weight, as displayed", fromMassMinor(r.massMinor), massUnit(us)));
  });

  return file(lines);
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
