"use client";

import { Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ViewKind } from "@/lib/draw";
import { computeFor, computeTotals } from "@/lib/duct/compute";
import { SPECS } from "@/lib/duct/formulas";
import { areaUnit, fmtArea, fmtMass, massUnit } from "@/lib/duct/units";
import { toQty, toWaste } from "@/lib/duct/parse";
import type { Entry, FittingKind, Project } from "@/lib/duct/types";
import { type Draft, convertDraft, draftFromEntry, fittingFromDraft, newDraft } from "@/lib/draft";
import { toCsv, toDetailedCsv } from "@/lib/export/csv";
import { safeFilename, triggerDownload } from "@/lib/export/download";
import { useHasMounted } from "@/lib/hooks";
import { blankProject, fromProjectFile, newId, toProjectFile } from "@/lib/project";
import { clearAll, initialState, saveActiveId, saveProjects } from "@/lib/storage";
import BoqSheet from "./BoqSheet";
import ChartsPanel from "./ChartsPanel";
import FittingPicker from "./FittingPicker";
import ParamForm from "./ParamForm";
import ProjectBar from "./ProjectBar";
import ProjectSettings from "./ProjectSettings";
import ResultPanel from "./ResultPanel";
import Schedule from "./Schedule";
import Totals from "./Totals";
import Viewer from "./Viewer";
import { Button, Card, Eyebrow, Note, PanelHeading } from "./ui";

/* The workspace.
 *
 * One `useState` holds every saved takeoff and which one is open; a second
 * holds the fitting currently being configured. Curried updaters do the rest —
 * no reducer, matching the sibling repos, because the state is a document
 * rather than a state machine and a reducer would add a layer of indirection
 * over what is really just "replace this field".
 *
 * The draft is deliberately NOT an entry. A half-typed width has to be able to
 * be a half-typed width; it becomes a schedule line only when someone presses
 * the one clay button on the screen.
 */

type Notice = { tone: "info" | "error"; text: string } | null;

/**
 * The four places the tool has, below `lg`.
 *
 * Every one of them used to be a scroll: the form, the drawing, the live
 * result and the schedule were four full-width blocks stacked down a six
 * thousand pixel page. They are one screen and a tap now.
 */
type Tab = "fitting" | "drawing" | "result" | "takeoff";

const TABS: { key: Tab; label: string }[] = [
  { key: "fitting", label: "Fitting" },
  { key: "drawing", label: "Drawing" },
  { key: "result", label: "Result" },
  { key: "takeoff", label: "Takeoff" },
];

