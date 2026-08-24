import { bandFor, densityDisplay, selectGauge, sheetCount } from "./gauge";
import { isRound, specFor } from "./formulas";
import type {
  Ancillaries,
  Entry,
  FittingKind,
  GaugeName,
  MaterialKey,
  Mode,
  Project,
  Rates,
} from "./types";
import {
  type UnitSystem,
  areaFromMm2,
  fromAreaMinor,
  runFromMm,
  squareLengthFromMm2,
  toAreaMinor,
  toMassMinor,
  toRunMinor,
  toValueMinor,
} from "./units";

/* Turning a schedule into quantities.
 *
 * ROUNDING DISCIPLINE, and it is the reason this file exists rather than the
 * arithmetic living in the components: every figure is rounded ONCE, here, to
 * the precision it will be displayed at, and totals are summed from those
 * rounded line values. So the total printed at the bottom of a schedule is
 * exactly the sum of the numbers printed above it. Summing full-precision
 * floats and rounding at the end is more "accurate" and produces a sheet where
 * the column does not add up, which an estimator reads — correctly — as a bug.
 *
 * FULL PRECISION UNTIL THE DISPLAY, and this is the stricter of two rules that
 * both have a claim here. Every step below reads the previous one exactly as it
 * came out of the arithmetic — the allowance is taken on the unrounded net
 * area, the weight on the unrounded gross, the value on the unrounded weight —
 * and the `toAreaMinor` / `toMassMinor` calls that round for the screen happen
 * once, at the end, on values nothing else consumes.
 *
 * The chain stays hand-checkable, but by SHOWING more rather than by rounding
 * earlier: the result panel prints the working at enough precision to multiply
 * out. That is the trade the previous version got backwards — it rounded the
 * intermediates so the printed figures would multiply, and printed a working
 * line whose own numbers did not.
 *
 * TOTALS ARE THE ONE EXCEPTION, deliberately. `computeTotals` sums the ROUNDED
 * line values, because a schedule is a column somebody adds up by hand and a
 * total that disagrees with its own rows by a rounding unit reads as a bug.
 * Within a line, nothing is rounded before its last use; between lines, the
 * printed figure is the quantity.
 *
 * THE ANCILLARIES ARE DERIVED, NOT MEASURED. Insulation, flange ends and
 * hangers all come out of the same geometry the areas do; none of them is a
 * new input, and each one states its rule in the UI:
 *   insulation — the BILLING formula re-run on the fitting with every
 *                cross-section dimension grown by twice the thickness
 *   flanges    — two ends per piece, a straight run being as many pieces as
 *                the standard supplied length divides into
 *   hangers    — one per piece, plus one per further full spacing of run
 */

export type EntryResult = {
  /** mm², one piece, unrounded — for the drawing and the substitution line. */
  netEachMm2: number;
  /** Same, in the display square-length unit (mm² or in²). */
  netEachSquare: number;
  /* Unrounded areas and mass in display units, for working lines that have to
   * reproduce. The `*Minor` fields below are these, rounded for display. */
  netEachArea: number;
  netArea: number;
  grossArea: number;
  mass: number;
  /** Thousandths of m²/ft², one piece. Informational: the schedule bills lines. */
  netEachMinor: number;
  /** Thousandths of m²/ft², the whole line (× qty). */
  netAreaMinor: number;
  /** Net plus the waste allowance. */
  grossAreaMinor: number;
  wasteAreaMinor: number;
  maxDimMm: number;
  gauge: GaugeName;
  /** false when the estimator has overridden the size-only table. */
  gaugeAuto: boolean;
  /** Round duct is graded on the rectangular table — see gauge.ts. */
  gaugeCaveat: boolean;
  thicknessMm: number;
  /** kg/m² or lb/ft², at the precision it is printed. */
  density: number;
  /** Hundredths of kg/lb, the whole line. */
  massMinor: number;
  /** Hundredths of the rate's own unit. 0 when no rate is set. */
  valueMinor: number;

  /* Derived quantities. Zero when the project has that option switched off. */
  insulationAreaMinor: number;
  pieces: number;
  flangeEnds: number;
  /** Hundredths of a metre / foot. */
  flangeRunMinor: number;
  corners: number;
  supports: number;

  /** The formula with this entry's numbers in it. */
  substitution: string;
  expression: string;
  note?: string;
};

const STRAIGHT_RUNS: readonly FittingKind[] = ["straight", "round-straight"];

const NO_ANCILLARIES: Ancillaries = {
  insulationMm: 0,
  standardLengthMm: 0,
  supportSpacingMm: 0,
};
const NO_RATES: Rates = { perKg: 0, perM2: 0, label: "" };

/**
 * `material` is deliberately REQUIRED while the two below are not.
 *
 * Defaulting the allowances and the rates to "off" produces a zero — a caller
 * that forgets them gets no ancillary quantities, which is visibly nothing.
 * Defaulting the material to GI produces a WEIGHT: an aluminium job would
 * silently print steel figures that look entirely plausible. The difference
 * between "obviously missing" and "quietly wrong" is the whole reason this
 * argument has no default.
 */
