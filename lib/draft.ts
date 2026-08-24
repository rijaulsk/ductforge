import { SPECS } from "./duct/formulas";
import { toAngle, toNumber } from "./duct/parse";
import type { Entry, FieldKey, Fitting, FittingKind, GaugeName } from "./duct/types";
import { type UnitSystem, fromMm, toMm } from "./duct/units";

/* The fitting being configured, as the form holds it.
 *
 * Fields are the RAW STRING the user typed, not numbers. Parse-on-keystroke
 * and write-back rewrites "1." to "1" the moment someone tries to type "1.5",
 * and makes an empty box unreachable — delete the last digit and it snaps to
 * zero. So the string is the state and the number is derived, every render.
 */

export type Draft = {
  kind: FittingKind;
  values: Partial<Record<FieldKey, string>>;
  qty: string;
  waste: string;
  gauge: GaugeName | null;
  note: string;
};

/** Enough decimals to round-trip without showing 23.622047244094488. */
export function toInputValue(mm: number, us: UnitSystem): string {
  const value = fromMm(mm, us);
  return String(Number(value.toFixed(us === "metric" ? 1 : 3)));
}

export function valuesFromFitting(f: Fitting, us: UnitSystem): Partial<Record<FieldKey, string>> {
  const spec = SPECS[f.kind];
  const source = f as unknown as Record<string, number>;
  const out: Partial<Record<FieldKey, string>> = {};
  for (const field of spec.fields) {
    const raw = source[field.key] ?? 0;
    out[field.key] = field.angle ? String(raw) : toInputValue(raw, us);
  }
  return out;
}

export function fittingFromValues(
  kind: FittingKind,
  values: Partial<Record<FieldKey, string>>,
  us: UnitSystem,
): Fitting {
  const spec = SPECS[kind];
  const out: Record<string, number | string> = { kind };
  for (const field of spec.fields) {
    const raw = values[field.key] ?? "";
    out[field.key] = field.angle ? toAngle(raw) : toMm(toNumber(raw), us);
  }
  return out as unknown as Fitting;
}

export function newDraft(kind: FittingKind, waste: number, us: UnitSystem): Draft {
  return {
    kind,
    values: valuesFromFitting(SPECS[kind].defaults, us),
    qty: "1",
    waste: String(waste),
    gauge: null,
    note: "",
  };
}

export function draftFromEntry(entry: Entry, us: UnitSystem): Draft {
  return {
    kind: entry.fitting.kind,
    values: valuesFromFitting(entry.fitting, us),
    qty: String(entry.qty),
    waste: String(entry.waste),
    gauge: entry.gauge,
    note: entry.note,
  };
}

/**
 * Re-express a half-typed draft in the other unit system.
 *
 * Saved entries never need this — they are stored in millimetres and are
 * unit-agnostic. Only the form does, and it matters: switching a job to
 * imperial while a 600 mm width sits in the box must show 23.622, not leave a
 * 600 that now means 600 inches.
 */
export function convertDraft(draft: Draft, from: UnitSystem, to: UnitSystem): Draft {
  if (from === to) return draft;
  const spec = SPECS[draft.kind];
  const values: Partial<Record<FieldKey, string>> = {};
  for (const field of spec.fields) {
    const raw = draft.values[field.key] ?? "";
    values[field.key] = field.angle ? raw : toInputValue(toMm(toNumber(raw), from), to);
  }
  return { ...draft, values };
}
