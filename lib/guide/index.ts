import { SITE_URL } from "../site";
import { bn } from "./bn";
import { en } from "./en";
import { hi } from "./hi";
import type { Guide, Locale } from "./types";

export const GUIDES: Record<Locale, Guide> = { en, bn, hi };

/** In the order the switcher shows them. */
export const GUIDE_LIST: Guide[] = [en, bn, hi];

/**
 * hreflang for every language plus x-default.
 *
 * Three pages saying the same thing in three languages are not duplicates, but
 * a search engine has to be told that — otherwise it picks one and drops the
 * others, and the two that get dropped are the ones with the least competition
 * for their terms. `x-default` points at English as the fallback for a reader
 * whose language is none of the three.
 */
export function guideLanguages(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of GUIDE_LIST) out[g.htmlLang] = `${SITE_URL}${g.path}`;
  out["x-default"] = `${SITE_URL}${en.path}`;
  return out;
}

export type { Guide, Locale } from "./types";