export function computeEntry(
  entry: Entry,
  mode: Mode,
  us: UnitSystem,
  material: MaterialKey,
  ancillaries: Ancillaries = NO_ANCILLARIES,
  rates: Rates = NO_RATES,
): EntryResult {
  const spec = specFor(entry.fitting.kind);
  const formula = mode === "billing" ? spec.billing : spec.shop;

  /* ---- full precision, start to finish ----
   *
   * Nothing below is rounded. The formula's own square millimetres become an
   * area, the area takes the allowance, the allowance takes the density, and
   * the weight takes the rate — each step reading the previous one exactly as
   * it came out. Rounding happens once, at the bottom, on the way to the
   * screen. Feeding a rounded intermediate into the next step would produce a
   * number that no printed figure multiplies out to. */
  const netEachMm2 = formula.compute(entry.fitting);
  const netEachArea = areaFromMm2(netEachMm2, us);
  const netArea = netEachArea * entry.qty;
  const grossArea = netArea * (1 + entry.waste / 100);

  const maxDimMm = spec.maxDim(entry.fitting);
  const gauge = entry.gauge ?? selectGauge(maxDimMm, us);
  const band = bandFor(gauge);
  const density = densityDisplay(band.thicknessMm, us, material);

  /* Gross, not net: waste is material bought and carried to site. */
  const mass = grossArea * density;
  const value = mass * rates.perKg + grossArea * rates.perM2;

  const netEachMinor = toAreaMinor(netEachArea);
  const netAreaMinor = toAreaMinor(netArea);
  const grossAreaMinor = toAreaMinor(grossArea);
  const massMinor = toMassMinor(mass);
  const valueMinor = toValueMinor(value);

  /* ---- derived quantities ---- */

  /* Insulation is a NOMINAL area measurement, so it is always taken on the
   * billing formula regardless of which standard the sheet is measured to.
   * Measuring lagging on a shop blank would be measuring the wrong object. */
  const insulationArea =
    ancillaries.insulationMm > 0
      ? areaFromMm2(
          spec.billing.compute(spec.inflate(entry.fitting, ancillaries.insulationMm * 2)),
          us,
        ) * entry.qty
      : 0;
  const insulationAreaMinor = toAreaMinor(insulationArea);

  const centrelineMm = spec.centreline(entry.fitting);
  const isStraightRun = STRAIGHT_RUNS.includes(entry.fitting.kind);
  const pieces =
    isStraightRun && ancillaries.standardLengthMm > 0
      ? Math.max(1, Math.ceil(centrelineMm / ancillaries.standardLengthMm - 1e-9))
      : 1;

  const flangeEnds = ancillaries.standardLengthMm > 0 ? 2 * pieces * entry.qty : 0;
  const flangeRunMinor = toRunMinor(
    runFromMm(flangeEnds * spec.perimeter(entry.fitting), us),
  );
  /* Corner pieces are a rectangular-duct item: a round flange has no corners. */
  const corners = isRound(entry.fitting.kind) ? 0 : flangeEnds * 4;

  const supports =
    ancillaries.supportSpacingMm > 0
      ? entry.qty *
        Math.max(1, Math.ceil(centrelineMm / ancillaries.supportSpacingMm - 1e-9))
      : 0;

  return {
    netEachMm2,
    netEachSquare: squareLengthFromMm2(netEachMm2, us),
    /* Unrounded, so the result panel can print a working line that actually
     * reproduces its own answer. */
    netEachArea,
    netArea,
    grossArea,
    mass,
    netEachMinor,
    netAreaMinor,
    grossAreaMinor,
    wasteAreaMinor: grossAreaMinor - netAreaMinor,
    maxDimMm,
    gauge,
    gaugeAuto: entry.gauge === null,
    gaugeCaveat: isRound(entry.fitting.kind),
    thicknessMm: band.thicknessMm,
    density,
    massMinor,
    valueMinor,
    insulationAreaMinor,
    pieces,
    flangeEnds,
    flangeRunMinor,
    corners,
    supports,
    substitution: formula.substitute(entry.fitting, us),
    expression: formula.expression,
    note: spec.note,
  };
}

/** Compute one entry using a project's settings. The form the app actually
 * calls, so a caller cannot forget to pass the material or the allowances. */
export function computeFor(project: Project, entry: Entry): EntryResult {
  return computeEntry(
    entry,
    project.mode,
    project.units,
    project.material,
    project.ancillaries,
    project.rates,
  );
}

export type GaugeGroup = {
  gauge: GaugeName;
  thicknessMm: number;
  density: number;
  pieces: number;
  netAreaMinor: number;
  grossAreaMinor: number;
  massMinor: number;
  /** Nesting ESTIMATE — see gauge.ts. Never computed on a grand total. */
  sheets: number;
};

export type KindGroup = {
  kind: FittingKind;
  pieces: number;
  netAreaMinor: number;
  grossAreaMinor: number;
  massMinor: number;
};

