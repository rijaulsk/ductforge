/* Where this app lives, in one place.
 *
 * DuctForge is served from a subdomain of debugswift.com on its OWN Vercel
 * project — not proxied into the marketing site the way /tools and /blog are.
 * That distinction is the reason this file is three constants rather than the
 * basePath machinery its sibling repo needs: there is no path prefix here, so
 * a link is just a link and next/link needs no help.
 */

export const SITE_URL = "https://ductforge.debugswift.com";

/* Who built it.
 *
 * The byline is quiet but it is EVERYWHERE — page titles, the manifest, the
 * printed sheet, both exports and the saved project file. Owner's call,
 * 27 Aug 2026: a document that leaves this app and lands on somebody's desk
 * should say where it came from, and a tool that is a shop window for an
 * agency is not doing its job if nothing on it names the agency.
 *
 * What it is NOT is a pitch. One line, no services, no call to action — see
 * components/SiteFooter.tsx.
 */
export const MAKER_NAME = "DebugSwift";
export const MAKER_URL = "https://debugswift.com";

/** The product, attributed. Used wherever a single string has to carry both. */
export const APP_NAME = "DuctForge";
export const APP_BYLINE = `${APP_NAME} by ${MAKER_NAME}`;
export const APP_CREDIT = `Prepared with ${APP_NAME} by ${MAKER_NAME} — ${MAKER_URL.replace("https://", "")}`;
