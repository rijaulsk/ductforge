"use client";

import { Download, FilePlus2, Printer, Settings2, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { Mode, Project } from "@/lib/duct/types";
import type { UnitSystem } from "@/lib/duct/units";
import SiteNav from "./SiteNav";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";
import { Button, Segmented } from "./ui";

/* Project chrome: which job, in what units, measured to which standard.
 *
 * TWO LAYOUTS, and the mobile one is not the desktop one squeezed.
 *
 * The first version was one sticky block of two rows — a select, seven buttons,
 * two segmented controls and a theme toggle — which at 390px stacked into
 * roughly a third of the screen and stayed there, above a workspace that needs
 * every pixel. On a phone the bar is now ONE row (name, and a button that opens
 * the rest) and it is not sticky, so it scrolls away like any other header.
 * Everything it hides is one tap away in a `<details>`, which needs no state
 * and no JavaScript to open.
 *
 * Desktop keeps the full bar and keeps it sticky, because there the controls
 * cost nothing and being able to see which standard you are in at all times is
 * worth more than the pixels.
 *
 * The duplication between the two is deliberate. Rendering one set of controls
 * into two very different shells means either a wrapper that can express both
 * or a component that renders neither well.
 */

function Actions({
  onNew,
  onOpen,
  onExportJson,
  onExportCsv,
  onExportDetailed,
  onPrint,
  onDelete,
  hasEntries,
  canDelete,
}: {
  onNew: () => void;
  onOpen: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onExportDetailed: () => void;
  onPrint: () => void;
  onDelete: () => void;
  hasEntries: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onNew} size="sm">
        <FilePlus2 size={16} strokeWidth={1.5} /> New
      </Button>
      <Button onClick={onOpen} size="sm" title="Open a .json takeoff exported from DuctForge">
        <Upload size={16} strokeWidth={1.5} /> Open
      </Button>
      <Button onClick={onExportJson} size="sm">
        <Download size={16} strokeWidth={1.5} /> Save
      </Button>
      <Button
        onClick={onExportCsv}
        disabled={!hasEntries}
        size="sm"
        title={hasEntries ? "The schedule, as a spreadsheet" : "Add a fitting first"}
      >
        CSV
      </Button>
      {/* Two presentation levels of ONE calculation, never two calculations —
        * the detailed file is the standard one plus the working. */}
      <Button
        onClick={onExportDetailed}
        disabled={!hasEntries}
        size="sm"
        title={
          hasEntries
            ? "The same schedule with every calculation step written out"
            : "Add a fitting first"
        }
      >
        CSV + working
      </Button>
      <Button
        onClick={onPrint}
        disabled={!hasEntries}
        size="sm"
        title={hasEntries ? "Print the BOQ sheet" : "Add a fitting first"}
      >
        <Printer size={16} strokeWidth={1.5} /> Print
      </Button>
      <Button
        onClick={onDelete}
        disabled={!canDelete}
        size="sm"
        title={canDelete ? "Delete this takeoff" : "The last takeoff can't be deleted"}
      >
        <Trash2 size={16} strokeWidth={1.5} />
        <span className="sr-only">Delete this takeoff</span>
      </Button>
    </div>
  );
}

