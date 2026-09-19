"use client";

import { Download, FilePlus2, FileOutput, Settings2, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { Mode, Project } from "@/lib/duct/types";
import type { UnitSystem } from "@/lib/duct/units";
import AppHeader from "./AppHeader";
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
  onExport,
  onDelete,
  hasEntries,
  canDelete,
}: {
  onNew: () => void;
  onOpen: () => void;
  onExportJson: () => void;
  onExport: () => void;
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
      {/* ONE EXPORT BUTTON, where there were three.
        *
        * CSV, CSV + working and Print sat side by side, and Print went straight
        * to the browser's dialog with a sheet nobody could change. They all
        * open the export dialog now — the PDF with a live preview and every
        * part switchable, the two CSVs a tap away beside it. Save stays out
        * here on its own because it is saving your work, not exporting it. */}
      <Button
        onClick={onExport}
        disabled={!hasEntries}
        size="sm"
        title={hasEntries ? "PDF, CSV and the rest — set up and preview" : "Add a fitting first"}
      >
        <FileOutput size={16} strokeWidth={1.5} /> Export
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
  onExportJson,
  onImport,
  onExport,
  hasEntries,
}: {
  project: Project;
  projects: Project[];
  onSelect: (id: string) => void;
  onPatch: (patch: Partial<Project>) => void;
  onNew: () => void;
  onDelete: () => void;
  onExportJson: () => void;
  onImport: (file: File) => void;
  /** Opens the export dialog: PDF with preview, both CSVs, the project file. */
  onExport: () => void;
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
      className="min-w-0 flex-1 rounded-card border-[1.5px] border-rule bg-page px-3 py-2 font-medium text-heading placeholder:font-normal placeholder:text-faint focus:border-line"
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
      onExport={andClose(onExport)}
      onDelete={andClose(onDelete)}
      hasEntries={hasEntries}
      canDelete={projects.length > 1}
    />
  );

  /* ---- phone ----
   * ONE ROW with AppHeader's tile and menu: the name, and a button that opens
   * the rest. It used to be the header's third row, under the logo and a row of
   * nav pills — 163 px of a 390 px phone's height before any content, charged
   * again every time the header slid back. See HeaderMenu.
   *
   * Explicit state rather than a <details>: the name field has to live in the
   * same row as the toggle, and an <input> inside a <summary> hands every tap
   * to the disclosure instead of to the field. */
  const phoneRow = (
    <>
        {/* ONE FILE INPUT for both layouts, and it lives HERE, in the part a
          * phone shows. iOS Safari will not open a picker for an input inside a
          * `display: none` parent, and the desktop block is exactly that on a
          * phone; desktop browsers open it hidden or not. */}
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
        <div className="flex items-center gap-2">
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

        {/* AN OVERLAY, NOT AN IN-FLOW BLOCK, and this is a real bug fix.
          *
          * The panel used to render inside the header's own flow. Opening it
          * grew the header by ~400px — from a quarter of a phone screen to
          * three quarters — and pushed the entire document down by that much
          * without the scroll position moving, so the content under your thumb
          * changed while you were looking at it.
          *
          * Worse: a `position: sticky` element TALLER THAN THE VIEWPORT can
          * never scroll its own bottom into view. On a smaller phone the last
          * two buttons in here — Print and Delete — were simply unreachable.
          *
          * Absolutely positioned, it overlays the page instead of displacing
          * it, and it scrolls internally if it runs out of room. Nothing below
          * moves, and nothing can become unreachable. */}
        {/* Hangs from the whole header (AppHeader's container is `relative`),
          * not from this row's narrow middle cell. */}
        {panelOpen && (
          <div
            id={`${uid}-panel`}
            className="absolute inset-x-3 top-full z-50 mt-2 max-h-[70svh] space-y-4 overflow-y-auto overscroll-contain rounded-card border-[1.5px] border-line bg-page p-4 shadow-none"
          >
            <div className="flex items-center gap-2">
              <label htmlFor={`${uid}-project-m`} className="sr-only">
                Open a saved takeoff
              </label>
              <div className="min-w-0 flex-1">{projectSelect(`${uid}-project-m`)}</div>
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
                className="w-full rounded-card border-[1.5px] border-rule bg-page px-3 py-2 text-small text-body placeholder:text-faint focus:border-line"
              />
            </div>
            {actions}
          </div>
        )}
    </>
  );

  /* No `right` prop: AppHeader mounts the theme toggle on every page now,
   * which is also how /standards and /guide got one at all — it used to be
   * mounted here and therefore existed only on the calculator. */
  return (
    <AppHeader current="calculator" held={panelOpen} phoneRow={phoneRow}>
      {/* ---- desktop ----
        * No container of its own: AppHeader's is the container, on every page.
        * This block used to carry `mx-auto max-w-canvas px-8`, which is why it
        * disagreed with the content pages between md and lg. */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
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
              className="w-32 shrink-0 rounded-card border-[1.5px] border-rule bg-page px-3 py-2 text-small text-body placeholder:text-faint focus:border-line"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-project`} className="sr-only">
              Open a saved takeoff
            </label>
            <div className="max-w-[11rem]">{projectSelect(`${uid}-project`)}</div>
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
    </AppHeader>
  );
}
