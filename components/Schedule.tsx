"use client";

import { Copy, Pencil, X } from "lucide-react";
import { computeFor } from "@/lib/duct/compute";
import { describeFitting } from "@/lib/duct/describe";
import { SPECS } from "@/lib/duct/formulas";
import type { Project } from "@/lib/duct/types";
import { areaUnit, fmtArea, fmtMass, massUnit } from "@/lib/duct/units";
import FittingGlyph from "./FittingGlyph";

/* The takeoff schedule.
 *
 * A table on a desktop and a list of cards on a phone — not one table with a
 * horizontal scrollbar. Eleven columns of numbers at 390 px is a table nobody
 * reads; the card carries the same figures in the same order.
 *
 * Row actions are text and icon together with an accessible name that names
 * the line ("Edit line 3"), because "Edit" repeated eleven times down a column
 * is unusable with a screen reader.
 */

function Actions({
  index,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  index: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const cls =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule text-body transition duration-200 ease-out hover:bg-sunk hover:text-heading";
  return (
    <div className="flex justify-end gap-1.5">
      <button type="button" onClick={onEdit} className={cls} aria-label={`Edit line ${index}`}>
        <Pencil size={16} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className={cls}
        aria-label={`Duplicate line ${index}`}
      >
        <Copy size={16} strokeWidth={1.5} />
      </button>
      <button type="button" onClick={onRemove} className={cls} aria-label={`Remove line ${index}`}>
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export default function Schedule({
  project,
  editingId,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  /* The whole project, not (entries, mode, units): the weight depends on the
   * material and the value on the rates, and a component that took only the
   * three obvious props would compute a plausible wrong number for an
   * aluminium job. */
  project: Project;
  editingId: string | null;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const units = project.units;
  const au = areaUnit(units);
  const mu = massUnit(units);
  const showZone = project.entries.some((e) => e.zone.trim() !== "");

  const rows = project.entries.map((entry, i) => ({
    entry,
    index: i + 1,
    result: computeFor(project, entry),
    name: SPECS[entry.fitting.kind].name,
    dims: describeFitting(entry.fitting, units),
  }));

  return (
    <>
      {/* Desktop: a real table. */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Takeoff schedule, {project.mode === "billing" ? "billing" : "shop"} standard
          </caption>
          <thead>
            <tr className="border-b-[1.5px] border-line text-small">
              <th scope="col" className="py-3 pr-3 font-medium text-body">
                #
              </th>
              <th scope="col" className="py-3 pr-3 font-medium text-body">
                Fitting
              </th>
              <th scope="col" className="py-3 pr-3 text-right font-medium text-body">
                Qty
              </th>
              <th scope="col" className="py-3 pr-3 text-right font-medium text-body">
                Gauge
              </th>
              <th scope="col" className="py-3 pr-3 text-right font-medium text-body">
                Net {au}
              </th>
              <th scope="col" className="py-3 pr-3 text-right font-medium text-body">
                Waste
              </th>
              <th scope="col" className="py-3 pr-3 text-right font-medium text-body">
                Gross {au}
              </th>
              <th scope="col" className="py-3 pr-3 text-right font-medium text-body">
                Weight {mu}
              </th>
              <th scope="col" className="py-3 text-right font-medium text-body print:hidden">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, index, result, name, dims }) => (
              <tr
                key={entry.id}
                className={`border-b border-rule align-top ${
                  entry.id === editingId ? "bg-sunk" : ""
                }`}
              >
                <td className="py-3 pr-3 tabular-nums text-muted">{index}</td>
                <td className="py-3 pr-3">
                  <div className="flex items-start gap-3">
                    <FittingGlyph kind={entry.fitting.kind} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <p className="font-medium text-heading">
                        {name}
                        {showZone && entry.zone.trim() && (
                          <span className="ml-2 rounded-full border border-rule px-2 py-0.5 text-small font-normal text-body">
                            {entry.zone.trim()}
                          </span>
                        )}
                      </p>
                      <p className="text-small tabular-nums text-body">{dims}</p>
                      {entry.note && <p className="text-small text-muted">{entry.note}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-3 text-right tabular-nums text-heading">{entry.qty}</td>
                <td className="py-3 pr-3 text-right tabular-nums text-heading">
                  {result.gauge} ga
                  {!result.gaugeAuto && (
                    <span className="block text-small text-muted">set by hand</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums text-heading">
                  {fmtArea(result.netAreaMinor)}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums text-body">{entry.waste}%</td>
                <td className="py-3 pr-3 text-right font-medium tabular-nums text-heading">
                  {fmtArea(result.grossAreaMinor)}
                </td>
                <td className="py-3 pr-3 text-right font-medium tabular-nums text-heading">
                  {fmtMass(result.massMinor)}
                </td>
                <td className="py-3 print:hidden">
                  <Actions
                    index={index}
                    onEdit={() => onEdit(entry.id)}
                    onDuplicate={() => onDuplicate(entry.id)}
                    onRemove={() => onRemove(entry.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: the same figures, stacked. */}
      <ul className="divide-y-[1.5px] divide-rule border-y-[1.5px] border-rule lg:hidden">
        {rows.map(({ entry, index, result, name, dims }) => (
          <li key={entry.id} className={`py-4 ${entry.id === editingId ? "bg-sunk" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <FittingGlyph kind={entry.fitting.kind} className="mt-1 shrink-0 text-accent" />
                <div>
                  <p className="font-medium text-heading">
                    <span className="tabular-nums text-muted">{index}. </span>
                    {name} <span className="tabular-nums text-body">×{entry.qty}</span>
                  </p>
                  <p className="text-small tabular-nums text-body">{dims}</p>
                  {showZone && entry.zone.trim() && (
                    <p className="text-small text-body">{entry.zone.trim()}</p>
                  )}
                  {entry.note && <p className="text-small text-muted">{entry.note}</p>}
                </div>
              </div>
              <Actions
                index={index}
                onEdit={() => onEdit(entry.id)}
                onDuplicate={() => onDuplicate(entry.id)}
                onRemove={() => onRemove(entry.id)}
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-small sm:grid-cols-4">
              <div className="flex justify-between sm:block">
                <dt className="text-muted">Gauge</dt>
                <dd className="tabular-nums text-heading">{result.gauge} ga</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted">Net {au}</dt>
                <dd className="tabular-nums text-heading">{fmtArea(result.netAreaMinor)}</dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted">
                  Gross {au} <span className="tabular-nums">(+{entry.waste}%)</span>
                </dt>
                <dd className="font-medium tabular-nums text-heading">
                  {fmtArea(result.grossAreaMinor)}
                </dd>
              </div>
              <div className="flex justify-between sm:block">
                <dt className="text-muted">Weight {mu}</dt>
                <dd className="font-medium tabular-nums text-heading">
                  {fmtMass(result.massMinor)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
