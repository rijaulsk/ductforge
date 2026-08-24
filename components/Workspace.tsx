"use client";

import { Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ViewKind } from "@/lib/draw";
import { computeEntry, computeTotals } from "@/lib/duct/compute";
import { FITTING_KINDS, SPECS } from "@/lib/duct/formulas";
import { toQty, toWaste } from "@/lib/duct/parse";
import type { Entry, FittingKind, Project } from "@/lib/duct/types";
import { type Draft, convertDraft, draftFromEntry, fittingFromValues, newDraft } from "@/lib/draft";
import { toCsv } from "@/lib/export/csv";
import { safeFilename, triggerDownload } from "@/lib/export/download";
import { useHasMounted } from "@/lib/hooks";
import { blankProject, fromProjectFile, newId, toProjectFile } from "@/lib/project";
import { initialState, saveActiveId, saveProjects } from "@/lib/storage";
import BoqSheet from "./BoqSheet";
import ChartsPanel from "./ChartsPanel";
import FittingGlyph from "./FittingGlyph";
import ParamForm from "./ParamForm";
import ProjectBar from "./ProjectBar";
import ResultPanel from "./ResultPanel";
import Schedule from "./Schedule";
import SiteFooter from "./SiteFooter";
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

export default function Workspace() {
  const mounted = useHasMounted();

  /* Read storage in the initialiser, not an effect: an effect would render one
   * frame of an empty takeoff before the saved one appeared. The SSR pass has
   * no window, and the whole workspace is gated on `mounted` below, so the
   * server and the hydration render agree. */
  const [store, setStore] = useState(() =>
    typeof window === "undefined"
      ? { projects: [blankProject()], activeId: "" }
      : initialState(),
  );
  const project = store.projects.find((p) => p.id === store.activeId) ?? store.projects[0];

  const [draft, setDraft] = useState<Draft>(() => newDraft("straight", 12, "metric"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<ViewKind>("blueprint");
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    saveProjects(store.projects);
    saveActiveId(store.activeId);
  }, [store]);

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

  const pickKind = (kind: FittingKind) => {
    setDraft(newDraft(kind, project.waste, project.units));
    setEditingId(null);
  };

  const fitting = fittingFromValues(draft.kind, draft.values, project.units);
  const previewEntry: Entry = {
    id: editingId ?? "draft",
    fitting,
    qty: toQty(draft.qty),
    waste: toWaste(draft.waste),
    gauge: draft.gauge,
    note: draft.note.trim(),
  };
  const preview = computeEntry(previewEntry, project.mode, project.units);

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

  const exportJson = () =>
    triggerDownload(
      new Blob([toProjectFile(project)], { type: "application/json" }),
      safeFilename(project.name, "json"),
    );

  const totals = computeTotals(project.entries, project.mode, project.units);
  const spec = SPECS[draft.kind];

  /* Everything below the fold of this branch is what a crawler and a slow first
   * paint actually get, because the workspace itself cannot render until the
   * saved takeoff has been read out of localStorage. It used to be the four
   * words "Loading the workspace…" and nothing else — correct for hydration,
   * useless as a page. This is the same page saying what it is, not cloaked
   * content: it is replaced by the real thing the moment React takes over. */
  if (!mounted) {
    return (
      <>
        <main className="mx-auto w-full max-w-canvas px-5 py-16 md:px-8 md:py-24">
          <p className="text-eyebrow uppercase text-accent">HVAC takeoff</p>
          <h1 className="mt-3 max-w-3xl text-h1-mobile font-bold text-heading md:text-h1">
            Duct surface area, sheet weight and gauge
          </h1>
          <p className="mt-5 max-w-2xl">
            Enter a fitting&rsquo;s dimensions and get its surface area, GI sheet weight, SMACNA
            gauge and a BOM schedule you can export. Six fittings — straight duct, reducer, elbow,
            dropper, collar and Y-piece — measured to either the commercial billing standard (mean
            perimeter × centreline length) or the true shop flat pattern. Metric or imperial.
          </p>
          <p className="mt-6">
            <Link href="/standards" className="text-accent underline-offset-4 hover:underline">
              Every formula, gauge band and constant it uses →
            </Link>
          </p>
          <p className="mt-10 text-small text-muted">Loading the workspace…</p>
        </main>
        <SiteFooter />
      </>
    );
  }

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
        onExportJson={exportJson}
        onImport={(f) => void importFile(f)}
        onPrint={() => window.print()}
        hasEntries={project.entries.length > 0}
      />

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

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <Card as="section" className="lg:col-span-5">
            <PanelHeading eyebrow="Step one" title="Choose a fitting" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FITTING_KINDS.map((kind) => {
                const on = kind === draft.kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickKind(kind)}
                    className={`flex flex-col items-center gap-2 rounded-card border-[1.5px] px-3 py-3 text-small font-medium transition duration-200 ease-out ${
                      on
                        ? "border-line bg-heading text-page"
                        : "border-rule text-heading hover:border-line hover:bg-sunk"
                    }`}
                  >
                    <FittingGlyph kind={kind} />
                    {SPECS[kind].name}
                  </button>
                );
              })}
            </div>

            <div className="mt-7 border-t-[1.5px] border-rule pt-7">
              <div className="mb-5 text-center lg:text-left">
                <Eyebrow>Step two</Eyebrow>
                <h2 className="mt-2 text-h3 font-bold text-heading">{spec.name} dimensions</h2>
                <p className="mt-1 text-small text-body">{spec.blurb}</p>
              </div>
              <ParamForm draft={draft} units={project.units} onChange={setDraft} />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t-[1.5px] border-rule pt-7">
              {/* The one clay element in this view. Nothing else may claim it. */}
              <Button variant="primary" onClick={commit}>
                <Plus size={18} strokeWidth={2} />
                {editingId ? "Update this line" : "Add to takeoff"}
              </Button>
              {editingId && (
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setDraft(newDraft(draft.kind, project.waste, project.units));
                  }}
                >
                  <RotateCcw size={16} strokeWidth={1.5} /> Cancel
                </Button>
              )}
            </div>
          </Card>

          <Card as="section" className="lg:col-span-7">
            <PanelHeading
              eyebrow="Step three"
              title="Check the drawing"
              aside={
                <p className="w-full text-small text-muted lg:w-auto lg:text-right">
                  {project.mode === "billing" ? "Billing standard" : "Shop standard"}
                </p>
              }
            />
            <Viewer
              fitting={fitting}
              units={project.units}
              mode={project.mode}
              view={view}
              onView={setView}
            />
          </Card>

          {/* The one deliberate grid break: the result strip runs the full
            * twelve columns under a 5/7 split, so the figure the two panels
            * above are both about is not itself trapped in a column. */}
          <Card as="section" className="lg:col-span-12">
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
            <div className="rounded-card border-[1.5px] border-dashed border-rule px-6 py-12 text-center">
              <p className="font-medium text-heading">Nothing scheduled yet.</p>
              <p className="mx-auto mt-2 max-w-md text-small text-body">
                Set the dimensions above and add the first fitting. Lines stay on this device —
                nothing is uploaded anywhere.
              </p>
            </div>
          ) : (
            <Schedule
              entries={project.entries}
              mode={project.mode}
              units={project.units}
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
              <Totals totals={totals} units={project.units} />
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
      </main>

      <SiteFooter className="print:hidden" />

      <BoqSheet project={project} />
    </>
  );
}
