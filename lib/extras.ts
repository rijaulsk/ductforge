import type { Extra, ExtraCategory, ExtraShape, ExtraUnit } from "./duct/types";
import { type UnitSystem, fmtLength, toValueMinor } from "./duct/units";

/* Extras: the things on a duct job that are not sheet metal this app cuts.
 *
 * WHY THEY ARE COUNTED AND NOT CALCULATED. The owner asked for "a separate
 * place to add VCD and other calculations" (19 Sep 2026), and when asked what
 * those calculations should be, was not sure. So this does the part every
 * estimator does and nobody disputes: what it is, what size, how many, and at
 * whose rate. It does NOT work out the sheet metal inside a damper's casing:
 * every shop builds them differently, and a formula for it would be a number
 * this app invented. That can come later, from the owner's own method.
 *
 * Nothing here ever adds to the duct's area or weight. The extras are listed,
 * counted and priced on their own table, and say so.
 *
 * Framework-free, like lib/duct, so check-duct can reach it.
 */

export const EXTRA_CATEGORIES: readonly { key: ExtraCategory; label: string; short: string; blurb: string }[] = [
  { key: "damper", label: "Dampers", short: "Dampers", blurb: "VCDs, fire, motorised and non-return dampers" },
  { key: "terminal", label: "Air terminals", short: "Terminals", blurb: "Grilles, diffusers, registers and louvres" },
  { key: "accessory", label: "Accessories", short: "Accessories", blurb: "Access doors, flexible connectors, attenuators" },
  { key: "custom", label: "Other items", short: "Other", blurb: "Anything else: labour, sealant, transport" },
];

export type Preset = { item: string; shape: ExtraShape; unit: ExtraUnit };

/* Trade names as they appear on an HVAC BOQ, with the size a supplier quotes
 * them by. A preset only fills the form in — every field stays editable, and
 * "Other" takes free text in every category. */
export const PRESETS: Record<ExtraCategory, readonly Preset[]> = {
  damper: [
    { item: "Volume control damper (VCD)", shape: "rect", unit: "nos" },
    { item: "Round volume control damper", shape: "round", unit: "nos" },
    { item: "Fire damper", shape: "rect", unit: "nos" },
    { item: "Motorised damper", shape: "rect", unit: "nos" },
    { item: "Non-return damper", shape: "rect", unit: "nos" },
    { item: "Smoke damper", shape: "rect", unit: "nos" },
    { item: "Pressure relief damper", shape: "rect", unit: "nos" },
  ],
  terminal: [
    { item: "Supply air grille", shape: "rect", unit: "nos" },
    { item: "Return air grille", shape: "rect", unit: "nos" },
    { item: "Exhaust air grille", shape: "rect", unit: "nos" },
    { item: "Square ceiling diffuser", shape: "rect", unit: "nos" },
    { item: "Round ceiling diffuser", shape: "round", unit: "nos" },
    { item: "Linear slot diffuser", shape: "rect", unit: "nos" },
    { item: "Jet nozzle", shape: "round", unit: "nos" },
    { item: "Register", shape: "rect", unit: "nos" },
    { item: "Louvre", shape: "rect", unit: "nos" },
  ],
  accessory: [
    { item: "Access door", shape: "rect", unit: "nos" },
    { item: "Flexible connector (canvas)", shape: "rect", unit: "nos" },
    { item: "Flexible duct", shape: "round", unit: "m" },
    { item: "Sound attenuator", shape: "rect", unit: "nos" },
    { item: "Plenum box", shape: "rect", unit: "nos" },
    { item: "Turning vanes", shape: "rect", unit: "set" },
  ],
  custom: [],
};

export const EXTRA_UNITS: readonly ExtraUnit[] = ["nos", "m", "m²", "set", "lot"];

/** A unit whose quantity may be fractional — you can buy 7.5 m, not 7.5 dampers. */
export const fractionalUnit = (u: ExtraUnit) => u === "m" || u === "m²";

