import Link from "next/link";
import { MAKER_NAME, MAKER_URL } from "@/lib/site";

/* The name, with its maker attached.
 *
 * Two sibling links rather than one nested pair — an anchor inside an anchor is
 * invalid and browsers resolve it unpredictably. The product name goes home;
 * "by DebugSwift" goes to DebugSwift.
 *
 * The byline shows at every width. It was hidden below `sm` for one build to
 * buy room in the mobile project bar; that made the attribution invisible on
 * exactly the device most people open this on, which is the opposite of the
 * point. The bar gave up the space instead.
 */
/* Deliberately never an h1. The project bar renders this TWICE — once for the
 * phone layout, once for the desktop one — and although only one is ever
 * displayed, both are in the markup. Two h1 elements in one document is a mess
 * a crawler sees even when a screen reader does not, so the workspace owns its
 * heading separately and this is always a plain span. */
export default function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className="flex flex-col leading-tight">
      <Link
        href="/"
        className={`font-bold tracking-tight text-heading ${
          size === "sm" ? "text-h3" : "text-h3 md:text-h2-mobile"
        }`}
      >
        Duct<span className="text-accent">Forge</span>
      </Link>
      <a
        href={MAKER_URL}
        className="whitespace-nowrap text-small text-muted underline-offset-2 transition-colors duration-200 ease-out hover:text-body hover:underline"
      >
        by {MAKER_NAME}
      </a>
    </span>
  );
}
