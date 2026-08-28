import type { ReactNode } from "react";
import SiteNav, { type NavKey } from "./SiteNav";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

/* THE ONLY HEADER. Every page, every width, one shell — and now one HEIGHT.
 *
 * Unifying the two headers killed the horizontal jump. It did not kill the
 * vertical one, and the reason was structural: the identity row had no reserved
 * height, so its height was `max(children) + padding`, and the tallest child was
 * the `right` slot — which held a 44px theme toggle on the calculator, 37px
 * language pills on the guide, and NOTHING on the standards page. Three routes,
 * three heights, 6px apart, and the logo centred in each: a 3px twitch on every
 * navigation. That was the residual shift.
 *
 * FIXED HEIGHT ON THE IDENTITY ROW is the fix. `h-14` cannot be pushed by
 * whatever a page puts in the slot, so no page can move the logo.
 *
 * THE THEME TOGGLE MOVED IN HERE, and that is a bug fix, not tidying: it was
 * mounted only by ProjectBar, so there was no way to change theme from
 * /standards or /guide at all.
 *
 * ON MOBILE THE WORDMARK BECOMES THE TILE ALONE. The full lockup is 170px and
 * the three nav pills are ~281px — 471px of `shrink-0` content in a 350px line,
 * which cannot not wrap, and wrapped to a different number of lines per route.
 * The tile is 38px, so 38 + 281 fits on one line and the header stops being a
 * paragraph. This is not "the mark without its tile" — the tile IS the mark's
 * home; see scripts/mark.mjs.
 *
 * NOT STICKY BELOW `lg`. Sticky was given to every page for consistency and on
 * a phone that was the wrong trade: the calculator's header is two rows, and
 * pinning ~110px of a 844px screen for the whole session to keep a project name
 * visible is a bad bargain on the surface with the least room. Desktop keeps it,
 * where a 56px bar against 900px costs nothing.
 */
export default function AppHeader({
  current,
  labels,
  right,
  children,
}: {
  current: NavKey;
  labels?: Partial<Record<NavKey, string>>;
  right?: ReactNode;
  /** Page-specific chrome, on its own row under the identity row. */
  children?: ReactNode;
}) {
  return (
    <header className="border-b-[1.5px] border-line bg-page/95 backdrop-blur lg:sticky lg:top-0 lg:z-40 print:hidden">
      <div className="mx-auto w-full max-w-canvas px-5 md:px-8">
        {/* Fixed height, so no page's `right` slot can move the logo. */}
        <div className="flex h-14 items-center gap-x-4">
          <Wordmark size="sm" compact />
          <SiteNav current={current} labels={labels} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {right}
            <ThemeToggle />
          </div>
        </div>
        {children && <div className="border-t-[1.5px] border-rule py-3">{children}</div>}
      </div>
    </header>
  );
}
