import type { ReactNode } from "react";
import SiteNav, { type NavKey } from "./SiteNav";
import StickyHeader from "./StickyHeader";
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
 * IT HIDES ON THE WAY DOWN AND COMES BACK ON THE WAY UP — see StickyHeader.
 * A sticky bar is a standing tax on the viewport, charged at every scroll
 * position for the whole session, and on the calculator it is two rows. Rather
 * than choose between keeping the nav and seeing the content, it gets out of
 * the way while you read and returns on a small upward flick.
 */
export default function AppHeader({
  current,
  labels,
  right,
  children,
  held = false,
}: {
  current: NavKey;
  labels?: Partial<Record<NavKey, string>>;
  right?: ReactNode;
  /** Page-specific chrome, on its own row under the identity row. */
  children?: ReactNode;
  /** Hold it on screen — a disclosure inside it is open. */
  held?: boolean;
}) {
  return (
    <StickyHeader className="print:hidden" held={held}>
      <header className="border-b-[1.5px] border-line bg-page/95 backdrop-blur">
        <div className="mx-auto w-full max-w-canvas px-5 md:px-8">
          {/* Fixed height, so no page's `right` slot can move the logo. 48px
            * rather than 56: it is one row of 38px artwork and 32px pills, and
            * every pixel of a sticky bar is charged on every scroll position. */}
          {/* Tighter gaps on a phone. Tile + three pills + theme toggle came to
            * ~380px in a 350px line, so "Standards" was clipped; the nav scrolls
            * rather than breaking, but a label cut mid-word looks like a fault
            * rather than a affordance. These two reclaim enough to fit at 390. */}
          <div className="flex h-12 items-center gap-x-2 md:gap-x-4">
            <Wordmark size="sm" compact />
            <SiteNav current={current} labels={labels} />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {right}
              <ThemeToggle />
            </div>
          </div>
          {children && <div className="border-t-[1.5px] border-rule py-2.5">{children}</div>}
        </div>
      </header>
    </StickyHeader>
  );
}
