import { GAUGE_NAMES } from "./duct/gauge";
import { SPECS } from "./duct/formulas";
import type { Entry, Fitting, FittingKind, GaugeName, Mode, Project } from "./duct/types";
import type { UnitSystem } from "./duct/units";
import { DEFAULT_WASTE } from "./duct/waste";

/* Project documents: creation, and the one validator every stored or imported
 * document has to pass.
 *
 * `reviveProject` is a TOTAL parser. It never throws and never returns a
 * half-built object: anything it cannot vouch for comes back as null and the
 * caller says so. The alternative — trusting JSON.parse's output because it
 * came from our own exporter — is how a renamed field turns into `undefined`
 * in the middle of a render three versions later.
 *
 * It is also forgiving in one specific way, on purpose: unknown fields are
 * dropped and MISSING fields fall back to the fitting's defaults, so a job
 * saved before a field existed still opens.
 */

export function newId(): string {
  return crypto.randomUUID();
}

export function blankProject(name = "Untitled takeoff"): Project {
  return {
    id: newId(),
    name,
    reference: "",
    units: "metric",
    mode: "billing",
    waste: DEFAULT_WASTE,
    entries: [],
    updatedAt: Date.now(),
  };
}

export function newEntry(kind: FittingKind, waste: number): Entry {
  return {
    id: newId(),
    fitting: { ...SPECS[kind].defaults },
    qty: 1,
    waste,
    gauge: null,
    note: "",
  };
}

/* ---- validation --------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

function reviveFitting(v: unknown): Fitting | null {
  if (!isObject(v)) return null;
  const kind = v.kind;
  if (typeof kind !== "string" || !(kind in SPECS)) return null;
  const spec = SPECS[kind as FittingKind];
  /* Start from the defaults and overwrite only what validates — a document
   * missing a field opens with that field's default rather than with NaN. */
  const out: Record<string, unknown> = { ...spec.defaults };
  for (const field of spec.fields) {
    const defaults = spec.defaults as unknown as Record<string, number>;
    out[field.key] = num(v[field.key], defaults[field.key] ?? 0);
  }
  out.kind = kind;
  return out as unknown as Fitting;
}

function reviveEntry(v: unknown, projectWaste: number): Entry | null {
  if (!isObject(v)) return null;
  const fitting = reviveFitting(v.fitting);
  if (!fitting) return null;
  const gauge = typeof v.gauge === "string" && (GAUGE_NAMES as readonly string[]).includes(v.gauge)
    ? (v.gauge as GaugeName)
    : null;
  return {
    id: str(v.id) || newId(),
    fitting,
    qty: Math.max(1, Math.floor(num(v.qty, 1))),
    waste: Math.min(100, num(v.waste, projectWaste)),
    gauge,
    note: str(v.note),
  };
}

export function reviveProject(v: unknown): Project | null {
  if (!isObject(v)) return null;
  const units: UnitSystem = v.units === "imperial" ? "imperial" : "metric";
  const mode: Mode = v.mode === "shop" ? "shop" : "billing";
  const waste = Math.min(100, num(v.waste, DEFAULT_WASTE));
  const rawEntries = Array.isArray(v.entries) ? v.entries : [];
  const entries = rawEntries
    .map((e) => reviveEntry(e, waste))
    .filter((e): e is Entry => e !== null);
  return {
    id: str(v.id) || newId(),
    name: str(v.name, "Untitled takeoff"),
    reference: str(v.reference),
    units,
    mode,
    waste,
    entries,
    updatedAt: num(v.updatedAt, Date.now()),
  };
}

/* ---- the interchange file ------------------------------------------------ */

export const PROJECT_SCHEMA = 1;

export type ProjectFile = {
  schema: number;
  app: "ductforge";
  exportedAt: string;
  project: Project;
};

export function toProjectFile(project: Project): string {
  const file: ProjectFile = {
    schema: PROJECT_SCHEMA,
    app: "ductforge",
    exportedAt: new Date().toISOString(),
    project,
  };
  return JSON.stringify(file, null, 2);
}

export type ImportResult =
  | { ok: true; project: Project }
  | { ok: false; error: string };

export function fromProjectFile(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!isObject(parsed)) return { ok: false, error: "That file isn't a DuctForge project." };
  if (parsed.app !== "ductforge") {
    return { ok: false, error: "That file wasn't exported by DuctForge." };
  }
  if (typeof parsed.schema !== "number" || parsed.schema > PROJECT_SCHEMA) {
    return {
      ok: false,
      error: `That file was written by a newer version (schema ${String(parsed.schema)}). Update DuctForge and try again.`,
    };
  }
  const project = reviveProject(parsed.project);
  if (!project) return { ok: false, error: "That file's project data couldn't be read." };
  /* A fresh id, so importing a copy of a job you already have opens a second
   * project rather than silently overwriting the first. */
  return { ok: true, project: { ...project, id: newId(), updatedAt: Date.now() } };
}
