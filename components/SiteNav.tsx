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
  return (
    <nav aria-label="Sections" className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {ITEMS.map((item) => {
        const on = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-small font-medium transition duration-200 ease-out ${
              on ? "border-line bg-heading text-page" : "border-transparent text-body hover:bg-sunk hover:text-heading"
            }`}
          >
            {labels?.[item.key] ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
