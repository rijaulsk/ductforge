import { SPECS } from "./duct/formulas";
import { toAngle, toCount, toNumber } from "./duct/parse";
import type { Entry, FieldKey, Fitting, FittingKind, GaugeName } from "./duct/types";
import { type UnitSystem, fmtExact, fromMm, toMm } from "./duct/units";

/* The fitting being configured, as the form holds it.
 *
 * TWO REPRESENTATIONS, AND ONLY ONE OF THEM IS THE TRUTH.
 *
 * `values` is the edit buffer: the raw string in each box, exactly as typed.
 * It has to be a string, because parsing on every keystroke and writing the
 * result back rewrites "1." to "1" the moment someone tries to type "1.5" and
 * makes an empty box unreachable.
 *
 * `mm` is the geometry: millimetres, degrees and counts at FULL PRECISION.
 * It is written once, when a field is edited, and everything downstream reads
 * it. Nothing ever parses `values` again.
 *
 * That separation is the fix for a real precision leak. Previously the draft
 * held only strings, so switching a job from metric to imperial meant
 * mm → inches → FORMATTED TO 3 DECIMALS → back to a string → parsed → mm.
 * A 600 mm width came back as 599.9988 mm, and a job switched back and forth
 * a few times drifted a little further each time. Now a unit switch only
 * reformats the display strings; `mm` is untouched, so it is exact however
 * many times you flip.
 *
 * Formatting for the boxes is generous rather than tidy — six decimals on an
 * inch — because those strings are what someone sees and might retype, and a
 * number that reads as exact should be exact. Trailing zeros are trimmed.
 */

export type Draft = {
  kind: FittingKind;
  /** What is in each box. Display and editing only. */
  values: Partial<Record<FieldKey, string>>;
  /** The geometry: mm for lengths, degrees for angles, plain for counts. */
  mm: Partial<Record<FieldKey, number>>;
  qty: string;
  waste: string;
  gauge: GaugeName | null;
  zone: string;
  note: string;
};

/** Decimals a dimension box shows. Enough that the string is a faithful
 * rendering of the millimetres behind it, not a rounded stand-in. */
const BOX_DECIMALS: Record<UnitSystem, number> = { metric: 3, imperial: 6 };

export function toInputValue(mm: number, us: UnitSystem): string {
  return fmtExact(fromMm(mm, us), BOX_DECIMALS[us], false);
}

/** Format one field's stored value for its box. */
function boxValue(spec: FieldKeySpec, raw: number, us: UnitSystem): string {
  if (spec.angle || spec.count) return fmtExact(raw, 4, false);
  return toInputValue(raw, us);
}

type FieldKeySpec = { key: FieldKey; angle?: boolean; count?: boolean };

/** Read a fitting's own numbers out as the draft's geometry. */
function mmFromFitting(f: Fitting): Partial<Record<FieldKey, number>> {
  const spec = SPECS[f.kind];
  const source = f as unknown as Record<string, number>;
  const out: Partial<Record<FieldKey, number>> = {};
  for (const field of spec.fields) out[field.key] = source[field.key] ?? 0;
  return out;
}

function valuesFromMm(
  kind: FittingKind,
  mm: Partial<Record<FieldKey, number>>,
  us: UnitSystem,
): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  for (const field of SPECS[kind].fields) {
    out[field.key] = boxValue(field, mm[field.key] ?? 0, us);
  }
  return out;
}

/**
 * One field edited: the typed string is kept verbatim, and the geometry behind
 * it is re-derived from that string at full precision.
 *
 * This is the ONLY place a string becomes a number.
 */
export function setField(
  draft: Draft,
  key: FieldKey,
  raw: string,
  us: UnitSystem,
): Draft {
  const field = SPECS[draft.kind].fields.find((f) => f.key === key);
  const parsed = field?.angle
    ? toAngle(raw)
    : field?.count
      ? toCount(raw, 2, 64)
      : toMm(toNumber(raw), us);
  return {
    ...draft,
    values: { ...draft.values, [key]: raw },
    mm: { ...draft.mm, [key]: parsed },
  };
}

/** The fitting the draft describes. Reads the geometry, never the strings. */
export function fittingFromDraft(draft: Draft): Fitting {
  const out: Record<string, number | string> = { kind: draft.kind };
  for (const field of SPECS[draft.kind].fields) {
    out[field.key] = draft.mm[field.key] ?? 0;
  }
  return out as unknown as Fitting;
}

export function newDraft(
  kind: FittingKind,
  waste: number,
  us: UnitSystem,
  zone = "",
): Draft {
  const mm = mmFromFitting(SPECS[kind].defaults);
  return {
    kind,
    mm,
    values: valuesFromMm(kind, mm, us),
    qty: "1",
    waste: String(waste),
    gauge: null,
    zone,
    note: "",
  };
}

export function draftFromEntry(entry: Entry, us: UnitSystem): Draft {
  const mm = mmFromFitting(entry.fitting);
  return {
    kind: entry.fitting.kind,
    mm,
    values: valuesFromMm(entry.fitting.kind, mm, us),
    qty: String(entry.qty),
    waste: String(entry.waste),
    gauge: entry.gauge,
    zone: entry.zone,
    note: entry.note,
  };
}

/**
 * Re-express the draft's boxes in the other unit system.
 *
 * LOSSLESS, and that is the whole point: the geometry is not touched, only the
 * strings are regenerated from it. Saved entries never needed this — they are
 * stored in millimetres and are unit-agnostic — and now the draft does not
 * either.
 */
export function convertDraft(draft: Draft, from: UnitSystem, to: UnitSystem): Draft {
  if (from === to) return draft;
  return { ...draft, values: valuesFromMm(draft.kind, draft.mm, to) };
}
