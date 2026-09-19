/* What goes on the printed sheet, and how it is laid out.
 *
 * WHY THIS EXISTS. Print used to be `window.print()` over one fixed document:
 * letterhead, parameter band, schedule, gauge table, zones, "also counted", the
 * basis notes and the footer, every time, in that order, at one size. The owner
 * issues these to clients by saving the print as a PDF, and could not take a
 * single one of those parts out. For an internal takeoff the full sheet is
 * right; for a client copy half of it is clutter the client did not ask for.
 *
 * So every part is a switch, and THE DEFAULTS ARE TODAY'S SHEET EXACTLY — all
 * sections on, all columns on, A4 portrait, normal text. Nobody's printout
 * changes until they change it.
 *
 * The options live on the Project, so a reprint months later comes out the same
 * and the layout travels inside the project file. This module is framework-free
 * for the same reason `lib/duct/` is: `check:duct` can reach it, and the reviver
 * below is a total parser like `reviveProject` — it never throws, and a field it
 * cannot vouch for falls back to its default rather than to `undefined`.
 *
 * THE HONESTY RULE MOVED, deliberately, on the owner's call (18 Sep 2026). The
 * printed sheet used to be self-describing unconditionally: the standard, the
 * units and the assumptions always printed. It is now self-describing BY
 * DEFAULT — the basis notes start on and the parameter band starts on, and the
 * estimator may remove either for an issued copy. The CSVs are untouched and
 * still carry everything, always.
 */

export type SectionKey =
  | "letterhead"
  | "logo"
  | "jobLine"
  | "parameters"
  | "date"
  | "schedule"
  | "totalsRow"
  | "byGauge"
  | "sheetsColumn"
  | "byZone"
  | "alsoCounted"
  | "basis"
  | "credit"
  | "disclaimer"
  | "pageNumbers";

export type ColumnKey =
  | "index"
  | "zone"
  | "fitting"
  | "notes"
  | "dimensions"
  | "qty"
  | "gauge"
  | "net"
  | "waste"
  | "gross"
  | "weight";

export type PaperSize = "a4" | "letter";
export type Orientation = "portrait" | "landscape";
export type TextSize = "compact" | "normal" | "large";

export type PrintHeader = {
  /** The document's title. "Duct takeoff schedule" unless changed. */
  title: string;
  /** The estimator's own company, set above the title. */
  company: string;
  client: string;
  preparedBy: string;
  /** Free text printed under the parameter band — scope, exclusions, anything. */
  notes: string;
};

export type PrintOptions = {
  sections: Record<SectionKey, boolean>;
  columns: Record<ColumnKey, boolean>;
  header: PrintHeader;
  page: { size: PaperSize; orientation: Orientation; text: TextSize };
};

export const DEFAULT_TITLE = "Duct takeoff schedule";

/** Every switch, in the order the export panel lists it, with the words it uses. */
export const SECTIONS: readonly { key: SectionKey; label: string; hint?: string; parent?: SectionKey }[] = [
  { key: "letterhead", label: "Letterhead", hint: "The masthead: logo, title and job" },
  { key: "logo", label: "DuctForge logo", parent: "letterhead" },
  { key: "jobLine", label: "Job name and reference", parent: "letterhead" },
  { key: "parameters", label: "Parameter band", hint: "Standard, units and material under the title" },
  { key: "date", label: "Date", parent: "parameters" },
  { key: "schedule", label: "Schedule table" },
  { key: "totalsRow", label: "Totals row", parent: "schedule" },
  { key: "byGauge", label: "Material by gauge" },
  { key: "sheetsColumn", label: "Sheet count", parent: "byGauge" },
  { key: "byZone", label: "By zone", hint: "Only printed when lines have zones" },
  { key: "alsoCounted", label: "Also counted", hint: "Insulation, flanges, hangers, value" },
  { key: "basis", label: "Basis of the quantities", hint: "The standard and every caveat" },
  { key: "credit", label: "DuctForge credit line" },
  { key: "disclaimer", label: "Check-against-spec note" },
  /* On by default, and it changes no earlier page's content: it sits in the
   * bottom margin, outside the area the pages are packed to. */
  { key: "pageNumbers", label: "Page numbers", hint: "Job name and page n of N at the foot of every page" },
];

