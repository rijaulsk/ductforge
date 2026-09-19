"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { toNumber } from "@/lib/duct/parse";
import type { Extra, ExtraCategory, ExtraShape, ExtraUnit, Project } from "@/lib/duct/types";
import { fmtExact, fmtValue, fromMm, lengthUnit, toMm, toValueMinor } from "@/lib/duct/units";
import {
  EXTRA_CATEGORIES,
  EXTRA_UNITS,
  PRESETS,
  computeExtras,
  describeExtraSize,
  fractionalUnit,
  normaliseQty,
} from "@/lib/extras";
import { newId } from "@/lib/project";
import { Actions } from "./Schedule";
import { Button } from "./ui";

/* Dampers, terminals, accessories and custom lines.
 *
 * A second list beside the takeoff, for everything on the job that is not
 * sheet metal this app cuts: the owner's "separate place to add VCD and other
 * calculations", 19 Sep 2026. It prints as its own table on the sheet and has
 * its own block in both CSVs. It never touches the duct's area or weight — the
 * panel says so, because that is the first thing an estimator would wonder.
 *
 * The form holds what was TYPED, as strings, and parses only on Add — the same
 * rule the fitting form follows, so a half-typed "1 1/2" is not rounded away
 * while it is being typed.
 */

const OTHER = "__other";

type Form = {
  category: ExtraCategory;
  /** The chosen preset's name, or OTHER for free text. */
  preset: string;
  item: string;
  shape: ExtraShape;
  w: string;
  h: string;
  d: string;
  qty: string;
  unit: ExtraUnit;
  rate: string;
  zone: string;
  note: string;
};

const lengthText = (mm: number, us: Project["units"]) => fmtExact(fromMm(mm, us), 6, false);

function formFor(category: ExtraCategory, us: Project["units"]): Form {
  const p = PRESETS[category][0];
  return {
    category,
    preset: p ? p.item : OTHER,
    item: p ? p.item : "",
    shape: p ? p.shape : "none",
    w: p?.shape === "rect" ? lengthText(600, us) : "",
    h: p?.shape === "rect" ? lengthText(400, us) : "",
    d: p?.shape === "round" ? lengthText(250, us) : "",
    qty: "1",
    unit: p ? p.unit : "nos",
    rate: "",
    zone: "",
    note: "",
  };
}

function formFromExtra(x: Extra, us: Project["units"]): Form {
  const known = PRESETS[x.category].some((p) => p.item === x.item);
  return {
    category: x.category,
    preset: known ? x.item : OTHER,
    item: x.item,
    shape: x.shape,
    w: x.shape === "rect" ? lengthText(x.w, us) : "",
    h: x.shape === "rect" ? lengthText(x.h, us) : "",
    d: x.shape === "round" ? lengthText(x.d, us) : "",
    qty: fmtExact(x.qty, 3, false),
    unit: x.unit,
    rate: x.rate ? String(x.rate) : "",
    zone: x.zone,
    note: x.note,
  };
}

const FIELD =
  "mt-1.5 h-11 w-full rounded-card border-[1.5px] border-line bg-page px-3 text-heading placeholder:text-faint";
const LABEL = "block text-small font-medium text-heading";

