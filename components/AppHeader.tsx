import type { ReactNode } from "react";
import HeaderMenu from "./HeaderMenu";
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
  phoneRow,
  held = false,
}: {
  current: NavKey;
  labels?: Partial<Record<NavKey, string>>;
  right?: ReactNode;
  /** Page-specific chrome, on its own row under the identity row. */
  children?: ReactNode;
  /**
   * ONE ROW BELOW `lg`, for the calculator. When given, a phone gets the tile,
   * this, and a menu holding the nav and the theme — instead of three rows
   * (identity, nav, then `children`). See HeaderMenu for why only here.
   */
  phoneRow?: ReactNode;
  /** Hold it on screen — a disclosure inside it is open. */
  held?: boolean;
}) {
  return (
    <StickyHeader className="print:hidden" held={held}>
      <header className="border-b-[1.5px] border-line bg-page/95 backdrop-blur">
        {/* `relative`, so a panel a phone row opens can hang from the whole
          * header's width rather than from the narrow cell it was opened in. */}
        <div className="relative mx-auto w-full max-w-canvas px-5 md:px-8">
          {phoneRow && (
            <div className="flex h-14 items-center gap-2 lg:hidden">
              <Wordmark size="sm" compact />
              <div className="min-w-0 flex-1">{phoneRow}</div>
              <HeaderMenu>
                <SiteNav
                  current={current}
                  labels={labels}
                  className="flex-col items-stretch [&>a]:px-3 [&>a]:py-2.5"
                />
              </HeaderMenu>
            </div>
          )}
          <div className={phoneRow ? "hidden lg:block" : undefined}>
          {/* Fixed height, so no page's `right` slot can move the logo. 48px
            * rather than 56: it is one row of 38px artwork and 32px pills, and
            * every pixel of a sticky bar is charged on every scroll position. */}
          {/* Tighter gaps on a phone. Tile + three pills + theme toggle came to
            * ~380px in a 350px line, so "Standards" was clipped; the nav scrolls
            * rather than breaking, but a label cut mid-word looks like a fault
            * rather than a affordance. These two reclaim enough to fit at 390. */}
          {/* THE NAV TAKES ITS OWN LINE ON A PHONE INSTEAD OF SCROLLING.
            *
            * Wordmark 38 + three pills 239 + theme toggle 44 needs about 335px
            * of unshrinkable content. A 390px phone has 335 and a 320px one has
            * 265, so from 375 down the nav scrolled and "Standards" was cut to
            * "S" — a top-level link, hidden behind a gesture nobody makes on a
            * header. Overflow-scroll is the wrong answer for three links that
            * are the entire site.
            *
            * `flex-wrap` plus `w-full` on the nav puts it on line two below
            * `xs` and back inline from 480px up. It wraps to the SAME shape on
            * every route, which is what the old flex-wrap did not do — that one
            * wrapped to a different number of lines depending on what the page
            * put in the `right` slot, and the logo moved as you navigated. The
            * fixed `h-12` still applies from `xs` up, where it is one row. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 py-1.5 xs:h-12 xs:flex-nowrap xs:py-0 md:gap-x-4">
            <Wordmark size="sm" compact />
            {/* `order-last w-full` is what forces the wrap: a full-width flex
              * item cannot share a line, so the wordmark and the controls keep
              * line one and the nav takes line two. Both revert at `xs`. */}
            <SiteNav
              current={current}
              labels={labels}
              className="order-last w-full xs:order-none xs:w-auto"
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {right}
              <ThemeToggle />
            </div>
          </div>
          {children && <div className="border-t-[1.5px] border-rule py-2.5">{children}</div>}
          </div>
        </div>
      </header>
    </StickyHeader>
  );
}
