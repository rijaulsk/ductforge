import Link from "next/link";

/* The three places this site has, everywhere it has them.
 *
 * Before this you could reach /standards from a link buried under the totals
 * and /guide from one line beneath that, and from either of those pages the
 * only way back was the wordmark. Three pages is not many, which is exactly
 * why there is no excuse for not listing all three on all three.
 *
 * `current` gets aria-current and the filled treatment. It is a prop rather
 * than a `usePathname()` call so this stays a server component — the project
 * bar is the only client caller, and it knows perfectly well where it is.
 */

export type NavKey = "calculator" | "guide" | "standards";

const ITEMS: { key: NavKey; href: string; label: string }[] = [
  { key: "calculator", href: "/", label: "Calculator" },
  { key: "guide", href: "/guide", label: "Guide" },
  { key: "standards", href: "/standards", label: "Standards" },
];

export default function SiteNav({
  current,
  className,
  labels,
}: {
  current: NavKey;
  className?: string;
  /** Translated labels for the guide pages. English when omitted. */
  labels?: Partial<Record<NavKey, string>>;
}) {
  /* NO WRAPPING, and every item the same size in both states.
   *
   * The nav used to be `flex-wrap` next to a flexible input, so at a range of
   * widths an item dropped to a second line and took the whole bar's height
   * with it — content below jumped as the window, or the on-screen keyboard,
   * changed. It is now a single row that scrolls if it must, the items never
   * shrink, and the active treatment changes only COLOUR: 1.5px border and
   * medium weight in both states, so selecting a section cannot reflow
   * anything. */
  return (
    /* `min-w-0` and NOT `shrink-0`: the nav is the only flexible thing in the
     * header row. With `shrink-0` the wordmark, the three pills and the theme
     * toggle came to ~380px in a 350px line on a phone, so the toggle was
     * pushed off the right edge and clipped. Letting the nav shrink means it
     * scrolls its own pills — which it was already set up to do — and
     * everything else stays put. */
    /* `[scrollbar-width:none]` — the overflow is a safety net, not a feature.
     *
     * At 390px the three pills came to 267px in 237px of room, so the nav
     * scrolled: Chrome drew a grey horizontal scrollbar across the header and
     * cut "Standards" to "Standar". A label sliced mid-word under a system
     * scrollbar reads as a broken header, not as "there is more this way" —
     * which is exactly what the comment below already said, while the layout
     * did it anyway. The pills are tighter below `md` now and all three fit;
     * the scroll stays for the widths and translations where they do not, but
     * without the scrollbar drawn through the header. */
    <nav
      aria-label="Sections"
      className={`flex min-w-0 flex-nowrap gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-1.5 ${className ?? ""}`}
    >
      {ITEMS.map((item) => {
        const on = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-2 py-1.5 text-small font-medium transition-colors duration-200 ease-out sm:px-3 md:px-3.5 ${
              on
                ? "border-line bg-heading text-page"
                : "border-transparent text-body hover:bg-sunk hover:text-heading"
            }`}
          >
            {labels?.[item.key] ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
