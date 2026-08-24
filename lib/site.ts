/* Where this app lives, in one place.
 *
 * DuctForge is served from a subdomain of debugswift.com on its OWN Vercel
 * project — not proxied into the marketing site the way /tools and /blog are.
 * That distinction is the reason this file is three constants rather than the
 * basePath machinery its sibling repo needs: there is no path prefix here, so
 * a link is just a link and next/link needs no help.
 */

export const SITE_URL = "https://ductforge.debugswift.com";

/** Who built it. One quiet byline in the footer, and nothing else — see
 * components/SiteFooter.tsx for why this is attribution and not a funnel. */
export const MAKER_NAME = "DebugSwift";
export const MAKER_URL = "https://debugswift.com";
