import { bandFor, densityDisplay, selectGauge, sheetCount } from "./gauge";
import { specFor } from "./formulas";
import type { Entry, FittingKind, GaugeName, Mode } from "./types";
import {
  type UnitSystem,
  areaFromMm2,
  fromAreaMinor,
  squareLengthFromMm2,
  toAreaMinor,
  toMassMinor,
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
 * The chain is deliberately hand-checkable end to end:
 *   net area  = formula, rounded to 3 dp
 *   gross     = net × (1 + waste%), rounded to 3 dp
 *   weight    = gross × the density shown on screen, rounded to 2 dp
 * Multiply the two numbers the app shows you and you get the third.
 */

export type EntryResult = {
  /** mm², one piece, unrounded — for the drawing and the substitution line. */
  netEachMm2: number;
  /** Same, in the display square-length unit (mm² or in²). */
  netEachSquare: number;
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
  thicknessMm: number;
  /** kg/m² or lb/ft², at the precision it is printed. */
  density: number;
  /** Hundredths of kg/lb, the whole line. */
  massMinor: number;
  /** The formula with this entry's numbers in it. */
  substitution: string;
  expression: string;
  note?: string;
};

export function computeEntry(entry: Entry, mode: Mode, us: UnitSystem): EntryResult {
  const spec = specFor(entry.fitting.kind);
  const formula = mode === "billing" ? spec.billing : spec.shop;

  const netEachMm2 = formula.compute(entry.fitting);
  const netEachArea = areaFromMm2(netEachMm2, us);

  const netEachMinor = toAreaMinor(netEachArea);
  const netAreaMinor = toAreaMinor(netEachArea * entry.qty);
  const grossAreaMinor = toAreaMinor(netEachArea * entry.qty * (1 + entry.waste / 100));

  const maxDimMm = spec.maxDim(entry.fitting);
  const gauge = entry.gauge ?? selectGauge(maxDimMm, us);
  const band = bandFor(gauge);
  const density = densityDisplay(band.thicknessMm, us);

  /* Weight from the ROUNDED gross area × the density as printed — see the
   * header. Gross, not net: waste is material bought and carried to site. */
  const massMinor = toMassMinor(fromAreaMinor(grossAreaMinor) * density);

  return {
    netEachMm2,
    netEachSquare: squareLengthFromMm2(netEachMm2, us),
    netEachMinor,
    netAreaMinor,
    grossAreaMinor,
    wasteAreaMinor: grossAreaMinor - netAreaMinor,
    maxDimMm,
    gauge,
    gaugeAuto: entry.gauge === null,
    thicknessMm: band.thicknessMm,
    density,
    massMinor,
    substitution: formula.substitute(entry.fitting, us),
    expression: formula.expression,
    note: spec.note,
  };
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

export type Totals = {
  lines: number;
  pieces: number;
  netAreaMinor: number;
  grossAreaMinor: number;
  wasteAreaMinor: number;
  massMinor: number;
  byGauge: GaugeGroup[];
  byKind: KindGroup[];
  /** Sum of the per-gauge sheet estimates. */
  sheets: number;
};

export function computeTotals(
  entries: Entry[],
  mode: Mode,
  us: UnitSystem,
): Totals {
  const byGauge = new Map<GaugeName, GaugeGroup>();
  const byKind = new Map<FittingKind, KindGroup>();

  const totals: Totals = {
    lines: entries.length,
    pieces: 0,
    netAreaMinor: 0,
    grossAreaMinor: 0,
    wasteAreaMinor: 0,
    massMinor: 0,
    byGauge: [],
    byKind: [],
    sheets: 0,
  };

  for (const entry of entries) {
    const r = computeEntry(entry, mode, us);

    totals.pieces += entry.qty;
    totals.netAreaMinor += r.netAreaMinor;
    totals.grossAreaMinor += r.grossAreaMinor;
    totals.wasteAreaMinor += r.wasteAreaMinor;
    totals.massMinor += r.massMinor;

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
  }

  for (const g of byGauge.values()) {
    g.sheets = sheetCount(fromAreaMinor(g.grossAreaMinor), us);
    totals.sheets += g.sheets;
  }

  /* Heaviest gauge first — the order a purchase order is written in. */
  totals.byGauge = [...byGauge.values()].sort((a, b) => b.thicknessMm - a.thicknessMm);
  totals.byKind = [...byKind.values()].sort((a, b) => b.grossAreaMinor - a.grossAreaMinor);

  return totals;
}
