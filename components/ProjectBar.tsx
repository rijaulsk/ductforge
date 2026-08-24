"use client";

import { Download, FilePlus2, Printer, Trash2, Upload } from "lucide-react";
import { useId, useRef } from "react";
import type { Mode, Project } from "@/lib/duct/types";
import type { UnitSystem } from "@/lib/duct/units";
import ThemeToggle from "./ThemeToggle";
import { Button, Segmented } from "./ui";

/* Project chrome: which job, in what units, measured to which standard.
 *
 * The two standards get a segmented control rather than a tucked-away setting
 * because they are the single most consequential choice on the screen — the
 * same duct is a different quantity under each, and a user must never be
 * unsure which one they are looking at. Same for units.
 */

export default function ProjectBar({
  project,
  projects,
  onSelect,
  onPatch,
  onNew,
  onDelete,
  onExportCsv,
  onExportJson,
  onImport,
  onPrint,
  hasEntries,
}: {
  project: Project;
  projects: Project[];
  onSelect: (id: string) => void;
  onPatch: (patch: Partial<Project>) => void;
  onNew: () => void;
  onDelete: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImport: (file: File) => void;
  onPrint: () => void;
  hasEntries: boolean;
}) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-line bg-page/95 backdrop-blur print:hidden">
      <div className="mx-auto w-full max-w-canvas px-5 py-3 md:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="text-h3 font-bold tracking-tight text-heading">
            Duct<span className="text-accent">Forge</span>
          </p>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <label htmlFor={`${uid}-name`} className="sr-only">
              Project name
            </label>
            <input
              id={`${uid}-name`}
              type="text"
              value={project.name}
              onChange={(e) => onPatch({ name: e.target.value })}
              className="min-w-0 flex-1 rounded-card border-[1.5px] border-transparent bg-transparent px-3 py-2 font-medium text-heading hover:border-rule focus:border-line"
            />
            <label htmlFor={`${uid}-ref`} className="sr-only">
              Job reference
            </label>
            <input
              id={`${uid}-ref`}
              type="text"
              value={project.reference}
              placeholder="Job ref"
              onChange={(e) => onPatch({ reference: e.target.value })}
              className="hidden w-32 rounded-card border-[1.5px] border-transparent bg-transparent px-3 py-2 text-small text-body placeholder:text-muted hover:border-rule focus:border-line lg:block"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-project`} className="sr-only">
              Open a saved takeoff
            </label>
            <select
              id={`${uid}-project`}
              value={project.id}
              onChange={(e) => onSelect(e.target.value)}
              className="max-w-[11rem] truncate rounded-full border-[1.5px] border-line bg-page px-4 py-2 text-small font-medium text-heading"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || "Untitled takeoff"}
                </option>
              ))}
            </select>
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Segmented
              label="Unit system"
              size="sm"
              value={project.units}
              onChange={(v) => onPatch({ units: v as UnitSystem })}
              options={[
                { value: "metric", label: "Metric", title: "mm, m², kg" },
                { value: "imperial", label: "Imperial", title: "in, ft², lb" },
              ]}
            />
            <Segmented
              label="Measurement standard"
              size="sm"
              value={project.mode}
              onChange={(v) => onPatch({ mode: v as Mode })}
              options={[
                {
                  value: "billing",
                  label: "Billing",
                  title: "Nominal mean perimeter × centreline length — the BOQ standard",
                },
                {
                  value: "shop",
                  label: "Shop",
                  title: "True unfolded blank — slant, arc expansion, triangulation",
                },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onNew} className="!px-4 !py-2 !text-small">
              <FilePlus2 size={16} strokeWidth={1.5} /> New
            </Button>
            <Button
              onClick={() => fileRef.current?.click()}
              className="!px-4 !py-2 !text-small"
              title="Open a .json takeoff exported from DuctForge"
            >
              <Upload size={16} strokeWidth={1.5} /> Open
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Open a DuctForge project file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                /* Cleared so re-picking the same file fires change again. */
                e.target.value = "";
              }}
            />
            <Button onClick={onExportJson} className="!px-4 !py-2 !text-small">
              <Download size={16} strokeWidth={1.5} /> Save
            </Button>
            <Button
              onClick={onExportCsv}
              disabled={!hasEntries}
              className="!px-4 !py-2 !text-small"
              title={hasEntries ? "Export the schedule as CSV" : "Add a fitting first"}
            >
              CSV
            </Button>
            <Button
              onClick={onPrint}
              disabled={!hasEntries}
              className="!px-4 !py-2 !text-small"
              title={hasEntries ? "Print the BOQ sheet" : "Add a fitting first"}
            >
              <Printer size={16} strokeWidth={1.5} /> Print
            </Button>
            <Button
              onClick={onDelete}
              disabled={projects.length < 2}
              className="!px-4 !py-2 !text-small"
              title={
                projects.length < 2
                  ? "The last takeoff can't be deleted"
                  : "Delete this takeoff"
              }
            >
              <Trash2 size={16} strokeWidth={1.5} />
              <span className="sr-only">Delete this takeoff</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
