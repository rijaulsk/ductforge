import { blankProject, reviveProject } from "./project";
import type { Project } from "./duct/types";

/* Local persistence.
 *
 * EVERY access is wrapped. localStorage throws outright in a private window
 * with site data blocked, and throws on write when the quota is full — and
 * these calls happen inside keystroke handlers, where an exception takes the
 * whole workspace down and loses the takeoff the user was in the middle of.
 * A storage failure has to degrade to "this session won't be remembered",
 * never to a blank screen.
 *
 * Keys are namespaced and versioned. When the shape changes, bump the version
 * rather than trying to migrate in place — an estimator's saved job is worth
 * more than a tidy key name.
 */

const PROJECTS_KEY = "ductforge.projects.v1";
const ACTIVE_KEY = "ductforge.active.v1";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Full, or blocked. The app keeps working from memory. */
  }
}

function drop(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadProjects(): Project[] {
  const raw = read(PROJECTS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /* Every stored project goes back through the same validator the JSON
     * importer uses, so a file hand-edited into an odd shape — or written by
     * an older version that had fewer fields — cannot reach a render. */
    return parsed
      .map((p) => reviveProject(p))
      .filter((p): p is Project => p !== null);
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  write(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadActiveId(): string | null {
  return read(ACTIVE_KEY);
}

export function saveActiveId(id: string): void {
  write(ACTIVE_KEY, id);
}

export function clearAll(): void {
  drop(PROJECTS_KEY);
  drop(ACTIVE_KEY);
}

/** What the workspace starts from: whatever was saved, or one empty job. */
export function initialState(): { projects: Project[]; activeId: string } {
  const projects = loadProjects();
  if (projects.length === 0) {
    const fresh = blankProject();
    return { projects: [fresh], activeId: fresh.id };
  }
  const wanted = loadActiveId();
  const active = projects.find((p) => p.id === wanted) ?? projects[0];
  return { projects, activeId: active.id };
}