export type ZoneGroup = {
  zone: string;
  lines: number;
  pieces: number;
  netAreaMinor: number;
  grossAreaMinor: number;
  massMinor: number;
  valueMinor: number;
};

export type Totals = {
  lines: number;
  pieces: number;
  netAreaMinor: number;
  grossAreaMinor: number;
  wasteAreaMinor: number;
  massMinor: number;
  valueMinor: number;
  insulationAreaMinor: number;
  flangeEnds: number;
  flangeRunMinor: number;
  corners: number;
  supports: number;
  byGauge: GaugeGroup[];
  byKind: KindGroup[];
  byZone: ZoneGroup[];
  /** Sum of the per-gauge sheet estimates. */
  sheets: number;
};

export function computeTotals(project: Project): Totals {
  const byGauge = new Map<GaugeName, GaugeGroup>();
  const byKind = new Map<FittingKind, KindGroup>();
  const byZone = new Map<string, ZoneGroup>();

  const totals: Totals = {
    lines: project.entries.length,
    pieces: 0,
    netAreaMinor: 0,
    grossAreaMinor: 0,
    wasteAreaMinor: 0,
    massMinor: 0,
    valueMinor: 0,
    insulationAreaMinor: 0,
    flangeEnds: 0,
    flangeRunMinor: 0,
    corners: 0,
    supports: 0,
    byGauge: [],
    byKind: [],
    byZone: [],
    sheets: 0,
  };

  for (const entry of project.entries) {
    const r = computeFor(project, entry);

    totals.pieces += entry.qty;
    totals.netAreaMinor += r.netAreaMinor;
    totals.grossAreaMinor += r.grossAreaMinor;
    totals.wasteAreaMinor += r.wasteAreaMinor;
    totals.massMinor += r.massMinor;
    totals.valueMinor += r.valueMinor;
    totals.insulationAreaMinor += r.insulationAreaMinor;
    totals.flangeEnds += r.flangeEnds;
    totals.flangeRunMinor += r.flangeRunMinor;
    totals.corners += r.corners;
    totals.supports += r.supports;

    const g = byGauge.get(r.gauge) ?? {
      gauge: r.gauge,
      thicknessMm: r.thicknessMm,
      density: r.density,
      pieces: 0,
      netAreaMinor: 0,
      grossAreaMinor: 0,
      massMinor: 0,
      sheets: 0,
    };
    g.pieces += entry.qty;
    g.netAreaMinor += r.netAreaMinor;
    g.grossAreaMinor += r.grossAreaMinor;
    g.massMinor += r.massMinor;
    byGauge.set(r.gauge, g);

    const k = byKind.get(entry.fitting.kind) ?? {
      kind: entry.fitting.kind,
      pieces: 0,
      netAreaMinor: 0,
      grossAreaMinor: 0,
      massMinor: 0,
    };
    k.pieces += entry.qty;
    k.netAreaMinor += r.netAreaMinor;
    k.grossAreaMinor += r.grossAreaMinor;
    k.massMinor += r.massMinor;
    byKind.set(entry.fitting.kind, k);

    const zoneKey = entry.zone.trim();
    const z = byZone.get(zoneKey) ?? {
      zone: zoneKey,
      lines: 0,
      pieces: 0,
      netAreaMinor: 0,
      grossAreaMinor: 0,
      massMinor: 0,
      valueMinor: 0,
    };
    z.lines += 1;
    z.pieces += entry.qty;
    z.netAreaMinor += r.netAreaMinor;
    z.grossAreaMinor += r.grossAreaMinor;
    z.massMinor += r.massMinor;
    z.valueMinor += r.valueMinor;
    byZone.set(zoneKey, z);
  }

  for (const g of byGauge.values()) {
    g.sheets = sheetCount(fromAreaMinor(g.grossAreaMinor), project.units);
    totals.sheets += g.sheets;
  }

  /* Heaviest gauge first — the order a purchase order is written in. */
  totals.byGauge = [...byGauge.values()].sort((a, b) => b.thicknessMm - a.thicknessMm);
  totals.byKind = [...byKind.values()].sort((a, b) => b.grossAreaMinor - a.grossAreaMinor);
  /* Zones alphabetically, with the ungrouped bucket last — an unnamed zone is
   * the leftovers, not the headline. */
  totals.byZone = [...byZone.values()].sort((a, b) => {
    if (a.zone === "") return 1;
    if (b.zone === "") return -1;
    return a.zone.localeCompare(b.zone);
  });

  return totals;
}

/** Has the estimator actually asked for any of the derived quantities? */
export function hasAncillaries(a: Ancillaries): boolean {
  return a.insulationMm > 0 || a.standardLengthMm > 0 || a.supportSpacingMm > 0;
}

export function hasRates(r: Rates): boolean {
  return r.perKg > 0 || r.perM2 > 0;
}

/** More than the unnamed bucket — i.e. the estimator is actually using zones. */
export function hasZones(totals: Totals): boolean {
  return totals.byZone.some((z) => z.zone !== "");
}
