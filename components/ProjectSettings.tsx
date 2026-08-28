"use client";

import { Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { MATERIALS, MATERIAL_KEYS } from "@/lib/duct/material";
import { toNumber } from "@/lib/duct/parse";
import type { Ancillaries, MaterialKey, Project, Rates } from "@/lib/duct/types";
import {
  type UnitSystem,
  areaUnit,
  fromMm,
  lengthUnit,
  massUnit,
  toMm,
} from "@/lib/duct/units";
import { Button, Eyebrow, Note } from "./ui";

/* Everything that applies to the whole takeoff rather than to one line.
 *
 * All of it is OFF by default and stays off until someone sets it. A schedule
 * that arrives with insulation already counted at a thickness nobody chose is a
 * schedule with a number in it that no human decided — and this app's entire
 * claim is that there are none of those.
 *
 * Held in a `<details>` so the disclosure needs no JavaScript and no state, and
 * so the workspace opens on the thing people came for.
 *
 * The inputs keep the RAW STRING typed, like every other numeric field here,
 * and are re-seeded by remounting when the unit system changes — the parent
 * keys this component on it. That is why there is no effect syncing props into
 * state: there is nothing to sync, because the component is a new one.
 */

type Preset = { label: string; mm: number };

const LENGTH_PRESETS: Record<UnitSystem, { standard: Preset[]; support: Preset[] }> = {
  metric: {
    standard: [
      { label: "Off", mm: 0 },
      { label: "1.2 m", mm: 1200 },
      { label: "1.5 m", mm: 1500 },
      { label: "3 m", mm: 3000 },
    ],
    support: [
      { label: "Off", mm: 0 },
      { label: "2.4 m", mm: 2400 },
      { label: "3 m", mm: 3000 },
    ],
  },
  imperial: {
    standard: [
      { label: "Off", mm: 0 },
      { label: "4 ft", mm: 1219.2 },
      { label: "5 ft", mm: 1524 },
      { label: "10 ft", mm: 3048 },
    ],
    support: [
      { label: "Off", mm: 0 },
      { label: "8 ft", mm: 2438.4 },
      { label: "10 ft", mm: 3048 },
    ],
  },
};

const INSULATION_PRESETS: Record<UnitSystem, Preset[]> = {
  metric: [
    { label: "None", mm: 0 },
    { label: "13 mm", mm: 13 },
    { label: "25 mm", mm: 25 },
    { label: "50 mm", mm: 50 },
  ],
  imperial: [
    { label: "None", mm: 0 },
    { label: "½″", mm: 12.7 },
    { label: "1″", mm: 25.4 },
    { label: "2″", mm: 50.8 },
  ],
};

function Presets({
  presets,
  value,
  onPick,
}: {
  presets: Preset[];
  value: number;
  onPick: (mm: number) => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {presets.map((p) => {
        const on = Math.abs(value - p.mm) < 0.05;
        return (
          <button
            key={p.label}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(p.mm)}
            className={`rounded-full border px-2.5 py-1 text-small tabular-nums transition duration-200 ease-out ${
              on ? "border-line bg-heading text-page" : "border-rule text-body hover:bg-sunk"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberField({
  id,
  label,
  hint,
  suffix,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  /* THE INPUTS IN A ROW HAVE TO LINE UP, and they did not.
   *
   * `hint` is optional and every field's is a different length — "Thickness on
   * the outside of the duct." against "Sets how many pieces a straight run is,
   * and so the flange count." — so in a three-column grid each label block was
   * a different height and each input box started at a different y. Three boxes
   * on three different lines, which is what was reported.
   *
   * The label block now reserves two lines of hint whether or not it has them,
   * so the inputs align across the row at every width. A fixed reservation
   * beats `items-end` here because the presets underneath have to line up too,
   * and they hang off the input rather than off the grid cell. */
  return (
    <div>
      <div className="min-h-[4.25rem]">
        <label htmlFor={id} className="font-medium text-heading">
          {label}
        </label>
        {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-card border-[1.5px] border-line bg-page px-4 py-2.5 font-medium tabular-nums text-heading"
        />
        <span className="w-12 shrink-0 text-small text-muted">{suffix}</span>
      </div>
    </div>
  );
}

export default function ProjectSettings({
  project,
  savedCount,
  onPatch,
  onClearAll,
}: {
  project: Project;
  /** How many takeoffs this browser is holding — the answer to "where did all
   * these files come from?", which is localStorage and nowhere else. */
  savedCount: number;
  onPatch: (patch: Partial<Project>) => void;
  onClearAll: () => void;
}) {
  const uid = useId();
  /* Two taps to wipe everything, rather than a window.confirm: the native
   * dialog is a different visual language, and an irreversible action deserves
   * a deliberate second press either way. */
  const [armed, setArmed] = useState(false);
  const us = project.units;
  const len = lengthUnit(us);

  const show = (mm: number) => (mm === 0 ? "" : String(Number(fromMm(mm, us).toFixed(2))));

  const [insulation, setInsulation] = useState(() => show(project.ancillaries.insulationMm));
  const [standard, setStandard] = useState(() => show(project.ancillaries.standardLengthMm));
  const [support, setSupport] = useState(() => show(project.ancillaries.supportSpacingMm));
  const [perKg, setPerKg] = useState(() =>
    project.rates.perKg ? String(project.rates.perKg) : "",
  );
  const [perM2, setPerM2] = useState(() =>
    project.rates.perM2 ? String(project.rates.perM2) : "",
  );

  const patchAnc = (patch: Partial<Ancillaries>) =>
    onPatch({ ancillaries: { ...project.ancillaries, ...patch } });
  const patchRates = (patch: Partial<Rates>) =>
    onPatch({ rates: { ...project.rates, ...patch } });

  const lengths = LENGTH_PRESETS[us];

  return (
    <details className="rounded-card border-[1.5px] border-line bg-card">
      <summary className="cursor-pointer list-none px-5 py-4 md:px-6">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>
            <Eyebrow>Applies to every line</Eyebrow>
            <span className="mt-1.5 block text-h3 font-bold text-heading">
              Material and allowances
            </span>
          </span>
          <span className="text-small text-body">
            {MATERIALS[project.material].short}
            {project.ancillaries.insulationMm > 0 &&
              ` · ${Number(fromMm(project.ancillaries.insulationMm, us).toFixed(2))} ${len} insulation`}
            {project.ancillaries.standardLengthMm > 0 && " · flanges"}
            {project.ancillaries.supportSpacingMm > 0 && " · hangers"}
            {(project.rates.perKg > 0 || project.rates.perM2 > 0) && " · rates"}
          </span>
        </span>
      </summary>

      <div className="space-y-7 border-t-[1.5px] border-rule px-5 py-6 md:px-6">
        <fieldset className="border-0 p-0">
          <legend className="mb-3">
            <Eyebrow>Sheet material</Eyebrow>
          </legend>
          <div className="flex flex-wrap gap-2">
            {MATERIAL_KEYS.map((key) => {
              const on = key === project.material;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPatch({ material: key as MaterialKey })}
                  className={`rounded-full border-[1.5px] px-4 py-2 text-small font-medium transition duration-200 ease-out ${
                    on ? "border-line bg-heading text-page" : "border-line text-heading hover:bg-sunk"
                  }`}
                >
                  {MATERIALS[key].name}
                </button>
              );
            })}
          </div>
          <p className="mt-3 max-w-2xl text-small text-body">
            {MATERIALS[project.material].note}
          </p>
        </fieldset>

        <fieldset className="border-0 p-0">
          <legend className="mb-3">
            <Eyebrow>Also count</Eyebrow>
          </legend>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <NumberField
                id={`${uid}-ins`}
                label="Insulation"
                hint="Thickness on the outside of the duct."
                suffix={len}
                value={insulation}
                onChange={(v) => {
                  setInsulation(v);
                  patchAnc({ insulationMm: toMm(toNumber(v), us) });
                }}
              />
              <Presets
                presets={INSULATION_PRESETS[us]}
                value={project.ancillaries.insulationMm}
                onPick={(mm) => {
                  setInsulation(show(mm));
                  patchAnc({ insulationMm: mm });
                }}
              />
            </div>
            <div>
              <NumberField
                id={`${uid}-std`}
                label="Duct supplied in"
                hint="Sets how many pieces a straight run is, and so the flange count."
                suffix={len}
                value={standard}
                onChange={(v) => {
                  setStandard(v);
                  patchAnc({ standardLengthMm: toMm(toNumber(v), us) });
                }}
              />
              <Presets
                presets={lengths.standard}
                value={project.ancillaries.standardLengthMm}
                onPick={(mm) => {
                  setStandard(show(mm));
                  patchAnc({ standardLengthMm: mm });
                }}
              />
            </div>
            <div>
              <NumberField
                id={`${uid}-sup`}
                label="Hanger spacing"
                hint="One support per piece, plus one per further full spacing."
                suffix={len}
                value={support}
                onChange={(v) => {
                  setSupport(v);
                  patchAnc({ supportSpacingMm: toMm(toNumber(v), us) });
                }}
              />
              <Presets
                presets={lengths.support}
                value={project.ancillaries.supportSpacingMm}
                onPick={(mm) => {
                  setSupport(show(mm));
                  patchAnc({ supportSpacingMm: mm });
                }}
              />
            </div>
          </div>
          <div className="mt-4 max-w-3xl">
            <Note label="How these are counted">
              Insulation is the billing formula re-run with every cross-section dimension grown by
              twice the thickness — the centreline never moves. Every piece is counted with a flange
              at each end, a straight run being as many pieces as the supplied length divides into.
              None of the three is a new measurement; all come from the geometry you already typed.
            </Note>
          </div>
        </fieldset>

        <fieldset className="border-0 p-0">
          <legend className="mb-3">
            <Eyebrow>Your rates</Eyebrow>
          </legend>
          <div className="grid gap-6 md:grid-cols-3">
            <NumberField
              id={`${uid}-perkg`}
              label={`Rate per ${massUnit(us)}`}
              suffix={project.rates.label || "—"}
              value={perKg}
              onChange={(v) => {
                setPerKg(v);
                patchRates({ perKg: toNumber(v, 1_000_000) });
              }}
            />
            <NumberField
              id={`${uid}-perm2`}
              label={`Rate per ${areaUnit(us)}`}
              suffix={project.rates.label || "—"}
              value={perM2}
              onChange={(v) => {
                setPerM2(v);
                patchRates({ perM2: toNumber(v, 1_000_000) });
              }}
            />
            <div>
              <label htmlFor={`${uid}-cur`} className="font-medium text-heading">
                Currency <span className="font-normal text-muted">optional</span>
              </label>
              <p className="mt-1 text-small text-muted">
                Whatever you want printed next to the figure.
              </p>
              <input
                id={`${uid}-cur`}
                type="text"
                autoComplete="off"
                maxLength={8}
                placeholder="₹, AED, GBP…"
                value={project.rates.label}
                onChange={(e) => patchRates({ label: e.target.value })}
                className="mt-2 w-full rounded-card border-[1.5px] border-line bg-page px-4 py-2.5 text-heading placeholder:text-muted"
              />
            </div>
          </div>
          <div className="mt-4 max-w-3xl">
            <Note label="Rates">
              Your figures, applied to your quantities. Set one or both — value is weight × the rate
              per {massUnit(us)}, plus gross area × the rate per {areaUnit(us)}. Leave them empty
              and the takeoff prints quantities only.
            </Note>
          </div>
        </fieldset>

        <fieldset className="border-0 p-0">
          <legend className="mb-3">
            <Eyebrow>Where this is saved</Eyebrow>
          </legend>
          <p className="max-w-3xl text-small text-body">
            {savedCount === 1 ? "One takeoff is" : `${savedCount} takeoffs are`} stored in this
            browser&rsquo;s local storage, on this device only. Nothing is uploaded, and nothing is
            shared between your phone and your desktop — use <strong>Save</strong> to write a
            project file if you need to move a job or keep a backup. Clearing your browser data
            clears these.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => (armed ? onClearAll() : setArmed(true))}
              className={armed ? "border-danger-500" : undefined}
            >
              <Trash2 size={16} strokeWidth={1.5} />
              {armed ? "Tap again to delete everything" : "Delete every saved takeoff"}
            </Button>
            {armed && (
              <Button size="sm" variant="quiet" onClick={() => setArmed(false)}>
                Cancel
              </Button>
            )}
          </div>
          {armed && (
            <p className="mt-3 max-w-3xl text-small text-body">
              <span className="font-bold text-heading">This cannot be undone.</span> Every saved
              takeoff in this browser is removed and you start with one empty job. Files you have
              already saved to disk are untouched.
            </p>
          )}
        </fieldset>
      </div>
    </details>
  );
}