export const COLUMNS: readonly { key: ColumnKey; label: string; parent?: ColumnKey }[] = [
  { key: "index", label: "#" },
  { key: "zone", label: "Zone" },
  { key: "fitting", label: "Fitting" },
  /* Notes print under the fitting's name, so they cannot outlive its column. */
  { key: "notes", label: "Line notes", parent: "fitting" },
  { key: "dimensions", label: "Dimensions" },
  { key: "qty", label: "Qty" },
  { key: "gauge", label: "Gauge" },
  { key: "net", label: "Net area" },
  { key: "waste", label: "Waste" },
  { key: "gross", label: "Gross area" },
  { key: "weight", label: "Weight" },
];

/* ---- page geometry ------------------------------------------------------- */

/** Paper, portrait, in millimetres. Landscape swaps them. */
export const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
};

/** One margin all round — the same 14 mm the sheet always printed with. */
export const MARGIN_MM = 14;

/** CSS pixels per millimetre — the unit a browser lays paper out in. */
export const PX_PER_MM = 96 / 25.4;

/** The root font size; every size in the sheet is an `em` of this. */
export const TEXT_PT: Record<TextSize, number> = { compact: 9, normal: 10, large: 11 };

/** The paper as it will actually come out of the printer, orientation applied. */
export function pageMm(page: PrintOptions["page"]): { w: number; h: number } {
  const p = PAPER_MM[page.size];
  return page.orientation === "landscape" ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/* ---- defaults ------------------------------------------------------------ */

const allOn = <K extends string>(keys: readonly { key: K }[]): Record<K, boolean> =>
  Object.fromEntries(keys.map((k) => [k.key, true])) as Record<K, boolean>;

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  sections: allOn(SECTIONS),
  columns: allOn(COLUMNS),
  header: { title: DEFAULT_TITLE, company: "", client: "", preparedBy: "", notes: "" },
  page: { size: "a4", orientation: "portrait", text: "normal" },
};

/** A fresh copy, so no caller can mutate the shared defaults. */
export function defaultPrintOptions(): PrintOptions {
  return {
    sections: { ...DEFAULT_PRINT_OPTIONS.sections },
    columns: { ...DEFAULT_PRINT_OPTIONS.columns },
    header: { ...DEFAULT_PRINT_OPTIONS.header },
    page: { ...DEFAULT_PRINT_OPTIONS.page },
  };
}

/* ---- the reviver ------------------------------------------------------------ */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Header text is capped: a field is a line on a sheet, not a document. */
const text = (v: unknown, fallback: string, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : fallback;

function flags<K extends string>(
  v: unknown,
  keys: readonly { key: K }[],
  fallback: Record<K, boolean>,
): Record<K, boolean> {
  const src = isObject(v) ? v : {};
  return Object.fromEntries(
    keys.map(({ key }) => [key, typeof src[key] === "boolean" ? src[key] : fallback[key]]),
  ) as Record<K, boolean>;
}

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/**
 * Read stored options back, field by field.
 *
 * A project saved before this existed has no `print` at all and opens with the
 * defaults — which are the sheet it always printed. A document with a switch
 * missing keeps every switch it does have. Nothing here can throw.
 */
export function revivePrintOptions(v: unknown): PrintOptions {
  const d = DEFAULT_PRINT_OPTIONS;
  if (!isObject(v)) return defaultPrintOptions();
  const header = isObject(v.header) ? v.header : {};
  const page = isObject(v.page) ? v.page : {};
  const title = text(header.title, d.header.title, 80);
  return {
    sections: flags(v.sections, SECTIONS, d.sections),
    columns: flags(v.columns, COLUMNS, d.columns),
    header: {
      /* An emptied title prints as the default rather than as nothing: a
       * masthead with no title is a blank line at the top of a document. */
      title: title.trim() === "" ? d.header.title : title,
      company: text(header.company, "", 80),
      client: text(header.client, "", 80),
      preparedBy: text(header.preparedBy, "", 80),
      notes: text(header.notes, "", 600),
    },
    page: {
      size: oneOf(page.size, ["a4", "letter"] as const, d.page.size),
      orientation: oneOf(page.orientation, ["portrait", "landscape"] as const, d.page.orientation),
      text: oneOf(page.text, ["compact", "normal", "large"] as const, d.page.text),
    },
  };
}
