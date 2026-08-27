import type { ReactNode } from "react";
import SiteNav, { type NavKey } from "./SiteNav";
import Wordmark from "./Wordmark";

/* One header, so every page puts the same things in the same places.
 *
 * They did not. The standards page had its nav pushed to the right-hand edge
 * while the guide had it beside the wordmark, and the two pages padded their
 * headers differently, so the logo itself moved when you navigated between
 * them. Header HEIGHT can vary with what a page needs; the logo's position
 * cannot, because a logo that jumps is the one thing a reader is guaranteed to
 * be looking at.
 *
 * The order is fixed: wordmark, then the three sections, then whatever is
 * page-specific — a language switcher, and nothing else so far. `right` is
 * pushed to the far edge rather than sitting in the flow, so adding one does
 * not move the two things before it.
 */
export default function AppHeader({
  current,
  labels,
  right,
}: {
  current: NavKey;
  labels?: Partial<Record<NavKey, string>>;
  right?: ReactNode;
}) {
  return (
    <header className="border-b-[1.5px] border-line">
      <div className="mx-auto flex w-full max-w-canvas flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 md:px-8">
        <Wordmark size="sm" />
        <SiteNav current={current} labels={labels} />
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
