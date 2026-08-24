/* The guide, as data.
 *
 * One shape, three languages, one component. Translating means writing a new
 * file against this type rather than forking a page — so a step added in
 * English is a visible hole in the other two rather than a silent divergence.
 *
 * The Bengali and Hindi versions are written in the register these are actually
 * spoken in on a site in Kolkata or Delhi, which means the technical nouns stay
 * in English: nobody in this trade says anything but "duct", "gauge", "area" or
 * "CSV", and inventing native equivalents would make the guide harder to read,
 * not easier. That is a deliberate choice, not laziness.
 */

export type Locale = "en" | "bn" | "hi";

/* Which annotated figure a step shows.
 *
 * These are DRAWN, not screenshotted — built from the same tokens and the same
 * component styles as the real interface, and in the case of `drawing`, from
 * the real drawing engine. A screenshot of a workspace goes stale the first
 * time a button moves, silently, in three languages at once; a figure that is
 * code goes stale loudly, at the type level. It is also theme-aware, crisp at
 * any zoom, and its callouts translate with the rest of the guide.
 */
export type FigureKind =
  | "standard"
  | "picker"
  | "params"
  | "drawing"
  | "quantity"
  | "schedule"
  | "zones"
  | "totals";

export type GuideStep = {
  title: string;
  body: string[];
  figure?: FigureKind;
  /** Numbered callouts on that figure, in order. Localised like everything else. */
  callouts?: string[];
};

export type GuideNote = {
  title: string;
  body: string;
};

export type Guide = {
  locale: Locale;
  /** The `lang` attribute for this page's content. */
  htmlLang: string;
  /** Route, relative to the site root. */
  path: string;
  /** The language's own name, for the switcher — never translated. */
  label: string;

  metaTitle: string;
  metaDescription: string;

  eyebrow: string;
  title: string;
  lede: string[];

  standardsHeading: string;
  standardsLede: string;
  standards: { name: string; body: string }[];

  stepsHeading: string;
  steps: GuideStep[];

  watchHeading: string;
  watch: GuideNote[];

  /** Link labels. */
  openApp: string;
  seeStandards: string;
  switcherLabel: string;
  /** The three-section nav, translated. */
  nav: { calculator: string; guide: string; standards: string };

  /** Figure captions, keyed by the figure a step names. */
  figureLabel: string;
};

export const LOCALES: readonly Locale[] = ["en", "bn", "hi"];