export default function ExtrasPanel({
  project,
  onChange,
}: {
  project: Project;
  onChange: (extras: Extra[]) => void;
}) {
  const uid = useId();
  const us = project.units;
  const len = lengthUnit(us);
  const [form, setForm] = useState<Form>(() => formFor("damper", us));
  const [editingId, setEditingId] = useState<string | null>(null);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const totals = computeExtras(project.extras);
  const currency = project.rates.label;

  const pickCategory = (category: ExtraCategory) => {
    setForm({ ...formFor(category, us), zone: form.zone });
    setEditingId(null);
  };

  /* A different item clears the rate. Kept, a VCD's price silently became the
   * fire damper's the moment the item changed — found in testing, and exactly
   * the kind of number nobody would notice until the invoice. Sizes and zone
   * stay: those carry over from one item to the next on a real job. */
  const pickPreset = (name: string) => {
    if (name === OTHER) {
      set({ preset: OTHER, item: "", rate: "" });
      return;
    }
    const p = PRESETS[form.category].find((x) => x.item === name);
    if (!p) return;
    set({
      preset: p.item,
      item: p.item,
      shape: p.shape,
      unit: p.unit,
      rate: "",
      w: p.shape === "rect" ? form.w || lengthText(600, us) : "",
      h: p.shape === "rect" ? form.h || lengthText(400, us) : "",
      d: p.shape === "round" ? form.d || lengthText(250, us) : "",
    });
  };

  const item = form.item.trim();

  const commit = () => {
    if (!item) return;
    const extra: Extra = {
      id: editingId ?? newId(),
      category: form.category,
      item,
      shape: form.shape,
      w: form.shape === "rect" ? toMm(toNumber(form.w), us) : 0,
      h: form.shape === "rect" ? toMm(toNumber(form.h), us) : 0,
      d: form.shape === "round" ? toMm(toNumber(form.d), us) : 0,
      qty: normaliseQty(toNumber(form.qty), form.unit),
      unit: form.unit,
      rate: toNumber(form.rate, 1e9),
      zone: form.zone.trim(),
      note: form.note.trim(),
    };
    if (editingId) {
      onChange(project.extras.map((x) => (x.id === editingId ? extra : x)));
      setEditingId(null);
      setForm({ ...formFor(form.category, us), zone: form.zone });
    } else {
      onChange([...project.extras, extra]);
      /* Keep the item and sizes — the next line on a job is usually the same
       * thing at another size — but put the quantity back to one. */
      set({ qty: "1", note: "" });
    }
  };

  const edit = (x: Extra) => {
    setForm(formFromExtra(x, us));
    setEditingId(x.id);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      {/* ---- the form ---- */}
      <div
        className="lg:col-span-5"
        onKeyDown={(e) => {
          /* Enter adds, as it does for fittings — from a text box only, so a
           * button or a select still gets its own Enter. */
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            commit();
          }
        }}
      >
        <p className={LABEL}>Type</p>
        <div role="group" aria-label="Type" className="mt-1.5 grid grid-cols-4 gap-1.5">
          {EXTRA_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              title={c.blurb}
              aria-pressed={form.category === c.key}
              onClick={() => pickCategory(c.key)}
              className={`h-10 min-w-0 truncate rounded-full border-[1.5px] border-line px-1 text-[13px] font-medium tracking-tight transition-colors duration-200 ease-out xs:text-small xs:tracking-normal ${
                form.category === c.key ? "bg-heading text-page" : "text-heading hover:bg-sunk"
              }`}
            >
              {c.short}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {/* Selects are labelled by `htmlFor`, never by wrapping: a label's
            * text content includes a nested select's OPTIONS, so a wrapped
            * select was announced as "Item Volume control damper (VCD) Round
            * volume control damper Fire damper…" — every choice, as its name. */}
          {PRESETS[form.category].length > 0 && (
            <div>
              <label htmlFor={`${uid}-item`} className={LABEL}>
                Item
              </label>
              <select
                id={`${uid}-item`}
                className={FIELD}
                value={form.preset}
                onChange={(e) => pickPreset(e.target.value)}
              >
                {PRESETS[form.category].map((p) => (
                  <option key={p.item} value={p.item}>
                    {p.item}
                  </option>
                ))}
                <option value={OTHER}>Other — type it</option>
              </select>
            </div>
          )}
          {form.preset === OTHER && (
            <label className={LABEL}>
              {PRESETS[form.category].length > 0 ? "What is it?" : "Item name"}
              <input
                className={FIELD}
                value={form.item}
                maxLength={120}
                placeholder={form.category === "custom" ? "Labour, sealant, transport…" : "Name of the item"}
                onChange={(e) => set({ item: e.target.value })}
              />
            </label>
          )}

          <div>
            <p className={LABEL}>Size</p>
            <div role="group" aria-label="Size" className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(
                [
                  ["rect", "W × H"],
                  ["round", "Round ⌀"],
                  ["none", "No size"],
                ] as const
              ).map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={form.shape === s}
                  onClick={() =>
                    set({
                      shape: s,
                      w: s === "rect" ? form.w || lengthText(600, us) : form.w,
                      h: s === "rect" ? form.h || lengthText(400, us) : form.h,
                      d: s === "round" ? form.d || lengthText(250, us) : form.d,
                    })
                  }
                  className={`h-10 rounded-full border-[1.5px] border-line text-small font-medium transition-colors duration-200 ease-out ${
                    form.shape === s ? "bg-heading text-page" : "text-heading hover:bg-sunk"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.shape !== "none" && (
              <div className={`mt-3 grid gap-3 ${form.shape === "rect" ? "grid-cols-2" : "grid-cols-1"}`}>
                {(form.shape === "rect" ? (["w", "h"] as const) : (["d"] as const)).map((k) => (
                  <label key={k} className={LABEL}>
                    {k === "w" ? "Width" : k === "h" ? "Height" : "Diameter"} ({len})
                    <input
                      className={`${FIELD} tabular-nums`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={form[k]}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => set({ [k]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 xs:grid-cols-3">
            <label className={LABEL}>
              Quantity
              <input
                className={`${FIELD} tabular-nums`}
                inputMode={fractionalUnit(form.unit) ? "decimal" : "numeric"}
                autoComplete="off"
                value={form.qty}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => set({ qty: e.target.value })}
              />
            </label>
            <div>
              <label htmlFor={`${uid}-unit`} className={LABEL}>
                Unit
              </label>
              <select
                id={`${uid}-unit`}
                className={FIELD}
                value={form.unit}
                onChange={(e) => set({ unit: e.target.value as ExtraUnit })}
              >
                {EXTRA_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <label className={`${LABEL} col-span-2 xs:col-span-1`}>
              Rate {currency && <span className="font-normal text-muted">{currency}</span>}{" "}
              <span className="font-normal text-muted">optional</span>
              <input
                className={`${FIELD} tabular-nums`}
                inputMode="decimal"
                autoComplete="off"
                value={form.rate}
                placeholder="per unit"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => set({ rate: e.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-3 xs:grid-cols-2">
            <label className={LABEL}>
              Zone <span className="font-normal text-muted">optional</span>
              <input
                className={FIELD}
                value={form.zone}
                maxLength={60}
                placeholder="AHU-1, Level 3…"
                onChange={(e) => set({ zone: e.target.value })}
              />
            </label>
            <label className={LABEL}>
              Note <span className="font-normal text-muted">optional</span>
              <input
                className={FIELD}
                value={form.note}
                maxLength={200}
                onChange={(e) => set({ note: e.target.value })}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button id={`${uid}-add`} onClick={commit} disabled={!item}>
              <Plus size={18} strokeWidth={2} />
              {editingId ? "Update item" : "Add item"}
            </Button>
            {editingId && (
              <Button
                variant="quiet"
                onClick={() => {
                  setEditingId(null);
                  setForm(formFor(form.category, us));
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          <p className="text-small text-muted">
            Counted, not calculated: these are listed on the sheet in their own table and are never
            added to the duct&rsquo;s area or weight.
          </p>
        </div>
      </div>

      {/* ---- the list ---- */}
      <div className="lg:col-span-7">
        {totals.rows.length === 0 ? (
          <div className="rounded-card border-[1.5px] border-dashed border-rule px-6 py-10">
            <p className="font-medium text-heading">No dampers, terminals or accessories yet.</p>
            <p className="mt-2 max-w-md text-small text-body">
              Add a VCD, a grille, an access door or a line of your own. They print on the PDF in
              their own table, with a value if you give them a rate.
            </p>
          </div>
        ) : (
          <>
            {totals.byCategory.map((cat) => (
              <section key={cat.category} className="mb-6">
                <h3 className="mb-2 text-eyebrow uppercase text-muted">{cat.label}</h3>
                <ul className="divide-y-[1.5px] divide-rule border-y-[1.5px] border-rule">
                  {totals.rows
                    .filter((r) => r.extra.category === cat.category)
                    .map(({ extra: x, index, valueMinor }) => (
                      <li
                        key={x.id}
                        className={`flex flex-col gap-2 py-3 xs:flex-row xs:items-start xs:justify-between xs:gap-3 ${
                          x.id === editingId ? "bg-sunk" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-heading">
                            <span className="tabular-nums text-muted">{index}. </span>
                            {x.item}{" "}
                            <span className="tabular-nums text-body">
                              ×{fmtExact(x.qty, 3)} {x.unit}
                            </span>
                          </p>
                          <p className="text-small tabular-nums text-body">
                            {[describeExtraSize(x, us) && `${describeExtraSize(x, us)} ${len}`, x.zone]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {x.rate > 0 && (
                            <p className="text-small tabular-nums text-body">
                              {fmtValue(toValueMinor(x.rate))} {currency} each ·{" "}
                              <span className="font-medium text-heading">
                                {fmtValue(valueMinor)} {currency}
                              </span>
                            </p>
                          )}
                          {x.note && <p className="text-small text-muted">{x.note}</p>}
                        </div>
                        <Actions
                          index={index}
                          noun="item"
                          onEdit={() => edit(x)}
                          onDuplicate={() => {
                            const i = project.extras.findIndex((e) => e.id === x.id);
                            const copy = { ...x, id: newId() };
                            onChange([...project.extras.slice(0, i + 1), copy, ...project.extras.slice(i + 1)]);
                          }}
                          onRemove={() => {
                            onChange(project.extras.filter((e) => e.id !== x.id));
                            if (editingId === x.id) setEditingId(null);
                          }}
                        />
                      </li>
                    ))}
                </ul>
              </section>
            ))}
            <p className="text-small text-body">
              {totals.rows.length} {totals.rows.length === 1 ? "item" : "items"}
              {totals.priced && (
                <>
                  {" "}
                  · value{" "}
                  <span className="font-medium tabular-nums text-heading">
                    {fmtValue(totals.valueMinor)} {currency}
                  </span>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
