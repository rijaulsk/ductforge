"use client";

import { useId } from "react";
import { GAUGE_BANDS } from "@/lib/duct/gauge";
import { SPECS } from "@/lib/duct/formulas";
import type { FieldKey, FittingKind, GaugeName } from "@/lib/duct/types";
import { type UnitSystem, lengthUnit } from "@/lib/duct/units";
import { WASTE_PRESETS } from "@/lib/duct/waste";
import type { Draft } from "@/lib/draft";
import { Eyebrow } from "./ui";

/* The parameter form.
 *
 * Inputs are `type="text"` with `inputMode="decimal"`, not `type="number"`:
 * number inputs swallow a stray scroll wheel into a silent value change, hide
 * what was actually typed behind locale parsing, and put spinners on a field
 * where nobody wants to increment a duct by one millimetre at a time.
 */

function Field({
  id,
  symbol,
  label,
  hint,
  unit,
  value,
  onChange,
}: {
  id: string;
  symbol: string;
  label: string;
  hint?: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline gap-2 font-medium text-heading">
        <span className="text-accent tabular-nums">{symbol}</span>
        <span>{label}</span>
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-card border-[1.5px] border-line bg-page px-4 py-2.5 font-medium tabular-nums text-heading placeholder:font-normal placeholder:text-muted"
        />
        <span className="w-8 shrink-0 text-small text-muted">{unit}</span>
      </div>
      {hint && <p className="mt-1.5 text-small text-muted">{hint}</p>}
    </div>
  );
}

export default function ParamForm({
  draft,
  units,
  zones,
  onChange,
}: {
  draft: Draft;
  units: UnitSystem;
  /** Zone names already in this takeoff, offered back as suggestions. */
  zones: string[];
  onChange: (next: Draft) => void;
}) {
  const uid = useId();
  const spec = SPECS[draft.kind];
  const len = lengthUnit(units);

  const setValue = (key: FieldKey, v: string) =>
    onChange({ ...draft, values: { ...draft.values, [key]: v } });

  return (
    <div className="space-y-6">
      <fieldset className="border-0 p-0">
        <legend className="sr-only">{spec.name} dimensions</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {spec.fields.map((f) => (
            <Field
              key={f.key}
              id={`${uid}-${f.key}`}
              symbol={f.symbol}
              label={f.label}
              hint={f.hint}
              unit={f.angle ? "deg" : f.count ? "" : len}
              value={draft.values[f.key] ?? ""}
              onChange={(v) => setValue(f.key, v)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="border-0 p-0">
        <legend className="mb-3">
          <Eyebrow>Quantity and allowance</Eyebrow>
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-qty`} className="font-medium text-heading">
              Pieces
            </label>
            <input
              id={`${uid}-qty`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={draft.qty}
              onChange={(e) => onChange({ ...draft, qty: e.target.value })}
              className="mt-2 w-full rounded-card border-[1.5px] border-line bg-page px-4 py-2.5 font-medium tabular-nums text-heading"
            />
          </div>
          <div>
            <label htmlFor={`${uid}-waste`} className="font-medium text-heading">
              Waste allowance
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id={`${uid}-waste`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.waste}
                onChange={(e) => onChange({ ...draft, waste: e.target.value })}
                className="w-full rounded-card border-[1.5px] border-line bg-page px-4 py-2.5 font-medium tabular-nums text-heading"
              />
              <span className="w-8 shrink-0 text-small text-muted">%</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {WASTE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  title={p.detail}
                  onClick={() => onChange({ ...draft, waste: String(p.value) })}
                  aria-pressed={draft.waste === String(p.value)}
                  className={`rounded-full border px-2.5 py-1 text-small tabular-nums transition duration-200 ease-out ${
                    draft.waste === String(p.value)
                      ? "border-line bg-heading text-page"
                      : "border-rule text-body hover:bg-sunk"
                  }`}
                >
                  {p.value}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="border-0 p-0">
        <legend className="mb-3">
          <Eyebrow>Gauge</Eyebrow>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...draft, gauge: null })}
            aria-pressed={draft.gauge === null}
            className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-small font-medium transition duration-200 ease-out ${
              draft.gauge === null
                ? "border-line bg-heading text-page"
                : "border-line text-heading hover:bg-sunk"
            }`}
          >
            From the table
          </button>
          {GAUGE_BANDS.map((b) => (
            <button
              key={b.gauge}
              type="button"
              onClick={() => onChange({ ...draft, gauge: b.gauge as GaugeName })}
              aria-pressed={draft.gauge === b.gauge}
              className={`rounded-full border-[1.5px] px-3 py-1.5 text-small font-medium tabular-nums transition duration-200 ease-out ${
                draft.gauge === b.gauge
                  ? "border-line bg-heading text-page"
                  : "border-line text-heading hover:bg-sunk"
              }`}
            >
              {b.gauge} ga
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-zone`} className="font-medium text-heading">
            Zone <span className="font-normal text-muted">optional</span>
          </label>
          <p className="mt-1 text-small text-muted">
            System, floor or area. Lines with the same name are totalled together.
          </p>
          <input
            id={`${uid}-zone`}
            type="text"
            autoComplete="off"
            list={`${uid}-zones`}
            placeholder="AHU-1, Level 3, Kitchen…"
            value={draft.zone}
            onChange={(e) => onChange({ ...draft, zone: e.target.value })}
            className="mt-2 w-full rounded-card border-[1.5px] border-line bg-page px-4 py-2.5 text-heading placeholder:text-muted"
          />
          {/* Whatever zones the takeoff already uses, offered back — so a job
            * does not end up with AHU-1, AHU 1 and ahu-1 as three zones. */}
          <datalist id={`${uid}-zones`}>
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor={`${uid}-note`} className="font-medium text-heading">
            Line note <span className="font-normal text-muted">optional</span>
          </label>
          <p className="mt-1 text-small text-muted">
            Anything that helps you recognise this line later.
          </p>
          <input
            id={`${uid}-note`}
            type="text"
            autoComplete="off"
            placeholder="Riser drop, AHU discharge…"
            value={draft.note}
            onChange={(e) => onChange({ ...draft, note: e.target.value })}
            className="mt-2 w-full rounded-card border-[1.5px] border-line bg-page px-4 py-2.5 text-heading placeholder:text-muted"
          />
        </div>
      </div>
    </div>
  );
}

export function fittingName(kind: FittingKind): string {
  return SPECS[kind].name;
}