/** The quantity as it will be counted: whole for countable units, three places otherwise. */
export function normaliseQty(qty: number, unit: ExtraUnit): number {
  if (!Number.isFinite(qty) || qty <= 0) return fractionalUnit(unit) ? 0 : 1;
  return fractionalUnit(unit) ? Math.round(qty * 1000) / 1000 : Math.max(1, Math.floor(qty));
}

export function blankExtra(id: string, category: ExtraCategory = "damper"): Extra {
  const preset = PRESETS[category][0];
  return {
    id,
    category,
    item: preset?.item ?? "",
    shape: preset?.shape ?? "none",
    w: preset?.shape === "rect" ? 600 : 0,
    h: preset?.shape === "rect" ? 400 : 0,
    d: preset?.shape === "round" ? 250 : 0,
    qty: 1,
    unit: preset?.unit ?? "nos",
    rate: 0,
    zone: "",
    note: "",
  };
}

/** "600 × 400", "⌀ 250", or "" for an item with no size. */
export function describeExtraSize(x: Extra, us: UnitSystem): string {
  if (x.shape === "rect") return `${fmtLength(x.w, us)} × ${fmtLength(x.h, us)}`;
  if (x.shape === "round") return `⌀ ${fmtLength(x.d, us)}`;
  return "";
}

export type ExtraRow = { extra: Extra; index: number; valueMinor: number };

export type ExtrasTotals = {
  rows: ExtraRow[];
  /** Line count per category, in category order, for the categories in use. */
  byCategory: { category: ExtraCategory; label: string; lines: number; valueMinor: number }[];
  /** Any line has a rate — the table shows rate and value columns only then. */
  priced: boolean;
  /** Summed from the ROUNDED line values, so the column adds up by hand —
   * the same rule the schedule's totals follow. */
  valueMinor: number;
};

export function computeExtras(extras: readonly Extra[]): ExtrasTotals {
  /* Grouped by category, in category order, keeping the order lines were
   * added within each — a printed table reads dampers, then terminals. */
  const order = EXTRA_CATEGORIES.map((c) => c.key);
  const sorted = [...extras].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  const rows = sorted.map((extra, i) => ({
    extra,
    index: i + 1,
    valueMinor: toValueMinor(extra.qty * extra.rate),
  }));
  const byCategory = EXTRA_CATEGORIES.flatMap((c) => {
    const mine = rows.filter((r) => r.extra.category === c.key);
    return mine.length
      ? [{ category: c.key, label: c.label, lines: mine.length, valueMinor: mine.reduce((s, r) => s + r.valueMinor, 0) }]
      : [];
  });
  return {
    rows,
    byCategory,
    priced: extras.some((x) => x.rate > 0),
    valueMinor: rows.reduce((s, r) => s + r.valueMinor, 0),
  };
}

/* ---- the reviver ----------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, max = 100_000): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fallback;

const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/**
 * Read stored extras back, one by one. A total parser like `reviveProject`:
 * it never throws, a line it cannot read is dropped, and a field it cannot
 * vouch for takes a safe default. A project saved before extras existed has
 * none, and opens with an empty list.
 */
export function reviveExtras(v: unknown, makeId: () => string): Extra[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): Extra[] => {
    if (!isObject(x)) return [];
    const item = text(x.item, 120).trim();
    if (!item) return [];
    const unit = oneOf(x.unit, EXTRA_UNITS, "nos");
    return [
      {
        id: text(x.id, 64) || makeId(),
        category: oneOf(x.category, EXTRA_CATEGORIES.map((c) => c.key), "custom"),
        item,
        shape: oneOf(x.shape, ["rect", "round", "none"] as const, "none"),
        w: num(x.w, 0),
        h: num(x.h, 0),
        d: num(x.d, 0),
        qty: normaliseQty(num(x.qty, 1), unit),
        unit,
        rate: num(x.rate, 0, 1e9),
        zone: text(x.zone, 60),
        note: text(x.note, 200),
      },
    ];
  });
}
