import { MAKER_NAME, MAKER_URL } from "@/lib/site";

/* The byline.
 *
 * Attribution, not a funnel. An estimator who opened this to price a job does
 * not want a services list, a free-diagnosis pitch or a second orange button,
 * and putting one here would make the tool feel like bait — which would also
 * make the tool worth less as evidence that we build real software.
 *
 * So: one line, muted, no clay. The app's single clay element stays the
 * "Add to takeoff" button, per docs/app-surface.md.
 */

export default function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={`border-t-[1.5px] border-rule print:hidden${className ? ` ${className}` : ""}`}
    >
      <div className="mx-auto flex w-full max-w-canvas flex-col gap-2 px-5 py-8 text-small text-muted md:flex-row md:items-center md:justify-between md:px-8">
        <p>
          DuctForge — built by{" "}
          <a
            href={MAKER_URL}
            className="text-accent underline-offset-4 transition-colors duration-200 ease-out hover:underline"
          >
            {MAKER_NAME}
          </a>
          .
        </p>
        <p>Takeoffs stay on this device. Nothing is uploaded anywhere.</p>
      </div>
    </footer>
  );
}