export default function ProjectBar({
  project,
  projects,
  onSelect,
  onPatch,
  onNew,
  onDelete,
  onExportCsv,
  onExportDetailed,
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
  onExportDetailed: () => void;
  onExportJson: () => void;
  onImport: (file: File) => void;
  onPrint: () => void;
  hasEntries: boolean;
}) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  /* Any action that changes what you are looking at closes the panel — on a
   * phone it covers the thing the action just did. */
  const andClose = (fn: () => void) => () => {
    setPanelOpen(false);
    fn();
  };

  const nameInput = (id: string) => (
    <input
      id={id}
      type="text"
      value={project.name}
      onChange={(e) => onPatch({ name: e.target.value })}
      placeholder="Untitled takeoff"
      className="min-w-0 flex-1 rounded-card border-[1.5px] border-rule bg-page px-3 py-2 font-medium text-heading placeholder:font-normal placeholder:text-muted focus:border-line"
    />
  );

  const projectSelect = (id: string) => (
    <select
      id={id}
      value={project.id}
      onChange={(e) => onSelect(e.target.value)}
      className="max-w-full truncate rounded-full border-[1.5px] border-line bg-page px-4 py-2 text-small font-medium text-heading"
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name || "Untitled takeoff"}
        </option>
      ))}
    </select>
  );

  const unitsControl = (
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
  );

  const modeControl = (
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
  );

  const actions = (
    <Actions
      onNew={andClose(onNew)}
      /* Inline rather than a hoisted `openFile` const: the ref must be read
       * inside the handler, not closed over by something built during render. */
      onOpen={() => {
        setPanelOpen(false);
        fileRef.current?.click();
      }}
      onExportJson={andClose(onExportJson)}
      onExportCsv={andClose(onExportCsv)}
      onExportDetailed={andClose(onExportDetailed)}
      onPrint={andClose(onPrint)}
      onDelete={andClose(onDelete)}
      hasEntries={hasEntries}
      canDelete={projects.length > 1}
    />
  );

  return (
    <header className="border-b-[1.5px] border-line bg-page lg:sticky lg:top-0 lg:z-40 lg:bg-page/95 lg:backdrop-blur print:hidden">
      {/* One file input for both layouts. */}
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

      {/* ---- phone ----
        * Explicit state rather than a <details>: the name field has to live in
        * the same row as the toggle, and an <input> inside a <summary> hands
        * every tap to the disclosure instead of to the field. */}
      <div className="lg:hidden">
        <div className="flex items-center gap-3 px-5 py-3">
          <Wordmark size="sm" />
          <label htmlFor={`${uid}-name-m`} className="sr-only">
            Project name
          </label>
          {nameInput(`${uid}-name-m`)}
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            aria-controls={`${uid}-panel`}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line transition duration-200 ease-out ${
              panelOpen ? "bg-heading text-page" : "text-heading"
            }`}
          >
            <Settings2 size={20} strokeWidth={1.5} />
            <span className="sr-only">
              {panelOpen ? "Hide takeoff settings" : "Show takeoff settings and actions"}
            </span>
          </button>
        </div>

        {panelOpen && (
          <div id={`${uid}-panel`} className="space-y-4 border-t-[1.5px] border-rule px-5 py-4">
            <SiteNav current="calculator" />
            <div className="flex items-center gap-2">
              <label htmlFor={`${uid}-project-m`} className="sr-only">
                Open a saved takeoff
              </label>
              <div className="min-w-0 flex-1">{projectSelect(`${uid}-project-m`)}</div>
              <ThemeToggle />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {unitsControl}
              {modeControl}
            </div>
            <div>
              <label htmlFor={`${uid}-ref-m`} className="sr-only">
                Job reference
              </label>
              <input
                id={`${uid}-ref-m`}
                type="text"
                value={project.reference}
                placeholder="Job reference"
                onChange={(e) => onPatch({ reference: e.target.value })}
                className="w-full rounded-card border-[1.5px] border-rule bg-page px-3 py-2 text-small text-body placeholder:text-muted focus:border-line"
              />
            </div>
            {actions}
          </div>
        )}
      </div>

      {/* ---- desktop ---- */}
      <div className="mx-auto hidden w-full max-w-canvas px-8 py-3 lg:block">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Wordmark size="sm" />
          <SiteNav current="calculator" className="shrink-0" />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <label htmlFor={`${uid}-name`} className="sr-only">
              Project name
            </label>
            {nameInput(`${uid}-name`)}
            <label htmlFor={`${uid}-ref`} className="sr-only">
              Job reference
            </label>
            <input
              id={`${uid}-ref`}
              type="text"
              value={project.reference}
              placeholder="Job ref"
              onChange={(e) => onPatch({ reference: e.target.value })}
              className="w-32 shrink-0 rounded-card border-[1.5px] border-rule bg-page px-3 py-2 text-small text-body placeholder:text-muted focus:border-line"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-project`} className="sr-only">
              Open a saved takeoff
            </label>
            <div className="max-w-[11rem]">{projectSelect(`${uid}-project`)}</div>
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {unitsControl}
            {modeControl}
          </div>
          {actions}
        </div>
      </div>
    </header>
  );
}