export default function Workspace() {
  const [hydrated, setHydrated] = useState(false);
  /* Only meaningful below `lg`; at `lg` every panel is visible at once and the
   * classes that read this are overridden. */
  const [tab, setTab] = useState<Tab>("fitting");

  /* THE WORKSPACE RENDERS IMMEDIATELY, EMPTY, AND FILLS IN.
   *
   * It used to render a placeholder until `mounted` and then swap in the whole
   * application — a few hundred pixels of text replaced by a two-column
   * workspace, which is about as large a layout shift as a page can have, on
   * every single load.
   *
   * Now the real components render from the first frame with a blank takeoff,
   * and the effect below replaces that state with whatever was saved. The tree
   * does not change shape, so nothing jumps; only the numbers in it do. The
   * blank project is deterministic apart from its id, which is never rendered,
   * so the server pass and the hydration pass agree. */
  const [store, setStore] = useState(() => ({
    projects: [blankProject()],
    activeId: "",
  }));

  /* Adjusted during render, not in an effect.
   *
   * `useHasMounted` is a `useSyncExternalStore` that flips once, so this runs
   * exactly once and the guard stops it looping. React documents this as the
   * way to derive state from something only the client knows; doing it in an
   * effect causes the cascading re-render that `react-hooks/set-state-in-effect`
   * exists to catch, and renders one extra frame of an empty takeoff. */
  const mounted = useHasMounted();
  if (mounted && !hydrated) {
    setHydrated(true);
    setStore(initialState());
  }

  const project = store.projects.find((p) => p.id === store.activeId) ?? store.projects[0];

  const [draft, setDraft] = useState<Draft>(() => newDraft("straight", 12, "metric"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<ViewKind>("blueprint");
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    /* NEVER WRITE BEFORE WE HAVE READ. The first render holds a blank takeoff,
     * and persisting that would overwrite the saved one in the moment between
     * mounting and loading. */
    if (!hydrated) return;
    saveProjects(store.projects);
    saveActiveId(store.activeId);
  }, [store, hydrated]);

  /* ---- project-level updates ------------------------------------------- */

  const patchProject = (patch: Partial<Project>) => {
    /* Saved entries are stored in millimetres and never need converting. The
     * half-typed draft does: switching to imperial with 600 in the width must
     * show 23.622, not leave a 600 that now means inches. */
    if (patch.units && patch.units !== project.units) {
      setDraft((d) => convertDraft(d, project.units, patch.units!));
    }
    setStore((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === project.id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    }));
  };

  const patchEntries = (entries: Entry[]) => patchProject({ entries });

  const selectProject = (id: string) => {
    const next = store.projects.find((p) => p.id === id);
    if (!next) return;
    setStore((s) => ({ ...s, activeId: id }));
    setDraft(newDraft(draft.kind, next.waste, next.units));
    setEditingId(null);
    setNotice(null);
  };

  const addProject = (p: Project) => {
    setStore((s) => ({ projects: [...s.projects, p], activeId: p.id }));
    setDraft(newDraft("straight", p.waste, p.units));
    setEditingId(null);
  };

  const deleteProject = () => {
    if (store.projects.length < 2) return;
    setStore((s) => {
      const projects = s.projects.filter((p) => p.id !== project.id);
      return { projects, activeId: projects[0].id };
    });
    setEditingId(null);
    setNotice({ tone: "info", text: "Takeoff deleted." });
  };

  /* Wipes local storage and starts again from one empty job. The effect below
   * would rewrite the keys from state anyway, so clearing the store without
   * clearing state would put everything straight back. */
  const clearEverything = () => {
    clearAll();
    const fresh = blankProject();
    setStore({ projects: [fresh], activeId: fresh.id });
    setDraft(newDraft("straight", fresh.waste, fresh.units));
    setEditingId(null);
    setNotice({ tone: "info", text: "Every saved takeoff on this device has been deleted." });
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const result = fromProjectFile(text);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error });
      return;
    }
    addProject(result.project);
    setNotice({
      tone: "info",
      text: `Opened “${result.project.name}” — ${result.project.entries.length} lines.`,
    });
  };

  /* ---- the draft --------------------------------------------------------- */

  /* The zone carries across a fitting change. Someone taking off AHU-1 works
   * through a dozen fittings in that zone and should not retype it each time. */
  const pickKind = (kind: FittingKind) => {
    setDraft(newDraft(kind, project.waste, project.units, draft.zone));
    setEditingId(null);
  };

  /* Reads the draft's stored millimetres, not its display strings — see
   * lib/draft.ts for why those are two different things. */
  const fitting = fittingFromDraft(draft);
  const previewEntry: Entry = {
    id: editingId ?? "draft",
    fitting,
    qty: toQty(draft.qty),
    waste: toWaste(draft.waste),
    gauge: draft.gauge,
    zone: draft.zone.trim(),
    note: draft.note.trim(),
  };
  const preview = computeFor(project, previewEntry);

  const commit = () => {
    if (editingId) {
      patchEntries(
        project.entries.map((e) => (e.id === editingId ? { ...previewEntry, id: editingId } : e)),
      );
      setEditingId(null);
      setNotice({ tone: "info", text: "Line updated." });
      return;
    }
    patchEntries([...project.entries, { ...previewEntry, id: newId() }]);
    setNotice(null);
  };

  const editEntry = (id: string) => {
    const entry = project.entries.find((e) => e.id === id);
    if (!entry) return;
    setDraft(draftFromEntry(entry, project.units));
    setEditingId(id);
  };

  const duplicateEntry = (id: string) => {
    const i = project.entries.findIndex((e) => e.id === id);
    if (i < 0) return;
    const copy = { ...project.entries[i], id: newId() };
    patchEntries([...project.entries.slice(0, i + 1), copy, ...project.entries.slice(i + 1)]);
  };

  const removeEntry = (id: string) => {
    patchEntries(project.entries.filter((e) => e.id !== id));
    if (editingId === id) setEditingId(null);
  };

  /* ---- exports ------------------------------------------------------------ */

  const exportCsv = () =>
    triggerDownload(
      new Blob([toCsv(project)], { type: "text/csv;charset=utf-8" }),
      safeFilename(project.name, "csv"),
    );

  /* Same calculation, more of it shown — see lib/export/csv.ts. */
  const exportDetailed = () =>
    triggerDownload(
      new Blob([toDetailedCsv(project)], { type: "text/csv;charset=utf-8" }),
      safeFilename(project.name, "csv", "working"),
    );

  const exportJson = () =>
    triggerDownload(
      new Blob([toProjectFile(project)], { type: "application/json" }),
      safeFilename(project.name, "json", "project"),
    );

  const totals = computeTotals(project);
  const spec = SPECS[draft.kind];
  /* Zone names already in play, offered back on the form so a job does not end
   * up with AHU-1, AHU 1 and ahu-1 as three separate zones. */
  const zones = [
    ...new Set(project.entries.map((e) => e.zone.trim()).filter(Boolean)),
  ].sort();

  /* There is no placeholder branch any more. The workspace renders on the
   * first frame with a blank takeoff and fills in — see the state above. The
   * SEO content a crawler needs lives in the server-rendered section below the
   * tool (components/AboutTheTool.tsx), which is a better home for it than a
   * block that vanished on hydration. */
  return (
    <>
      <ProjectBar
        project={project}
        projects={store.projects}
        onSelect={selectProject}
        onPatch={patchProject}
        onNew={() => addProject(blankProject(`Takeoff ${store.projects.length + 1}`))}
        onDelete={deleteProject}
        onExportCsv={exportCsv}
        onExportDetailed={exportDetailed}
        onExportJson={exportJson}
        onImport={(f) => void importFile(f)}
        onPrint={() => window.print()}
        hasEntries={project.entries.length > 0}
      />

      {/* The workspace has no visible page title — the project bar's wordmark
        * reads as branding, and it is rendered twice for the two layouts. So
        * the document's one h1 lives here, where there is exactly one of it. */}
      <h1 className="sr-only">DuctForge — HVAC duct takeoff calculator</h1>

      <main className="mx-auto w-full max-w-canvas px-5 pb-24 pt-8 md:px-8 md:pt-10 print:hidden">
        <div aria-live="polite">
          {notice && (
            <p
              className={`mb-6 rounded-card border-[1.5px] px-4 py-3 text-small ${
                notice.tone === "error"
                  ? "border-danger-500 text-heading"
                  : "border-rule text-body"
              }`}
            >
              {notice.tone === "error" && <span className="font-bold">Couldn&rsquo;t open that. </span>}
              {notice.text}
            </p>
          )}
        </div>

        {/* ---- THE TOOL: ONE SCREEN, NEVER A SCROLL ------------------------
          *
          * This was ten stacked full-width blocks and about six thousand pixels
          * on a phone, with the one button that does anything sitting fourteen
          * hundred pixels down. You scrolled a screen and a half to add a
          * fitting, then scrolled back to change it.
          *
          * It is an app now, not a page. The work area is exactly one viewport
          * tall and every panel inside it scrolls ITSELF; below `lg` the panels
          * become tabs, so only one is on screen at a time and the live result
          * and the primary action live in a bar that is always there.
          *
          * The explainer and the footer still sit below all of this, in the DOM
          * and server-rendered, because they are what the page is found by. The
          * rule is not "the document never scrolls" — it is that you never
          * scroll to USE the tool. */}
        <div className={`${tab === "takeoff" ? "hidden" : ""} lg:block`}>
          {/* The mobile tab bar. Four destinations, and every one of them is a
            * thing you were previously scrolling to. */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto lg:hidden" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-1.5 text-small font-medium transition-colors duration-200 ease-out ${
                  tab === t.key
                    ? "border-line bg-heading text-page"
                    : "border-transparent text-body hover:bg-sunk"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:h-[calc(100svh-9rem)] lg:grid-cols-12 lg:gap-8">
            <Card
              as="section"
              className={`lg:col-span-5 lg:flex lg:min-h-0 lg:flex-col ${
                tab === "fitting" ? "" : "hidden lg:flex"
              }`}
            >
            {/* Our own listbox, not a `<select>`: the native list picked its
              * own side and picked upward when the control sat low, and it had
              * no room for the glyph or the alias. See FittingPicker. */}
            {/* The form scrolls, the action does not. On a long fitting like a
              * Y-piece the fields overflow; the button stays pinned below them
              * so it is never the thing you have to scroll to reach. */}
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            <div>
              <Eyebrow>Step one</Eyebrow>
              <p className="mb-3 mt-2 text-h3 font-bold text-heading">Fitting</p>
              <FittingPicker value={draft.kind} onChange={pickKind} />
            </div>

            <div className="mt-7 border-t-[1.5px] border-rule pt-7">
              {/* BOTH NAMES, because one fitting has several and all of them
                * are right to somebody. Renaming Reducer to Transition was
                * correct and made the picker unfindable for everyone who
                * learned the other word — see `aka` in lib/duct/formulas.ts.
                *
                * `formerly` is separate and worded as a correction, not as a
                * synonym: somebody who used this app before needs to find the
                * fitting they remember, but printing the old name as though it
                * were a trade name would re-import the mistake. */}
              <div className="mb-5">
                <Eyebrow>Step two</Eyebrow>
                <h2 className="mt-2 text-h3 font-bold text-heading">{spec.name} dimensions</h2>
                <p className="mt-1 text-small text-body">{spec.blurb}</p>
                <p className="mt-1 text-small text-muted">
                  Also called {spec.aka.join(", ")}.
                  {spec.formerly && ` Listed as ${spec.formerly} in earlier versions of DuctForge — that name was wrong.`}
                </p>
              </div>
              <ParamForm
                draft={draft}
                units={project.units}
                zones={zones}
                onChange={setDraft}
              />
            </div>

            </div>

            {/* Pinned below the scroll area on desktop; on mobile the sticky
              * action bar at the foot of the screen carries it instead, so it
              * is never off-screen on either. */}
            <div className="mt-7 hidden flex-wrap items-center gap-3 border-t-[1.5px] border-rule pt-7 lg:flex">
              {/* The one clay element in this view. Nothing else may claim it. */}
              <Button variant="primary" onClick={commit}>
                <Plus size={18} strokeWidth={2} />
                {editingId ? "Update this line" : "Add to takeoff"}
              </Button>
              {editingId && (
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setDraft(newDraft(draft.kind, project.waste, project.units, draft.zone));
                  }}
                >
                  <RotateCcw size={16} strokeWidth={1.5} /> Cancel
                </Button>
              )}
            </div>
          </Card>

          <Card
            as="section"
            className={`lg:col-span-7 lg:flex lg:min-h-0 lg:flex-col ${
              tab === "drawing" ? "" : "hidden lg:flex"
            }`}
          >
            <PanelHeading
              eyebrow="Step three"
              title="Check the drawing"
              aside={
                <p className="w-full text-small text-muted lg:w-auto lg:text-right">
                  {project.mode === "billing" ? "Billing standard" : "Shop standard"}
                </p>
              }
            />
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
              <Viewer
                fitting={fitting}
                units={project.units}
                mode={project.mode}
                view={view}
                onView={setView}
              />
            </div>
          </Card>

          {/* The one deliberate grid break: the result strip runs the full
            * twelve columns under a 5/7 split, so the figure the two panels
            * above are both about is not itself trapped in a column. */}
          <Card
            as="section"
            className={`lg:col-span-12 ${tab === "result" ? "" : "hidden lg:block"}`}
          >
            <PanelHeading
              eyebrow="This fitting"
              title={editingId ? "Line being edited" : "Not added yet"}
            />
            <ResultPanel
              result={preview}
              units={project.units}
              mode={project.mode}
              qty={previewEntry.qty}
              waste={previewEntry.waste}
            />
          </Card>
          </div>
        </div>

        {/* ---- THE TAKEOFF AND THE SETTINGS -------------------------------
          *
          * One instance, two placements. Below `lg` this is the fourth tab, so
          * the schedule is a tap rather than four screens of scrolling; at `lg`
          * it is always visible under the tool, where there is room for it. */}
        <div className={`${tab === "takeoff" ? "" : "hidden"} lg:block`}>
          {/* Keyed on the unit system so switching metric ↔ imperial remounts it
            * and its raw-string inputs re-seed from the project. Cheaper and
            * clearer than an effect syncing props into state. */}
          <div className="lg:mt-8">
            <ProjectSettings
              key={`${project.id}-${project.units}`}
              project={project}
              savedCount={store.projects.length}
              onPatch={patchProject}
              onClearAll={clearEverything}
            />
          </div>

        <section className="mt-10 lg:mt-14">
          <PanelHeading
            eyebrow="Schedule"
            title={
              project.entries.length === 0
                ? "The takeoff"
                : `The takeoff — ${project.entries.length} ${
                    project.entries.length === 1 ? "line" : "lines"
                  }`
            }
          />
          {project.entries.length === 0 ? (
            <div className="rounded-card border-[1.5px] border-dashed border-rule px-6 py-10">
              <p className="font-medium text-heading">Nothing scheduled yet.</p>
              <p className="mt-2 max-w-md text-small text-body">
                Set the dimensions above and add the first fitting. Lines stay on this device —
                nothing is uploaded anywhere.
              </p>
            </div>
          ) : (
            <Schedule
              project={project}
              editingId={editingId}
              onEdit={editEntry}
              onDuplicate={duplicateEntry}
              onRemove={removeEntry}
            />
          )}
        </section>

        {project.entries.length > 0 && (
          <>
            <section className="mt-10 lg:mt-14">
              <PanelHeading eyebrow="Totals" title="Material to order" />
              <Totals totals={totals} project={project} />
            </section>

            <section className="mt-10 lg:mt-14">
              <PanelHeading eyebrow="Breakdown" title="Where the material is" />
              <ChartsPanel totals={totals} units={project.units} />
            </section>
          </>
        )}

        <section className="mt-12 border-t-[1.5px] border-rule pt-8 lg:mt-16">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-8">
              <Note label="Standard">
                {project.mode === "billing"
                  ? "Areas are nominal mean perimeter × centreline length — the quantity a client, consultant or quantity surveyor accepts on an invoice."
                  : "Areas are the true unfolded blank a fabricator cuts. They are not a billing quantity."}
              </Note>
              <Note label="Gauge">
                Selected from the largest single dimension only. Real SMACNA selection also depends
                on pressure class and reinforcement spacing — check it against the project
                specification, and override any line by hand where the spec differs.
              </Note>
              <Note label="Weight">
                Bare steel at 7850 kg/m³, on the gross area. It excludes the galvanising coating,
                stiffeners, flanges, gaskets and fixings.
              </Note>
            </div>
            <p className="text-small text-muted lg:col-span-4 lg:text-right">
              Every formula, band and constant is written out on the{" "}
              <Link href="/standards" className="text-accent underline-offset-4 hover:underline">
                standards and formulas page
              </Link>
              .
            </p>
          </div>
        </section>
        </div>

      {/* ---- THE ACTION BAR, phones only --------------------------------
        *
        * The live figure you are working toward and the one button that acts on
        * it, pinned to the foot of the screen. Previously the button was the
        * last child of the tallest card and sat about fourteen hundred pixels
        * down: you scrolled a screen and a half to add a fitting, and scrolled
        * back to change it.
        *
        * Still exactly one clay element per viewport — the desktop button is
        * `lg:flex` and this one is `lg:hidden`, so the two are never both on
        * screen.
        *
        * Inside `main` rather than after it, deliberately: a sticky element
        * pins for the length of its containing block, so out here it would
        * hover over the explainer and the footer for the whole page. Ending
        * with `main` means it is present for exactly as long as the tool is. */}
      <div className="sticky bottom-0 z-30 -mx-5 mt-6 border-t-[1.5px] border-line bg-page/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-small text-muted">
              {spec.name} · {fmtArea(preview.grossAreaMinor)} {areaUnit(project.units)} ·{" "}
              {fmtMass(preview.massMinor)} {massUnit(project.units)}
            </p>
          </div>
          <Button variant="primary" onClick={commit} className="shrink-0">
            <Plus size={18} strokeWidth={2} />
            {editingId ? "Update" : "Add"}
          </Button>
        </div>
      </div>
      </main>

      <BoqSheet project={project} />
    </>
  );
}
