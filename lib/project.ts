import { GAUGE_NAMES } from "./duct/gauge";
import { SPECS } from "./duct/formulas";
import { MATERIAL_KEYS } from "./duct/material";
import type {
  Ancillaries,
  Entry,
  Fitting,
  FittingKind,
  GaugeName,
  MaterialKey,
  Mode,
  Project,
  Rates,
} from "./duct/types";
import type { UnitSystem } from "./duct/units";
import { DEFAULT_WASTE } from "./duct/waste";
import { APP_BYLINE, SITE_URL } from "./site";

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

/* Every derived quantity is OFF by default.
 *
 * A takeoff that arrives with insulation already counted, at a thickness
 * nobody chose, is a takeoff with a number in it that no human decided. The
 * estimator switches each of these on and says what it is; until then the
 * schedule contains only what they typed. */
export const NO_ANCILLARIES: Ancillaries = {
  insulationMm: 0,
  standardLengthMm: 0,
  supportSpacingMm: 0,
};

export const NO_RATES: Rates = { perKg: 0, perM2: 0, label: "" };

export function blankProject(name = "Untitled takeoff"): Project {
  return {
    id: newId(),
    name,
    reference: "",
    units: "metric",
    mode: "billing",
    waste: DEFAULT_WASTE,
    material: "gi",
    ancillaries: { ...NO_ANCILLARIES },
    rates: { ...NO_RATES },
    entries: [],
    updatedAt: Date.now(),
  };
}

/* ---- validation --------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/**
 * Fitting kinds this app used to use, and what they are called now.
 *
 * RENAMING A KIND WITHOUT AN ENTRY HERE DELETES DATA, silently. `reviveFitting`
 * returns null for a kind it does not recognise and `reviveProject` filters the
 * nulls out, so an old saved takeoff would simply open with those lines gone —
 * no error, no warning, just a shorter schedule and a smaller total. Every
 * rename goes in this map in the SAME change that renames it.
 *
 * The names on the left are not mistakes to be embarrassed about; they are the
 * documents people already have on their devices. They stay here forever.
 *
 * - `dropper` → `offset`, 28 Aug 2026. The fitting was always an offset — a
 *   constant section displaced sideways, catalogued as a rectangular ogee. It
 *   was never a dropper, which is a different fitting that drops air down to a
 *   grille and which this app does not model.
 * - `reducer` → `transition`, same day. A rectangular size change is a
 *   transition; "reducer" is the round cone, which keeps the name.
 */
const KIND_ALIASES: Record<string, FittingKind> = {
  dropper: "offset",
  reducer: "transition",
};

function reviveFitting(v: unknown): Fitting | null {
  if (!isObject(v)) return null;
  const raw = v.kind;
  if (typeof raw !== "string") return null;
  const kind = raw in SPECS ? raw : KIND_ALIASES[raw];
  if (!kind || !(kind in SPECS)) return null;
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
    zone: str(v.zone),
    note: str(v.note),
  };
}

function reviveAncillaries(v: unknown): Ancillaries {
  if (!isObject(v)) return { ...NO_ANCILLARIES };
  return {
    insulationMm: Math.min(500, num(v.insulationMm, 0)),
    standardLengthMm: Math.min(12_000, num(v.standardLengthMm, 0)),
    supportSpacingMm: Math.min(12_000, num(v.supportSpacingMm, 0)),
  };
}

function reviveRates(v: unknown): Rates {
  if (!isObject(v)) return { ...NO_RATES };
  return {
    perKg: num(v.perKg, 0),
    perM2: num(v.perM2, 0),
    label: str(v.label).slice(0, 8),
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
  const material: MaterialKey =
    typeof v.material === "string" && (MATERIAL_KEYS as readonly string[]).includes(v.material)
      ? (v.material as MaterialKey)
      : "gi";
  return {
    id: str(v.id) || newId(),
    name: str(v.name, "Untitled takeoff"),
    reference: str(v.reference),
    units,
    mode,
    waste,
    material,
    ancillaries: reviveAncillaries(v.ancillaries),
    rates: reviveRates(v.rates),
    entries,
    updatedAt: num(v.updatedAt, Date.now()),
  };
}

/* ---- the interchange file ------------------------------------------------ */

/**
 * 2 since 28 Aug 2026, when `dropper` became `offset` and `reducer` became
 * `transition`. A version 1 file still opens: `KIND_ALIASES` translates the old
 * names on the way in, which is the whole reason that map exists.
 *
 * The reader refuses a file from a NEWER schema than it knows, so this number
 * only goes up when the shape changes in a way an older build could not read.
 */
export const PROJECT_SCHEMA = 2;

export type ProjectFile = {
  schema: number;
  app: "ductforge";
  /* `app` is the machine's identifier and the reader keys off it, so it must
   * never change. `generator` is the human's: somebody who opens this file in
   * a text editor two years from now should be able to see what wrote it and
   * where to get that thing. The reader ignores it entirely. */
  generator: string;
  exportedAt: string;
  project: Project;
};

export function toProjectFile(project: Project): string {
  const file: ProjectFile = {
    schema: PROJECT_SCHEMA,
    app: "ductforge",
    generator: `${APP_BYLINE} — ${SITE_URL}`,
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
