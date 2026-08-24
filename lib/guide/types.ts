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

export type GuideStep = {
  title: string;
  body: string[];
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
};

export const LOCALES: readonly Locale[] = ["en", "bn", "hi"];
