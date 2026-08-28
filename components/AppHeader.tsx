import type { ReactNode } from "react";
import SiteNav, { type NavKey } from "./SiteNav";
import Wordmark from "./Wordmark";

/* THE ONLY HEADER. Every page, every width, one shell.
 *
 * It was not. The calculator rendered a `ProjectBar` and the content pages
 * rendered this, and the two disagreed about nearly everything:
 *
 *   breakpoint   ProjectBar switched layout at `lg`, this switched padding at
 *                `md`. Between 768 and 1023px the calculator showed a
 *                full-bleed phone bar while /standards showed the constrained
 *                desktop header — a visible jump in width on navigation.
 *   container    ProjectBar's phone branch had NO `max-w-canvas` and its own
 *                padding, so the logo sat at a different x on every page.
 *   height       py-3 against py-4, so everything below moved by 8px.
 *   nav          inline here, hidden behind a gear on the calculator.
 *   sticky       `lg:sticky` there, not sticky here.
 *
 * Reported as a subtle width change on desktop and chaos on mobile. Both were
 * the same cause: two components pretending to be one thing.
 *
 * Now there is one identity row — wordmark, sections, page extras — and pages
 * that need more chrome pass it as `children`, where it renders on its own
 * line INSIDE the same container. The identity row's geometry cannot vary by
 * page, because there is only one of it.
 *
 * Sticky on every page rather than none: the project bar's stickiness was
 * genuinely useful on a long takeoff, and the fix for inconsistency is to give
 * every page the good behaviour rather than to take it away from one.
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
    <header className="sticky top-0 z-40 border-b-[1.5px] border-line bg-page/95 backdrop-blur print:hidden">
      <div className="mx-auto w-full max-w-canvas px-5 md:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-3">
          <Wordmark size="sm" />
          <SiteNav current={current} labels={labels} />
          {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
        </div>
        {children && <div className="border-t-[1.5px] border-rule py-3">{children}</div>}
      </div>
    </header>
  );
}
